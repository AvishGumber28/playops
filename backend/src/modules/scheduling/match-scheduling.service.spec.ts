/* eslint-disable @typescript-eslint/no-unsafe-assignment --
   expect.objectContaining()'s return type is `any` in this project's jest
   types - a known false positive, not real untyped values. */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MatchSchedulingService } from './match-scheduling.service';
import { TournamentService } from '../tournament/tournament.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('MatchSchedulingService', () => {
  let service: MatchSchedulingService;
  let prisma: {
    match: { findUnique: jest.Mock; update: jest.Mock };
    venue: { findUnique: jest.Mock };
    venueBooking: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
    conflictLog: { create: jest.Mock; updateMany: jest.Mock };
  };
  let tournamentService: {
    tournamentForSecretaryOrThrow: jest.Mock;
    maybeCompleteTournament: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      match: { findUnique: jest.fn(), update: jest.fn() },
      venue: { findUnique: jest.fn() },
      venueBooking: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      conflictLog: { create: jest.fn(), updateMany: jest.fn() },
    };
    tournamentService = {
      tournamentForSecretaryOrThrow: jest.fn(),
      maybeCompleteTournament: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchSchedulingService,
        { provide: PrismaService, useValue: prisma },
        { provide: TournamentService, useValue: tournamentService },
      ],
    }).compile();

    service = module.get<MatchSchedulingService>(MatchSchedulingService);
  });

  const validDto = {
    venueId: 'venue-1',
    date: '2099-01-01',
    hour: '09:00-10:00',
  };

  describe('scheduleMatch', () => {
    it('throws NotFoundException if the match does not exist', async () => {
      prisma.match.findUnique.mockResolvedValue(null);
      await expect(
        service.scheduleMatch('sec-1', 'm1', validDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates ForbiddenException from the secretary check', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 'm1',
        tournamentId: 'tour-1',
        status: 'scheduled',
      });
      tournamentService.tournamentForSecretaryOrThrow.mockRejectedValue(
        new ForbiddenException(),
      );
      await expect(service.scheduleMatch('u1', 'm1', validDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ConflictException if the match is already completed', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 'm1',
        tournamentId: 'tour-1',
        status: 'completed',
      });
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      await expect(
        service.scheduleMatch('sec-1', 'm1', validDto),
      ).rejects.toThrow(ConflictException);
    });

    // A cancelled match can be directly rescheduled by the Secretary
    // picking their own venue/time - they don't have to wait on the
    // auto-suggested replacement (if any) to be approved.
    it('allows scheduling a cancelled match (the Secretary picks their own slot instead of waiting on the auto-suggestion)', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 'm1',
        tournamentId: 'tour-1',
        status: 'cancelled',
      });
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.venue.findUnique.mockResolvedValue({ id: 'venue-1' });
      prisma.venueBooking.findFirst.mockResolvedValue(null);
      prisma.venueBooking.upsert.mockResolvedValue({
        id: 'booking-1',
        date: new Date('2099-01-01'),
        startTime: '09:00',
        endTime: '10:00',
        status: 'pending',
        venue: { id: 'venue-1', name: 'Cricket Ground' },
      });

      const result = await service.scheduleMatch('sec-1', 'm1', validDto);

      expect(result.status).toBe('pending');
    });

    it('throws NotFoundException if the venue does not exist', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 'm1',
        tournamentId: 'tour-1',
        status: 'scheduled',
      });
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.venue.findUnique.mockResolvedValue(null);
      await expect(
        service.scheduleMatch('sec-1', 'm1', validDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException if the slot is already approved for a different match', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 'm1',
        tournamentId: 'tour-1',
        status: 'scheduled',
      });
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.venue.findUnique.mockResolvedValue({ id: 'venue-1' });
      prisma.venueBooking.findFirst.mockResolvedValue({ id: 'other-booking' });
      await expect(
        service.scheduleMatch('sec-1', 'm1', validDto),
      ).rejects.toThrow(ConflictException);
    });

    it('upserts the match a pending booking, keyed by matchId', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 'm1',
        tournamentId: 'tour-1',
        status: 'scheduled',
      });
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.venue.findUnique.mockResolvedValue({ id: 'venue-1' });
      prisma.venueBooking.findFirst.mockResolvedValue(null);
      prisma.venueBooking.upsert.mockResolvedValue({
        id: 'booking-1',
        date: new Date('2099-01-01'),
        startTime: '09:00',
        endTime: '10:00',
        status: 'pending',
        venue: { id: 'venue-1', name: 'Cricket Ground' },
      });

      const result = await service.scheduleMatch('sec-1', 'm1', validDto);

      expect(prisma.venueBooking.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { matchId: 'm1' },
          create: expect.objectContaining({
            matchId: 'm1',
            tournamentId: 'tour-1',
            venueId: 'venue-1',
            startTime: '09:00',
            endTime: '10:00',
            status: 'pending',
            source: 'secretary_request',
          }),
          update: expect.objectContaining({
            venueId: 'venue-1',
            startTime: '09:00',
            endTime: '10:00',
            status: 'pending',
            approvedById: null,
          }),
        }),
      );
      expect(result.hour).toBe('09:00-10:00');
      expect(result.status).toBe('pending');
    });
  });

  describe('cancelMatch', () => {
    it('throws ConflictException if the match is already completed', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 'm1',
        tournamentId: 'tour-1',
        status: 'completed',
      });
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      await expect(
        service.cancelMatch('sec-1', 'm1', { reason: 'Rain' }),
      ).rejects.toThrow(ConflictException);
    });

    it('cancels a never-scheduled match with no reschedule attempt', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 'm1',
        tournamentId: 'tour-1',
        status: 'scheduled',
      });
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.venueBooking.findUnique.mockResolvedValue(null); // never booked
      prisma.match.update.mockResolvedValue({});
      prisma.conflictLog.create.mockResolvedValue({});

      const result = await service.cancelMatch('sec-1', 'm1', {
        reason: 'Rain',
      });

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { status: 'cancelled', cancellationReason: 'Rain' },
      });
      expect(result).toEqual({
        cancelled: true,
        rescheduled: null,
        message: 'Match cancelled.',
      });
      expect(prisma.venueBooking.update).not.toHaveBeenCalled();
    });

    it('frees the old slot and auto-suggests the next open one at the same venue', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 'm1',
        tournamentId: 'tour-1',
        status: 'scheduled',
      });
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.venueBooking.findUnique.mockResolvedValue({
        id: 'booking-1',
        venueId: 'venue-1',
        date: new Date('2099-01-01'),
        status: 'approved',
      });
      prisma.match.update.mockResolvedValue({});
      prisma.conflictLog.create.mockResolvedValue({});
      prisma.venueBooking.findMany.mockResolvedValue([]); // nothing else taken in the window
      prisma.venueBooking.update
        .mockResolvedValueOnce({}) // freeing the old slot
        .mockResolvedValueOnce({
          // the new, auto-suggested slot
          id: 'booking-1',
          date: new Date('2099-01-02'),
          startTime: '06:00',
          endTime: '07:00',
          status: 'pending',
          venue: { id: 'venue-1', name: 'Cricket Ground' },
        });
      prisma.conflictLog.updateMany.mockResolvedValue({});

      const result = await service.cancelMatch('sec-1', 'm1', {
        reason: 'Rain',
      });

      // frees the original slot
      expect(prisma.venueBooking.update).toHaveBeenNthCalledWith(1, {
        where: { matchId: 'm1' },
        data: expect.objectContaining({ status: 'rejected' }),
      });
      expect(result.cancelled).toBe(true);
      expect(result.rescheduled).not.toBeNull();
      expect(result.rescheduled?.hour).toBe('06:00-07:00');
      expect(result.message).toContain('awaiting Sports Department approval');
    });

    it('surfaces a clear message when no alternative slot is found', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 'm1',
        tournamentId: 'tour-1',
        status: 'scheduled',
      });
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.venueBooking.findUnique.mockResolvedValue({
        id: 'booking-1',
        venueId: 'venue-1',
        date: new Date('2099-01-01'),
        status: 'approved',
      });
      prisma.match.update.mockResolvedValue({});
      prisma.conflictLog.create.mockResolvedValue({});
      // Every single slot in the entire 30-day window is already taken.
      const allTaken: { date: Date; startTime: string }[] = [];
      for (let offset = 1; offset <= 30; offset++) {
        const d = new Date('2099-01-01');
        d.setDate(d.getDate() + offset);
        for (const hour of [
          '06:00',
          '07:00',
          '08:00',
          '09:00',
          '10:00',
          '11:00',
          '12:00',
          '13:00',
          '14:00',
          '15:00',
          '16:00',
          '17:00',
          '18:00',
          '19:00',
        ]) {
          allTaken.push({ date: d, startTime: hour });
        }
      }
      prisma.venueBooking.findMany.mockResolvedValue(allTaken);
      prisma.venueBooking.update.mockResolvedValueOnce({}); // freeing the old slot

      const result = await service.cancelMatch('sec-1', 'm1', {
        reason: 'Rain',
      });

      expect(result.rescheduled).toBeNull();
      expect(result.message).toContain('No alternative slot was found');
    });

    // D-022: cancelling a match can be what finishes its tournament (see
    // tournament.service.spec.ts for maybeCompleteTournament's own
    // coverage) - cancelMatch just needs to call it with the right id.
    it('checks whether cancelling this match completes its tournament', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 'm1',
        tournamentId: 'tour-1',
        status: 'scheduled',
      });
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.venueBooking.findUnique.mockResolvedValue(null);
      prisma.match.update.mockResolvedValue({});
      prisma.conflictLog.create.mockResolvedValue({});

      await service.cancelMatch('sec-1', 'm1', { reason: 'Rain' });

      expect(tournamentService.maybeCompleteTournament).toHaveBeenCalledWith(
        'tour-1',
      );
    });
  });
});
