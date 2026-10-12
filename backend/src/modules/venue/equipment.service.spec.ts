/* eslint-disable @typescript-eslint/no-unsafe-assignment --
   expect.objectContaining()'s return type is `any` in this project's jest
   types - a known false positive, not real untyped values. */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('EquipmentService', () => {
  let service: EquipmentService;
  let prisma: {
    user: { findUnique: jest.Mock };
    hostel: { findFirst: jest.Mock; findMany: jest.Mock };
    equipment: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    equipmentBooking: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      hostel: { findFirst: jest.fn(), findMany: jest.fn() },
      equipment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      equipmentBooking: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EquipmentService>(EquipmentService);
  });

  describe('addItem', () => {
    it('throws ForbiddenException if the caller is not Sports Admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ isSportsAdmin: false });
      await expect(
        service.addItem('u1', { name: 'Bat', totalQuantity: 10 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates the item with availableQuantity seeded to totalQuantity', async () => {
      prisma.user.findUnique.mockResolvedValue({ isSportsAdmin: true });
      prisma.equipment.create.mockResolvedValue({ id: 'eq-1' });

      await service.addItem('admin-1', { name: 'Bat', totalQuantity: 10 });

      expect(prisma.equipment.create).toHaveBeenCalledWith({
        data: { name: 'Bat', totalQuantity: 10, availableQuantity: 10 },
      });
    });
  });

  describe('updateItem', () => {
    it('throws ConflictException if the new total is below what is checked out', async () => {
      prisma.user.findUnique.mockResolvedValue({ isSportsAdmin: true });
      prisma.equipment.findUnique.mockResolvedValue({
        id: 'eq-1',
        totalQuantity: 10,
        availableQuantity: 4, // 6 in use
      });
      await expect(
        service.updateItem('admin-1', 'eq-1', {
          name: 'Bat',
          totalQuantity: 5,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('recomputes availableQuantity, keeping in-use stock untouched', async () => {
      prisma.user.findUnique.mockResolvedValue({ isSportsAdmin: true });
      prisma.equipment.findUnique.mockResolvedValue({
        id: 'eq-1',
        totalQuantity: 10,
        availableQuantity: 4, // 6 in use
      });
      prisma.equipment.update.mockResolvedValue({});

      await service.updateItem('admin-1', 'eq-1', {
        name: 'Bat',
        totalQuantity: 20,
      });

      expect(prisma.equipment.update).toHaveBeenCalledWith({
        where: { id: 'eq-1' },
        data: { name: 'Bat', totalQuantity: 20, availableQuantity: 14 },
      });
    });
  });

  describe('deleteItem', () => {
    it('throws ConflictException if any pending/checked-out booking references it', async () => {
      prisma.user.findUnique.mockResolvedValue({ isSportsAdmin: true });
      prisma.equipment.findUnique.mockResolvedValue({
        id: 'eq-1',
        name: 'Bat',
      });
      prisma.equipmentBooking.count.mockResolvedValue(2);
      await expect(service.deleteItem('admin-1', 'eq-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('deletes when nothing references it', async () => {
      prisma.user.findUnique.mockResolvedValue({ isSportsAdmin: true });
      prisma.equipment.findUnique.mockResolvedValue({
        id: 'eq-1',
        name: 'Bat',
      });
      prisma.equipmentBooking.count.mockResolvedValue(0);
      prisma.equipmentBooking.deleteMany.mockResolvedValue({ count: 0 });
      prisma.equipment.delete.mockResolvedValue({});
      prisma.$transaction.mockResolvedValue([]);

      const result = await service.deleteItem('admin-1', 'eq-1');

      expect(result).toEqual({ deleted: true });
    });

    // Regression test: an item with only settled history (returned/
    // rejected - "0 in play") used to still 500 on delete, because the
    // FK (ON DELETE RESTRICT) blocks removing an Equipment row that any
    // EquipmentBooking still references, regardless of status. The
    // in-play count alone isn't enough - the history rows themselves
    // have to go too.
    it('cascades to settled booking history (returned/rejected), not just in-play bookings', async () => {
      prisma.user.findUnique.mockResolvedValue({ isSportsAdmin: true });
      prisma.equipment.findUnique.mockResolvedValue({
        id: 'eq-1',
        name: 'Bat',
      });
      prisma.equipmentBooking.count.mockResolvedValue(0); // nothing pending/checked_out...
      prisma.equipmentBooking.deleteMany.mockResolvedValue({ count: 2 }); // ...but 2 returned/rejected rows exist
      prisma.equipment.delete.mockResolvedValue({});
      prisma.$transaction.mockResolvedValue([]);

      await service.deleteItem('admin-1', 'eq-1');

      expect(prisma.equipmentBooking.deleteMany).toHaveBeenCalledWith({
        where: { equipmentId: 'eq-1' },
      });
      expect(prisma.equipment.delete).toHaveBeenCalledWith({
        where: { id: 'eq-1' },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('requestBooking', () => {
    it('throws BadRequestException if the caller has no hostel', async () => {
      prisma.user.findUnique.mockResolvedValue({ hostelId: null });
      await expect(
        service.requestBooking('u1', 'eq-1', { quantity: 2 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException if the quantity exceeds what is available', async () => {
      prisma.user.findUnique.mockResolvedValue({ hostelId: 'hostel-1' });
      prisma.hostel.findFirst.mockResolvedValue(null);
      prisma.equipment.findUnique.mockResolvedValue({
        id: 'eq-1',
        availableQuantity: 1,
      });
      await expect(
        service.requestBooking('u1', 'eq-1', { quantity: 2 }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a pending booking without touching stock (student or secretary alike)', async () => {
      prisma.user.findUnique.mockResolvedValue({ hostelId: 'hostel-1' });
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-1' }); // caller IS a secretary
      prisma.equipment.findUnique.mockResolvedValue({
        id: 'eq-1',
        availableQuantity: 5,
      });
      prisma.equipmentBooking.create.mockResolvedValue({
        id: 'b1',
        equipmentId: 'eq-1',
        quantityRequested: 2,
        status: 'pending',
        createdAt: new Date(),
        equipment: { id: 'eq-1', name: 'Bat' },
        requestedBy: { id: 'u1', name: 'Sec' },
      });
      prisma.hostel.findMany.mockResolvedValue([
        { sportsSecretaryUserId: 'u1' },
      ]);

      const result = await service.requestBooking('u1', 'eq-1', {
        quantity: 2,
      });

      expect(prisma.equipmentBooking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            equipmentId: 'eq-1',
            quantityRequested: 2,
            status: 'pending',
            source: 'secretary_request',
          }),
        }),
      );
      expect(result.requestedByRole).toBe('secretary');
    });
  });

  describe('approve', () => {
    it('throws NotFoundException if the request does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue({ isSportsAdmin: true });
      prisma.equipmentBooking.findUnique.mockResolvedValue(null);
      await expect(service.approve('admin-1', 'b1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException if there is no longer enough stock', async () => {
      prisma.user.findUnique.mockResolvedValue({ isSportsAdmin: true });
      prisma.equipmentBooking.findUnique.mockResolvedValue({
        id: 'b1',
        equipmentId: 'eq-1',
        quantityRequested: 5,
      });
      prisma.equipment.findUnique.mockResolvedValue({
        id: 'eq-1',
        availableQuantity: 2,
      });
      await expect(service.approve('admin-1', 'b1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('decrements stock and marks the booking checked_out, in one transaction', async () => {
      prisma.user.findUnique.mockResolvedValue({ isSportsAdmin: true });
      prisma.equipmentBooking.findUnique.mockResolvedValue({
        id: 'b1',
        equipmentId: 'eq-1',
        quantityRequested: 3,
      });
      prisma.equipment.findUnique.mockResolvedValue({
        id: 'eq-1',
        availableQuantity: 5,
      });
      prisma.equipment.update.mockResolvedValue({});
      prisma.equipmentBooking.update.mockResolvedValue({});
      prisma.$transaction.mockResolvedValue([]);

      const result = await service.approve('admin-1', 'b1');

      expect(prisma.equipment.update).toHaveBeenCalledWith({
        where: { id: 'eq-1' },
        data: { availableQuantity: { decrement: 3 } },
      });
      expect(prisma.equipmentBooking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b1' },
          data: expect.objectContaining({ status: 'checked_out' }),
        }),
      );
      expect(result).toEqual({ approved: true });
    });
  });

  describe('markReturned', () => {
    it('increments availableQuantity by the booking quantity', async () => {
      prisma.user.findUnique.mockResolvedValue({ isSportsAdmin: true });
      prisma.equipmentBooking.findUnique.mockResolvedValue({
        id: 'b1',
        equipmentId: 'eq-1',
        quantityRequested: 3,
      });
      prisma.$transaction.mockResolvedValue([]);

      const result = await service.markReturned('admin-1', 'b1');

      expect(result).toEqual({ returned: true });
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
