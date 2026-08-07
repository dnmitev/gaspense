import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 moved connection URLs out of prisma/schema.prisma and into this file —
// the datasource block no longer accepts `url` or `directUrl`.
//
// Local development points DATABASE_URL at the Docker Postgres in
// docker-compose.yml. See .env.example.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Run via tsx: Prisma 7's generated client uses bundler-style extensionless
    // imports that Node's own ESM loader cannot resolve.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    // Optional. Prisma creates a temporary shadow database to detect schema
    // drift during `migrate dev`; set this only if the main user lacks
    // permission to create databases (managed hosts sometimes do).
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
