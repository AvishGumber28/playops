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
import { VenueService } from './venue.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('VenueService', () => {
  let service: VenueService;
  let prisma: {
    user: { findUnique: jest.Mock };
    hostel: { findFirst: jest.Mock; findMany: jest.Mock };
    venue: { findMany: jest.Mock; findUnique: jest.Mock };
    venueBooking: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      hostel: { findFirst: jest.fn(), findMany: jest.fn() },
      venue: { findMany: jest.fn(), findUnique: jest.fn() },
      venueBooking: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [VenueService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<VenueService>(VenueService);
  });

  describe('requestBooking', () => {
    it('throws BadRequestException if the caller has no hostel', async () => {
      prisma.user.findUnique.mockResolvedValue({ hostelId: null });
      await expect(
        service.requestBooking('u1', 'venue-1', {
          date: '2099-01-01',
          hour: '09:00-10:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if the venue does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue({ hostelId: 'hostel-1' });
      prisma.hostel.findFirst.mockResolvedValue(null);
      prisma.venue.findUnique.mockResolvedValue(null);
      await expect(
        service.requestBooking('u1', 'venue-1', {
          date: '2099-01-01',
          hour: '09:00-10:00',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException if the slot is already approved', async () => {
      prisma.user.findUnique.mockResolvedValue({ hostelId: 'hostel-1' });
      prisma.hostel.findFirst.mockResolvedValue(null);
      prisma.venue.findUnique.mockResolvedValue({ id: 'venue-1' });
      prisma.venueBooking.findFirst.mockResolvedValueOnce({ id: 'existing' }); // approved
      await expect(
        service.requestBooking('u1', 'venue-1', {
          date: '2099-01-01',
          hour: '09:00-10:00',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if the caller already has a pending request for this slot', async () => {
      prisma.user.findUnique.mockResolvedValue({ hostelId: 'hostel-1' });
      prisma.hostel.findFirst.mockResolvedValue(null);
      prisma.venue.findUnique.mockResolvedValue({ id: 'venue-1' });
      prisma.venueBooking.findFirst
        .mockResolvedValueOnce(null) // no approved
        .mockResolvedValueOnce({ id: 'mine' }); // already mine, pending
      await expect(
        service.requestBooking('u1', 'venue-1', {
          date: '2099-01-01',
          hour: '09:00-10:00',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a pending booking, splitting the hour into startTime/endTime', async () => {
      prisma.user.findUnique.mockResolvedValue({ hostelId: 'hostel-1' });
      prisma.hostel.findFirst.mockResolvedValue(null); // caller is a student
      prisma.venue.findUnique.mockResolvedValue({ id: 'venue-1' });
      prisma.venueBooking.findFirst.mockResolvedValue(null);
      prisma.venueBooking.create.mockResolvedValue({
        id: 'b1',
        date: new Date('2099-01-01'),
        startTime: '09:00',
        endTime: '10:00',
        status: 'pending',
        createdAt: new Date(),
        venue: { id: 'venue-1', name: 'Cricket Ground' },
        requestedBy: { id: 'u1', name: 'Stu' },
      });
      prisma.hostel.findMany.mockResolvedValue([]);

      const result = await service.requestBooking('u1', 'venue-1', {
        date: '2099-01-01',
        hour: '09:00-10:00',
      });

      expect(prisma.venueBooking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            venueId: 'venue-1',
            startTime: '09:00',
            endTime: '10:00',
            status: 'pending',
            source: 'student_request',
          }),
        }),
      );
      expect(result.hour).toBe('09:00-10:00');
      expect(result.requestedByRole).toBe('student');
    });
  });

  describe('approve', () => {
    it('throws ForbiddenException if the caller is not Sports Admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ isSportsAdmin: false });
      await expect(service.approve('u1', 'b1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException if the request does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue({ isSportsAdmin: true });
      prisma.venueBooking.findUnique.mockResolvedValue(null);
      await expect(service.approve('admin-1', 'b1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException if the slot was already approved for someone else', async () => {
      prisma.user.findUnique.mockResolvedValue({ isSportsAdmin: true });
      prisma.venueBooking.findUnique.mockResolvedValue({
        id: 'b1',
        venueId: 'v1',
        date: new Date('2099-01-01'),
        startTime: '09:00',
        endTime: '10:00',
      });
      prisma.venueBooking.findFirst.mockResolvedValue({ id: 'other-approved' });
      await expect(service.approve('admin-1', 'b1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('approves the booking and auto-rejects other pending requests for the same slot, in one transaction', async () => {
      prisma.user.findUnique.mockResolvedValue({ isSportsAdmin: true });
      prisma.venueBooking.findUnique.mockResolvedValue({
        id: 'b1',
        venueId: 'v1',
        date: new Date('2099-01-01'),
        startTime: '09:00',
        endTime: '10:00',
      });
      prisma.venueBooking.findFirst.mockResolvedValue(null); // no existing approved conflict
      const tx = { venueBooking: { update: jest.fn(), updateMany: jest.fn() } };
      prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
        fn(tx),
      );

      const result = await service.approve('admin-1', 'b1');

      expect(tx.venueBooking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b1' },
          data: expect.objectContaining({ status: 'approved' }),
        }),
      );
      expect(tx.venueBooking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 'b1' },
            venueId: 'v1',
            status: 'pending',
          }),
          data: expect.objectContaining({ status: 'rejected' }),
        }),
      );
      expect(result).toEqual({ approved: true });
    });

    // FR-009: this is what actually makes a fixture match "scheduled" -
    // nothing else writes to Match.scheduledDate/scheduledTime.
    it("updates the linked Match's schedule when the booking is tied to one", async () => {
      prisma.user.findUnique.mockResolvedValue({ isSportsAdmin: true });
      prisma.venueBooking.findUnique.mockResolvedValue({
        id: 'b1',
        venueId: 'v1',
        matchId: 'match-1',
        date: new Date('2099-01-01'),
        startTime: '09:00',
        endTime: '10:00',
      });
      prisma.venueBooking.findFirst.mockResolvedValue(null);
      const tx = {
        venueBooking: { update: jest.fn(), updateMany: jest.fn() },
        match: { update: jest.fn() },
      };
      prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
        fn(tx),
      );

      await service.approve('admin-1', 'b1');

      expect(tx.match.update).toHaveBeenCalledWith({
        where: { id: 'match-1' },
        data: {
          scheduledDate: new Date('2099-01-01'),
          scheduledTime: '09:00',
          status: 'scheduled',
          cancellationReason: null,
        },
      });
    });

    // FR-009: this is what makes a cancel-then-auto-reschedule actually
    // recoverable, instead of the match staying permanently `cancelled`
    // even once a real replacement slot is confirmed.
    it('revives a cancelled match back to scheduled once its replacement booking is approved', async () => {
      prisma.user.findUnique.mockResolvedValue({ isSportsAdmin: true });
      prisma.venueBooking.findUnique.mockResolvedValue({
        id: 'b1',
        venueId: 'v1',
        matchId: 'match-1',
        date: new Date('2099-01-02'),
        startTime: '06:00',
        endTime: '07:00',
      });
      prisma.venueBooking.findFirst.mockResolvedValue(null);
      const tx = {
        venueBooking: { update: jest.fn(), updateMany: jest.fn() },
        match: { update: jest.fn() },
      };
      prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
        fn(tx),
      );

      await service.approve('admin-1', 'b1');

      expect(tx.match.update).toHaveBeenCalledWith({
        where: { id: 'match-1' },
        data: expect.objectContaining({
          status: 'scheduled',
          cancellationReason: null,
        }),
      });
    });
  });

  describe('reject', () => {
    it('sets status to rejected', async () => {
      prisma.user.findUnique.mockResolvedValue({ isSportsAdmin: true });
      prisma.venueBooking.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.venueBooking.update.mockResolvedValue({});

      await service.reject('admin-1', 'b1');

      expect(prisma.venueBooking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b1' },
          data: expect.objectContaining({ status: 'rejected' }),
        }),
      );
    });
  });
});
