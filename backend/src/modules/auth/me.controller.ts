import { Controller, Get, NotFoundException, Req, UseGuards } from '@nestjs/common';
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
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const [caretakerOfHostels, secretaryOfHostels] = await Promise.all([
      this.prisma.hostel.findMany({
        where: { caretakerUserId: user.id },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.hostel.findMany({
        where: { sportsSecretaryUserId: user.id },
        select: { id: true, code: true, name: true },
      }),
    ]);

    return {
      ...user,
      caretakerOfHostels,
      secretaryOfHostels,
    };
  }
}
