import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Wraps PrismaClient as a NestJS provider so any module can inject it
 * instead of each module creating its own client. Connects when the app
 * starts, disconnects cleanly on shutdown.
 *
 * Prisma 7 requires an explicit driver adapter - it no longer connects
 * internally from just DATABASE_URL the way Prisma 6 did. See D-009 in
 * decision-log.md for the full story of what changed and why.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    // Optional - unset in dev/prod, so this changes nothing there (pg's
    // own default pool size applies). The e2e suite sets this (small) in
    // .env.test: five spec files, each booting its own Nest app, were
    // otherwise accumulating enough default-sized (max 10) connection
    // pools between them to stall near Postgres's own max_connections.
    const poolMax = config.get<string>('DATABASE_POOL_MAX');
    const adapter = new PrismaPg({
      connectionString: config.get<string>('DATABASE_URL'),
      ...(poolMax ? { max: Number(poolMax) } : {}),
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
