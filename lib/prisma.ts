import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Prisma 7 requires a driver adapter (or Prisma Accelerate) — the client can no
// longer read a connection URL from the schema, because `datasource.url` moved to
// prisma.config.ts and is used only by the CLI.
//
// This is also the lever for the project's recorded serverless connection-pooling
// concern: PrismaPg accepts a pg.Pool or PoolConfig, so pool sizing can be tuned
// here when the app is actually deployed.
//
// DATABASE_URL is deliberately NOT validated at module scope. Throwing here would
// fail `next build` in any environment without a database, even though the build
// never opens a connection. A missing URL surfaces as a clear connection error on
// first query instead.
function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// Cache the client on globalThis outside production. Next's dev server
// hot-reloads modules on every edit, and without this each reload would
// construct a new client and exhaust the database's connection pool.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
