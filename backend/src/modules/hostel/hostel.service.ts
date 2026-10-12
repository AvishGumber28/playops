import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// FR-003: selection "locks for a semester/year" - deliberately not pinned
// down further in the docs. Picking 6 months (one semester) as the
// concrete value; change this one constant if a full year is preferred.
const HOSTEL_LOCK_MONTHS = 6;

// D-011: the four Caretaker-appointed hostel positions, all appointed
// through the same mechanism (appointRole below). Only 'sportsSecretaryUserId'
// feeds into role resolution (FR-002) / dashboard routing - the other
// three are administrative record-keeping only.
type AppointableRole =
  | 'sportsSecretaryUserId'
  | 'proctorUserId'
  | 'gymSecretaryUserId'
  | 'messSecretaryUserId';

const ROLE_LABELS: Record<AppointableRole, string> = {
  sportsSecretaryUserId: 'Sports Secretary',
  proctorUserId: 'Proctor',
  gymSecretaryUserId: 'Gym Secretary',
  messSecretaryUserId: 'Mess Secretary',
};

@Injectable()
export class HostelService {
  constructor(private readonly prisma: PrismaService) {}

  async listHostels() {
    return this.prisma.hostel.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
  }

  async selectHostel(userId: string, hostelId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    // Business rule 1 / FR-003: one hostel per student. A student who
    // already has one must go through the change-request flow instead -
    // this endpoint is first-selection only.
    if (user.hostelId) {
      throw new ConflictException(
        'You already have a hostel. Submit a change request to switch.',
      );
    }

    // select matches HostelRef everywhere else - findUnique with no select
    // would return the full row, including caretakerUserId/
    // sportsSecretaryUserId, which the documented response shape doesn't
    // include.
    const hostel = await this.prisma.hostel.findUnique({
      where: { id: hostelId },
      select: { id: true, code: true, name: true },
    });
    if (!hostel) {
      throw new NotFoundException('Hostel not found.');
    }

    const selectedAt = new Date();
    const lockedUntil = new Date(selectedAt);
    lockedUntil.setMonth(lockedUntil.getMonth() + HOSTEL_LOCK_MONTHS);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        hostelId: hostel.id,
        hostelSelectedAt: selectedAt,
        hostelLockedUntil: lockedUntil,
      },
    });

    return {
      hostel,
      hostelSelectedAt: selectedAt,
      hostelLockedUntil: lockedUntil,
    };
  }

  // FR-004 (Sports Secretary) and D-011 (the other three) share this exact
  // mechanism: Caretaker of THIS hostel only, appointee identified by
  // email, appointee must already belong to this hostel, appointee can't
  // already hold this same title at a different hostel, and replacing a
  // previous holder keeps no history (D-005/Q-006).
  private async appointRole(
    callerId: string,
    hostelId: string,
    role: AppointableRole,
    email: string,
  ) {
    const hostel = await this.prisma.hostel.findUnique({
      where: { id: hostelId },
    });
    if (!hostel) {
      throw new NotFoundException('Hostel not found.');
    }

    // Business rule 6: only THIS hostel's Caretaker.
    if (hostel.caretakerUserId !== callerId) {
      throw new ForbiddenException(
        `Only this hostel's Caretaker can appoint its ${ROLE_LABELS[role]}.`,
      );
    }

    const target = await this.prisma.user.findUnique({ where: { email } });
    if (!target) {
      throw new NotFoundException(`No student found with email ${email}.`);
    }

    // FR-004's explicit error case, extended by D-011 to all four roles:
    // the appointee must already belong to this hostel.
    if (target.hostelId !== hostelId) {
      throw new BadRequestException(
        `${target.name} is not a member of this hostel.`,
      );
    }

    // Each role column is unique across ALL hostels (schema-enforced) -
    // pre-checking here gives a clean 409 instead of a raw Prisma
    // constraint error surfacing to the client.
    const holderElsewhere = await this.prisma.hostel.findFirst({
      where: { [role]: target.id, NOT: { id: hostelId } },
    });
    if (holderElsewhere) {
      throw new ConflictException(
        `${target.name} already holds this position at another hostel.`,
      );
    }

    const updated = await this.prisma.hostel.update({
      where: { id: hostelId },
      data: { [role]: target.id },
      select: { id: true, code: true, name: true },
    });

    return {
      hostel: updated,
      appointee: { id: target.id, name: target.name, email: target.email },
    };
  }

  appointSecretary(callerId: string, hostelId: string, email: string) {
    return this.appointRole(callerId, hostelId, 'sportsSecretaryUserId', email);
  }

  appointProctor(callerId: string, hostelId: string, email: string) {
    return this.appointRole(callerId, hostelId, 'proctorUserId', email);
  }

  appointGymSecretary(callerId: string, hostelId: string, email: string) {
    return this.appointRole(callerId, hostelId, 'gymSecretaryUserId', email);
  }

  appointMessSecretary(callerId: string, hostelId: string, email: string) {
    return this.appointRole(callerId, hostelId, 'messSecretaryUserId', email);
  }

  // FR-003's change flow / business rule 13: blocked while the student is
  // on an active team in an in-progress tournament, so a mid-tournament
  // hostel switch can't silently violate business rule 1 (one hostel per
  // player). Team/Tournament data doesn't really exist yet (that slice
  // isn't built) - written correctly against the schema now, per the
  // brief, rather than deeply tested for this specific edge case.
  private async assertNotOnActiveTeamInProgress(userId: string) {
    const activeMembership = await this.prisma.teamPlayer.findFirst({
      where: {
        userId,
        team: { status: 'active', tournament: { status: 'in_progress' } },
      },
    });
    if (activeMembership) {
      throw new ConflictException(
        'You are on an active team in an in-progress tournament - hostel changes are blocked until it ends or you leave the team (business rule 13).',
      );
    }
  }

  // FR-003's change flow. Distinct from selectHostel above: that one is
  // first-selection only (business rule 1), this one is for a student who
  // already has a hostel and wants to switch - it doesn't change hostelId
  // itself, just files a request for the CURRENT hostel's Caretaker to
  // decide (business rule 9 / D-005 / Q-004).
  async requestHostelChange(userId: string, requestedHostelId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (!user.hostelId) {
      throw new BadRequestException(
        'Select a hostel first - this endpoint is for changing an existing one.',
      );
    }

    if (user.hostelId === requestedHostelId) {
      throw new BadRequestException('You are already in this hostel.');
    }

    const requestedHostel = await this.prisma.hostel.findUnique({
      where: { id: requestedHostelId },
      select: { id: true, code: true, name: true },
    });
    if (!requestedHostel) {
      throw new NotFoundException('Hostel not found.');
    }

    // Not stated explicitly in the docs - a small addition to avoid a
    // student piling up duplicate requests. Easy to drop if unwanted.
    const existingPending = await this.prisma.hostelChangeRequest.findFirst({
      where: { userId, status: 'pending' },
    });
    if (existingPending) {
      throw new ConflictException(
        'You already have a pending hostel change request.',
      );
    }

    await this.assertNotOnActiveTeamInProgress(userId);

    return this.prisma.hostelChangeRequest.create({
      data: { userId, requestedHostelId, status: 'pending' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        requestedHostel: { select: { id: true, code: true, name: true } },
      },
    });
  }

  // Lets a student's dashboard show "you have a pending request to X"
  // instead of just re-showing the request form blindly.
  async getMyPendingChangeRequest(userId: string) {
    return this.prisma.hostelChangeRequest.findFirst({
      where: { userId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        requestedHostel: { select: { id: true, code: true, name: true } },
      },
    });
  }

  // A Caretaker's approval queue - scoped to requests where THEIR hostel is
  // the requester's CURRENT hostel (business rule 9 / D-005), not the
  // requested one.
  async listPendingChangeRequestsForCaretaker(callerId: string) {
    const myHostel = await this.prisma.hostel.findFirst({
      where: { caretakerUserId: callerId },
    });
    if (!myHostel) {
      throw new ForbiddenException(
        'Only a Caretaker can view hostel change requests.',
      );
    }

    return this.prisma.hostelChangeRequest.findMany({
      where: { status: 'pending', user: { hostelId: myHostel.id } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        requestedHostel: { select: { id: true, code: true, name: true } },
      },
    });
  }

  // Shared by approve/reject below - both need the same "is this really
  // the current hostel's Caretaker, and is this request still pending"
  // checks; only approve goes on to touch User/re-check business rule 13.
  private async decideChangeRequest(
    callerId: string,
    requestId: string,
    decision: 'approved' | 'rejected',
  ) {
    const changeRequest = await this.prisma.hostelChangeRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });
    if (!changeRequest) {
      throw new NotFoundException('Change request not found.');
    }

    if (changeRequest.status !== 'pending') {
      throw new ConflictException(
        'This change request has already been decided.',
      );
    }

    // Business rule 9 / D-005: re-checked against the student's LIVE
    // current hostel, not a value snapshotted at request time - it's the
    // hostel they're in NOW that determines who releases them.
    const currentHostel = changeRequest.user.hostelId
      ? await this.prisma.hostel.findUnique({
          where: { id: changeRequest.user.hostelId },
        })
      : null;
    if (!currentHostel || currentHostel.caretakerUserId !== callerId) {
      throw new ForbiddenException(
        "Only the student's current hostel's Caretaker can decide this request.",
      );
    }

    if (decision === 'rejected') {
      return this.prisma.hostelChangeRequest.update({
        where: { id: requestId },
        data: {
          status: 'rejected',
          reviewedById: callerId,
          reviewedAt: new Date(),
        },
      });
    }

    // Business rule 13, re-checked at decision time - the student's team/
    // tournament state may have changed since the request was filed.
    await this.assertNotOnActiveTeamInProgress(changeRequest.userId);

    const selectedAt = new Date();
    const lockedUntil = new Date(selectedAt);
    lockedUntil.setMonth(lockedUntil.getMonth() + HOSTEL_LOCK_MONTHS);

    // database-design.md flags this as needing a transaction, same
    // reasoning as venue-booking approval / match-result entry: the User
    // move and the request's own status update must succeed or fail
    // together, or a request could end up "approved" with the student
    // never actually moved (or vice versa).
    const [, updatedRequest] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: changeRequest.userId },
        data: {
          hostelId: changeRequest.requestedHostelId,
          hostelSelectedAt: selectedAt,
          hostelLockedUntil: lockedUntil,
        },
      }),
      this.prisma.hostelChangeRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          reviewedById: callerId,
          reviewedAt: new Date(),
        },
        select: {
          id: true,
          status: true,
          reviewedAt: true,
          requestedHostel: { select: { id: true, code: true, name: true } },
        },
      }),
    ]);

    return updatedRequest;
  }

  approveChangeRequest(callerId: string, requestId: string) {
    return this.decideChangeRequest(callerId, requestId, 'approved');
  }

  rejectChangeRequest(callerId: string, requestId: string) {
    return this.decideChangeRequest(callerId, requestId, 'rejected');
  }

  // Powers the Caretaker's admin panel - who currently holds each of the
  // four positions. Requires auth (any logged-in user) but isn't scoped to
  // the Caretaker only, matching "View current Secretary: Y" for everyone
  // in roles-permissions.md; the three D-011 additions follow the same
  // read-visibility since they're equally non-sensitive. rollNumber/
  // photoUrl (D-012) are that person's own self-reported values - never
  // set by this endpoint, just read.
  async getHostelDetail(hostelId: string) {
    const appointeeSelect = {
      id: true,
      name: true,
      email: true,
      rollNumber: true,
      photoUrl: true,
    } as const;

    const hostel = await this.prisma.hostel.findUnique({
      where: { id: hostelId },
      select: {
        id: true,
        code: true,
        name: true,
        sportsSecretary: { select: appointeeSelect },
        proctor: { select: appointeeSelect },
        gymSecretary: { select: appointeeSelect },
        messSecretary: { select: appointeeSelect },
      },
    });
    if (!hostel) {
      throw new NotFoundException('Hostel not found.');
    }
    return hostel;
  }
}
