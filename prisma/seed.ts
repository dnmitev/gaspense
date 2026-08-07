import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEFAULT_CATEGORIES, seedDefaultCategories } from "../lib/seed-categories";
import { PrismaClient } from "../lib/generated/prisma/client";

// Thin runner — the logic lives in lib/seed-categories.ts so integration tests
// can import it without executing a script.
//
// Run via tsx, not bare node: Prisma 7's generated client uses bundler-style
// extensionless internal imports that Node's own ESM loader cannot resolve.

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const inserted = await seedDefaultCategories(prisma);
    const total = await prisma.category.count({ where: { userId: null } });

    console.log(`seed: inserted ${inserted}; ${total} system defaults now present`);

    if (total !== DEFAULT_CATEGORIES.length) {
      throw new Error(
        `seed: expected ${DEFAULT_CATEGORIES.length} system categories, found ${total}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
