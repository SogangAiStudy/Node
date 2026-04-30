ALTER TABLE "nodes"
ADD COLUMN "parent_node_id" TEXT;

ALTER TABLE "nodes"
ADD CONSTRAINT "nodes_parent_node_id_fkey"
FOREIGN KEY ("parent_node_id") REFERENCES "nodes"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "nodes_parent_node_id_idx" ON "nodes"("parent_node_id");
