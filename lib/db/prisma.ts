import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
// Prisma client re-imported after schema update
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma_v3: PrismaClient | undefined;
};

const getConnectionString = () => {
  const rawConnectionString = process.env.DATABASE_URL;

  if (!rawConnectionString) {
    return rawConnectionString;
  }

  try {
    const connectionUrl = new URL(rawConnectionString);
    const isSupabasePooler =
      connectionUrl.hostname.endsWith(".pooler.supabase.com") ||
      (connectionUrl.hostname.startsWith("db.") &&
        connectionUrl.hostname.endsWith(".supabase.co") &&
        connectionUrl.port === "6543");

    if (isSupabasePooler) {
      if (!connectionUrl.searchParams.has("pgbouncer")) {
        connectionUrl.searchParams.set("pgbouncer", "true");
      }

      if (!connectionUrl.searchParams.has("connection_limit")) {
        connectionUrl.searchParams.set("connection_limit", "1");
      }
    }

    return connectionUrl.toString();
  } catch {
    return rawConnectionString;
  }
};

const createPrismaClient = () => {
  const pool = new Pool({
    connectionString: getConnectionString(),
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
};

export const prisma = globalForPrisma.prisma_v3 ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma_v3 = prisma;
