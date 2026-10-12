import {
  Controller,
  Get,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';

/**
 * This is the actual role-check for the whole app. There is no stored
 * "role" field anywhere - a user's capabilities are always computed fresh
 * from relationships (is their id a Hostel's caretakerUserId? Its
 * sportsSecretaryUserId?), per FR-002 and D-006 (scoped checks, not a
 * hierarchy). The frontend decides which dashboard to render purely from
 * this response.
 */
@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: AuthenticatedRequest) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        hostelId: true,
        isSportsAdmin: true,
        secretaryWelcomeShown: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const [hostel, caretakerOfHostels, secretaryOfHostels] = await Promise.all([
      user.hostelId
        ? this.prisma.hostel.findUnique({
            where: { id: user.hostelId },
            select: { id: true, code: true, name: true },
          })
        : null,
      this.prisma.hostel.findMany({
        where: { caretakerUserId: user.id },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.hostel.findMany({
        where: { sportsSecretaryUserId: user.id },
        select: { id: true, code: true, name: true },
      }),
    ]);

    // D-013: computed, not the raw column - true exactly once, the first
    // time a newly-appointed Secretary's own dashboard loads.
    const showSecretaryWelcome =
      secretaryOfHostels.length > 0 && !user.secretaryWelcomeShown;

    const { secretaryWelcomeShown, ...publicUser } = user;
    void secretaryWelcomeShown; // intentionally not part of the response - see above

    return {
      ...publicUser,
      hostel,
      caretakerOfHostels,
      secretaryOfHostels,
      showSecretaryWelcome,
    };
  }

  // D-013: fire-and-forget from the Secretary dashboard, once it's shown
  // the congratulations banner - flips the flag so it never shows again
  // for this account (known limitation: this is an ever-boolean, not
  // tied to any specific appointment - see decision-log.md D-013).
  @Post('acknowledge-secretary-welcome')
  @UseGuards(JwtAuthGuard)
  async acknowledgeSecretaryWelcome(@Req() req: AuthenticatedRequest) {
    if (!req.userId) {
      throw new UnauthorizedException('Missing authorization token.');
    }
    await this.prisma.user.update({
      where: { id: req.userId },
      data: { secretaryWelcomeShown: true },
    });
    return { acknowledged: true };
  }
}
