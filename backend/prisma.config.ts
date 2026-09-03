// Prisma 7 moved the database connection URL out of schema.prisma and into
// this file. If this project is ever upgraded further and this breaks
// again, check https://www.prisma.io/docs/guides/upgrade-prisma-orm for
// what changed - don't guess, that's how this file's shape was found.

import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});