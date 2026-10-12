/* eslint-disable @typescript-eslint/no-unsafe-assignment --
   expect.objectContaining()'s return type is `any` in this project's jest
   types - a known false positive for this rule (recurs throughout this
   file), not actual untyped values flowing through real code. */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { HostelService } from './hostel.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('HostelService', () => {
  let service: HostelService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    hostel: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    teamPlayer: { findFirst: jest.Mock };
    hostelChangeRequest: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      hostel: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      teamPlayer: { findFirst: jest.fn() },
      hostelChangeRequest: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      // Real Prisma's array-form $transaction resolves an array of
      // already-invoked operation promises - Promise.all over the mocked
      // calls reproduces that shape closely enough for these tests.
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [HostelService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<HostelService>(HostelService);
  });

  describe('listHostels', () => {
    it('returns hostels ordered by code', async () => {
      prisma.hostel.findMany.mockResolvedValue([
        { id: '1', code: 'A', name: 'Agira Hall' },
      ]);
      const result = await service.listHostels();
      expect(result).toEqual([{ id: '1', code: 'A', name: 'Agira Hall' }]);
      expect(prisma.hostel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { code: 'asc' } }),
      );
    });
  });

  describe('selectHostel', () => {
    it('throws NotFoundException if the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.selectHostel('user-1', 'hostel-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException if the user already has a hostel (business rule 1)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        hostelId: 'existing-hostel',
      });
      await expect(service.selectHostel('user-1', 'hostel-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException if the chosen hostel does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        hostelId: null,
      });
      prisma.hostel.findUnique.mockResolvedValue(null);
      await expect(
        service.selectHostel('user-1', 'bad-hostel'),
      ).rejects.toThrow(NotFoundException);
    });

    it('sets hostelId and a lock exactly 6 months out on success', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        hostelId: null,
      });
      prisma.hostel.findUnique.mockResolvedValue({
        id: 'hostel-1',
        code: 'A',
        name: 'Agira Hall',
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.selectHostel('user-1', 'hostel-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({ hostelId: 'hostel-1' }),
      });
      expect(result.hostel).toEqual({
        id: 'hostel-1',
        code: 'A',
        name: 'Agira Hall',
      });

      const monthsDiff =
        (result.hostelLockedUntil.getFullYear() -
          result.hostelSelectedAt.getFullYear()) *
          12 +
        (result.hostelLockedUntil.getMonth() -
          result.hostelSelectedAt.getMonth());
      expect(monthsDiff).toBe(6);
    });
  });

  // FR-004 (Sports Secretary) and D-011 (Proctor/Gym Secretary/Mess
  // Secretary) - all four go through the same private appointRole
  // mechanism, so appointSecretary exercises every shared check; the other
  // three just confirm each one writes to its own correct column.
  describe('appointSecretary (shared appointment logic)', () => {
    const hostel = { id: 'hostel-1', caretakerUserId: 'caretaker-1' };
    const student = {
      id: 'student-1',
      name: 'Riya',
      email: 'riya@thapar.edu',
      hostelId: 'hostel-1',
    };

    it('throws NotFoundException if the hostel does not exist', async () => {
      prisma.hostel.findUnique.mockResolvedValue(null);
      await expect(
        service.appointSecretary('caretaker-1', 'hostel-1', 'riya@thapar.edu'),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException if the caller is not this hostel's Caretaker (business rule 6)", async () => {
      prisma.hostel.findUnique.mockResolvedValue(hostel);
      await expect(
        service.appointSecretary('someone-else', 'hostel-1', 'riya@thapar.edu'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException if no user has that email', async () => {
      prisma.hostel.findUnique.mockResolvedValue(hostel);
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.appointSecretary(
          'caretaker-1',
          'hostel-1',
          'nobody@thapar.edu',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException if the student isn't a member of this hostel (FR-004)", async () => {
      prisma.hostel.findUnique.mockResolvedValue(hostel);
      prisma.user.findUnique.mockResolvedValue({
        ...student,
        hostelId: 'other-hostel',
      });
      await expect(
        service.appointSecretary('caretaker-1', 'hostel-1', student.email),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException if the student already holds this title at another hostel', async () => {
      prisma.hostel.findUnique.mockResolvedValue(hostel);
      prisma.user.findUnique.mockResolvedValue(student);
      prisma.hostel.findFirst.mockResolvedValue({ id: 'other-hostel' });
      await expect(
        service.appointSecretary('caretaker-1', 'hostel-1', student.email),
      ).rejects.toThrow(ConflictException);
    });

    it('appoints on success, replacing any previous holder with no history kept', async () => {
      prisma.hostel.findUnique.mockResolvedValue(hostel);
      prisma.user.findUnique.mockResolvedValue(student);
      prisma.hostel.findFirst.mockResolvedValue(null);
      prisma.hostel.update.mockResolvedValue({
        id: 'hostel-1',
        code: 'A',
        name: 'Agira Hall',
      });

      const result = await service.appointSecretary(
        'caretaker-1',
        'hostel-1',
        student.email,
      );

      expect(prisma.hostel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'hostel-1' },
          data: { sportsSecretaryUserId: 'student-1' },
        }),
      );
      expect(result.appointee).toEqual({
        id: 'student-1',
        name: 'Riya',
        email: 'riya@thapar.edu',
      });
    });
  });

  describe('appointProctor / appointGymSecretary / appointMessSecretary', () => {
    const hostel = { id: 'hostel-1', caretakerUserId: 'caretaker-1' };
    const student = {
      id: 'student-1',
      name: 'Riya',
      email: 'riya@thapar.edu',
      hostelId: 'hostel-1',
    };

    beforeEach(() => {
      prisma.hostel.findUnique.mockResolvedValue(hostel);
      prisma.user.findUnique.mockResolvedValue(student);
      prisma.hostel.findFirst.mockResolvedValue(null);
      prisma.hostel.update.mockResolvedValue({
        id: 'hostel-1',
        code: 'A',
        name: 'Agira Hall',
      });
    });

    it('appointProctor writes proctorUserId (D-011)', async () => {
      await service.appointProctor('caretaker-1', 'hostel-1', student.email);
      expect(prisma.hostel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { proctorUserId: 'student-1' } }),
      );
    });

    it('appointGymSecretary writes gymSecretaryUserId (D-011)', async () => {
      await service.appointGymSecretary(
        'caretaker-1',
        'hostel-1',
        student.email,
      );
      expect(prisma.hostel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { gymSecretaryUserId: 'student-1' } }),
      );
    });

    it('appointMessSecretary writes messSecretaryUserId (D-011)', async () => {
      await service.appointMessSecretary(
        'caretaker-1',
        'hostel-1',
        student.email,
      );
      expect(prisma.hostel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { messSecretaryUserId: 'student-1' } }),
      );
    });
  });

  describe('getHostelDetail', () => {
    it('throws NotFoundException if the hostel does not exist', async () => {
      prisma.hostel.findUnique.mockResolvedValue(null);
      await expect(service.getHostelDetail('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the hostel with all four appointee relations', async () => {
      const detail = {
        id: 'hostel-1',
        code: 'A',
        name: 'Agira Hall',
        sportsSecretary: { id: 's1', name: 'Riya', email: 'riya@thapar.edu' },
        proctor: null,
        gymSecretary: null,
        messSecretary: null,
      };
      prisma.hostel.findUnique.mockResolvedValue(detail);
      const result = await service.getHostelDetail('hostel-1');
      expect(result).toEqual(detail);
    });
  });

  // FR-003's change flow (business rules 9 and 13).
  describe('requestHostelChange', () => {
    it('throws NotFoundException if the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.requestHostelChange('user-1', 'hostel-b'),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException if the user has no hostel yet (this isn't the first-selection endpoint)", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        hostelId: null,
      });
      await expect(
        service.requestHostelChange('user-1', 'hostel-b'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if requesting the hostel they are already in', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        hostelId: 'hostel-a',
      });
      await expect(
        service.requestHostelChange('user-1', 'hostel-a'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if the requested hostel does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        hostelId: 'hostel-a',
      });
      prisma.hostel.findUnique.mockResolvedValue(null);
      await expect(
        service.requestHostelChange('user-1', 'hostel-b'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException if a pending request already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        hostelId: 'hostel-a',
      });
      prisma.hostel.findUnique.mockResolvedValue({
        id: 'hostel-b',
        code: 'B',
        name: 'B Hall',
      });
      prisma.hostelChangeRequest.findFirst.mockResolvedValue({
        id: 'existing-request',
      });
      await expect(
        service.requestHostelChange('user-1', 'hostel-b'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if on an active team in an in-progress tournament (business rule 13)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        hostelId: 'hostel-a',
      });
      prisma.hostel.findUnique.mockResolvedValue({
        id: 'hostel-b',
        code: 'B',
        name: 'B Hall',
      });
      prisma.hostelChangeRequest.findFirst.mockResolvedValue(null);
      prisma.teamPlayer.findFirst.mockResolvedValue({ id: 'membership-1' });
      await expect(
        service.requestHostelChange('user-1', 'hostel-b'),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a pending request on success', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        hostelId: 'hostel-a',
      });
      prisma.hostel.findUnique.mockResolvedValue({
        id: 'hostel-b',
        code: 'B',
        name: 'B Hall',
      });
      prisma.hostelChangeRequest.findFirst.mockResolvedValue(null);
      prisma.teamPlayer.findFirst.mockResolvedValue(null);
      prisma.hostelChangeRequest.create.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
      });

      await service.requestHostelChange('user-1', 'hostel-b');

      expect(prisma.hostelChangeRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId: 'user-1',
            requestedHostelId: 'hostel-b',
            status: 'pending',
          },
        }),
      );
    });
  });

  describe('getMyPendingChangeRequest', () => {
    it('returns null when there is no pending request', async () => {
      prisma.hostelChangeRequest.findFirst.mockResolvedValue(null);
      expect(await service.getMyPendingChangeRequest('user-1')).toBeNull();
    });
  });

  describe('listPendingChangeRequestsForCaretaker', () => {
    it('throws ForbiddenException if the caller is not a Caretaker anywhere', async () => {
      prisma.hostel.findFirst.mockResolvedValue(null);
      await expect(
        service.listPendingChangeRequestsForCaretaker('not-a-caretaker'),
      ).rejects.toThrow(ForbiddenException);
    });

    it("scopes the query to the caller's own hostel as the CURRENT hostel (business rule 9)", async () => {
      prisma.hostel.findFirst.mockResolvedValue({
        id: 'hostel-a',
        caretakerUserId: 'caretaker-1',
      });
      prisma.hostelChangeRequest.findMany.mockResolvedValue([]);

      await service.listPendingChangeRequestsForCaretaker('caretaker-1');

      expect(prisma.hostelChangeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending', user: { hostelId: 'hostel-a' } },
        }),
      );
    });
  });

  describe('approveChangeRequest / rejectChangeRequest', () => {
    const pendingRequest = {
      id: 'req-1',
      userId: 'student-1',
      requestedHostelId: 'hostel-b',
      status: 'pending',
      user: { id: 'student-1', hostelId: 'hostel-a' },
    };
    const currentHostel = { id: 'hostel-a', caretakerUserId: 'caretaker-1' };

    it('throws NotFoundException if the request does not exist', async () => {
      prisma.hostelChangeRequest.findUnique.mockResolvedValue(null);
      await expect(
        service.approveChangeRequest('caretaker-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException if the request was already decided', async () => {
      prisma.hostelChangeRequest.findUnique.mockResolvedValue({
        ...pendingRequest,
        status: 'approved',
      });
      await expect(
        service.approveChangeRequest('caretaker-1', 'req-1'),
      ).rejects.toThrow(ConflictException);
    });

    it("throws ForbiddenException if the caller isn't the student's CURRENT hostel's Caretaker (business rule 9)", async () => {
      prisma.hostelChangeRequest.findUnique.mockResolvedValue(pendingRequest);
      prisma.hostel.findUnique.mockResolvedValue(currentHostel);
      await expect(
        service.approveChangeRequest('someone-else', 'req-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('reject just marks the request rejected, with no business-rule-13 check', async () => {
      prisma.hostelChangeRequest.findUnique.mockResolvedValue(pendingRequest);
      prisma.hostel.findUnique.mockResolvedValue(currentHostel);
      prisma.hostelChangeRequest.update.mockResolvedValue({
        status: 'rejected',
      });

      await service.rejectChangeRequest('caretaker-1', 'req-1');

      expect(prisma.hostelChangeRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-1' },
          data: expect.objectContaining({
            status: 'rejected',
            reviewedById: 'caretaker-1',
          }),
        }),
      );
      expect(prisma.teamPlayer.findFirst).not.toHaveBeenCalled();
    });

    it('throws ConflictException on approve if business rule 13 now blocks it (re-checked at decision time)', async () => {
      prisma.hostelChangeRequest.findUnique.mockResolvedValue(pendingRequest);
      prisma.hostel.findUnique.mockResolvedValue(currentHostel);
      prisma.teamPlayer.findFirst.mockResolvedValue({ id: 'membership-1' });

      await expect(
        service.approveChangeRequest('caretaker-1', 'req-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('approve moves the user and marks the request approved, in one transaction', async () => {
      prisma.hostelChangeRequest.findUnique.mockResolvedValue(pendingRequest);
      prisma.hostel.findUnique.mockResolvedValue(currentHostel);
      prisma.teamPlayer.findFirst.mockResolvedValue(null);
      prisma.user.update.mockResolvedValue({});
      prisma.hostelChangeRequest.update.mockResolvedValue({
        status: 'approved',
      });

      await service.approveChangeRequest('caretaker-1', 'req-1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'student-1' },
          data: expect.objectContaining({ hostelId: 'hostel-b' }),
        }),
      );
      expect(prisma.hostelChangeRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-1' },
          data: expect.objectContaining({
            status: 'approved',
            reviewedById: 'caretaker-1',
          }),
        }),
      );
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
