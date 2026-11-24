import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __hesabdariPool?: Pool;
  __hesabdariDb?: NodePgDatabase;
};

export function getDb(): NodePgDatabase {
  if (globalForDb.__hesabdariDb) return globalForDb.__hesabdariDb;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const pool =
    globalForDb.__hesabdariPool ??
    new Pool({
      connectionString: databaseUrl,
    });

  const instance = drizzle(pool);
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__hesabdariPool = pool;
    globalForDb.__hesabdariDb = instance;
  }
  return instance;
}
