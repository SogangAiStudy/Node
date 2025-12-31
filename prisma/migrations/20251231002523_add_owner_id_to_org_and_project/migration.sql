/*
  Warnings:

  - Added the required column `ownerId` to the `organizations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ownerId` to the `projects` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: Add ownerId as nullable columns
ALTER TABLE "organizations" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "projects" ADD COLUMN "ownerId" TEXT;

-- Step 2: Set ownerId for existing organizations
-- Set to the first ADMIN user in each organization
UPDATE "organizations" o
SET "ownerId" = (
  SELECT "userId"
  FROM "org_members" om
  WHERE om."orgId" = o."id" AND om."role" = 'ADMIN'
  LIMIT 1
);

-- Step 3: Set ownerId for existing projects (if any)
-- Set to the organization owner
UPDATE "projects" p
SET "ownerId" = (
  SELECT "ownerId"
  FROM "organizations" o
  WHERE o."id" = p."orgId"
);

-- Step 4: Make ownerId non-nullable
ALTER TABLE "organizations" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "ownerId" SET NOT NULL;

-- Step 5: Create indexes
CREATE INDEX "organizations_ownerId_idx" ON "organizations"("ownerId");
CREATE INDEX "projects_ownerId_idx" ON "projects"("ownerId");

-- Step 6: Add foreign key constraints
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
