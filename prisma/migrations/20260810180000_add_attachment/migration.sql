-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "carId" TEXT,
    "expenseId" TEXT,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");

-- CreateIndex
CREATE INDEX "Attachment_carId_idx" ON "Attachment"("carId");

-- CreateIndex
CREATE INDEX "Attachment_expenseId_idx" ON "Attachment"("expenseId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Exactly one owner, enforced by the database.
--
-- Prisma cannot express a CHECK constraint, so this is hand-written — the same
-- reason the category partial unique indexes live in raw SQL (see
-- 20260807153426_category_unique_partial_indexes).
--
-- Without it, "an attachment belongs to a car OR an expense" is a comment, and
-- a comment does not reject a row with both set or neither. `num_nonnulls` is
-- Postgres' own counter, so the rule reads as what it means.
ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_exactly_one_owner"
  CHECK (num_nonnulls("carId", "expenseId") = 1);
