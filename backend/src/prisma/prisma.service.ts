import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Wraps PrismaClient as a NestJS provider so any module can inject it
 * instead of each module creating its own client. Connects when the app
 * starts, disconnects cleanly on shutdown.
 *
 * NOT YET VERIFIED - needs `npx prisma generate` to run first, which
 * needs the same engine binaries that failed to fetch in this sandbox.
 * This will only work once run in an environment with normal internet
 * access (i.e. your machine, not this one).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
