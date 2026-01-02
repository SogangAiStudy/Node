import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
// Prisma client re-imported after schema update
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma_fresh: PrismaClient | undefined;
};

const createPrismaClient = () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
};

export const prisma = globalForPrisma.prisma_fresh ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma_fresh = prisma;
