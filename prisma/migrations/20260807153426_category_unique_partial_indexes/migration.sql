-- Partial unique indexes for Category.
--
-- Prisma cannot express partial indexes in schema.prisma, and a plain
-- @@unique([userId, name]) would NOT work here: Postgres treats NULLs as
-- distinct in unique constraints, so two ("Fuel", NULL) rows would both be
-- allowed and `upsert` could never match on them. Hence raw SQL.

-- System defaults (userId IS NULL): the name alone must be unique. This is what
-- makes the category seed genuinely idempotent.
CREATE UNIQUE INDEX "Category_name_system_key"
  ON "Category" ("name")
  WHERE "userId" IS NULL;

-- A user's own categories: unique per user, and independent of the system set.
CREATE UNIQUE INDEX "Category_userId_name_key"
  ON "Category" ("userId", "name")
  WHERE "userId" IS NOT NULL;
