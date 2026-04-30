-- Alter teams to track canonical default-team status.
ALTER TABLE "teams"
ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false;

UPDATE "teams"
SET "is_default" = true
WHERE "name" = 'Default Team';

-- Persist invite roles so project invites can grant viewer/editor/admin explicitly.
ALTER TABLE "project_invites"
ADD COLUMN "role" "ProjectRole" NOT NULL DEFAULT 'EDITOR';

-- Migrate request team targeting from legacy team-name strings to stable team IDs.
ALTER TABLE "requests"
ADD COLUMN "target_team_id" TEXT;

UPDATE "requests" AS r
SET "target_team_id" = t."id"
FROM "teams" AS t
WHERE r."target_team_id" IS NULL
  AND r."toTeam" IS NOT NULL
  AND t."orgId" = r."orgId"
  AND t."name" = r."toTeam";

CREATE INDEX "requests_target_team_id_idx" ON "requests"("target_team_id");

ALTER TABLE "requests"
ADD CONSTRAINT "requests_target_team_id_fkey"
FOREIGN KEY ("target_team_id") REFERENCES "teams"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
