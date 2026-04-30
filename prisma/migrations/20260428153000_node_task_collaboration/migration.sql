-- Add task-page collaboration primitives for production team workflows.
CREATE TABLE "node_pages" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "content_markdown" TEXT NOT NULL DEFAULT '',
    "updated_by_user_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "node_pages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "node_comments" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "node_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "node_attachments" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_attachments_pkey" PRIMARY KEY ("id")
);

INSERT INTO "node_pages" ("id", "nodeId", "orgId", "projectId", "content_markdown", "updated_by_user_id", "createdAt", "updatedAt")
SELECT
    concat('node_page_', "id"),
    "id",
    "orgId",
    "projectId",
    COALESCE("description", ''),
    NULL,
    "createdAt",
    "updatedAt"
FROM "nodes"
WHERE COALESCE("description", '') <> '';

CREATE UNIQUE INDEX "node_pages_nodeId_key" ON "node_pages"("nodeId");
CREATE UNIQUE INDEX "node_attachments_storage_key_key" ON "node_attachments"("storage_key");

CREATE INDEX "node_pages_orgId_idx" ON "node_pages"("orgId");
CREATE INDEX "node_pages_projectId_idx" ON "node_pages"("projectId");
CREATE INDEX "node_pages_updated_by_user_id_idx" ON "node_pages"("updated_by_user_id");
CREATE INDEX "node_comments_nodeId_idx" ON "node_comments"("nodeId");
CREATE INDEX "node_comments_orgId_idx" ON "node_comments"("orgId");
CREATE INDEX "node_comments_projectId_idx" ON "node_comments"("projectId");
CREATE INDEX "node_comments_author_id_idx" ON "node_comments"("author_id");
CREATE INDEX "node_attachments_nodeId_idx" ON "node_attachments"("nodeId");
CREATE INDEX "node_attachments_orgId_idx" ON "node_attachments"("orgId");
CREATE INDEX "node_attachments_projectId_idx" ON "node_attachments"("projectId");
CREATE INDEX "node_attachments_uploaded_by_idx" ON "node_attachments"("uploaded_by");

ALTER TABLE "node_pages"
ADD CONSTRAINT "node_pages_nodeId_fkey"
FOREIGN KEY ("nodeId") REFERENCES "nodes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "node_pages"
ADD CONSTRAINT "node_pages_updated_by_user_id_fkey"
FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "node_comments"
ADD CONSTRAINT "node_comments_nodeId_fkey"
FOREIGN KEY ("nodeId") REFERENCES "nodes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "node_comments"
ADD CONSTRAINT "node_comments_author_id_fkey"
FOREIGN KEY ("author_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "node_attachments"
ADD CONSTRAINT "node_attachments_nodeId_fkey"
FOREIGN KEY ("nodeId") REFERENCES "nodes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "node_attachments"
ADD CONSTRAINT "node_attachments_uploaded_by_fkey"
FOREIGN KEY ("uploaded_by") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
