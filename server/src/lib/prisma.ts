import { PrismaClient } from "@prisma/client";

// In-Memory Storage for Fallback
const memoryStore: Record<string, any[]> = {
  users: [],
  refreshTokens: [],
  semesters: [],
  subjects: [],
  timetableSlots: [],
  timetableOverrides: [],
  attendance: [],
  classrooms: [],
  classroomMembers: [],
  events: [],
  announcements: [],
  assignments: [],
  assignmentCompletions: [],
  notes: [],
  exports: [],
  notificationPreferences: [],
};

const mapModelToKey = (model: string): string => {
  if (model === "user") return "users";
  if (model === "refreshToken") return "refreshTokens";
  if (model === "semester") return "semesters";
  if (model === "subject") return "subjects";
  if (model === "timetableSlot") return "timetableSlots";
  if (model === "timetableOverride") return "timetableOverrides";
  if (model === "attendance") return "attendance";
  if (model === "classroom") return "classrooms";
  if (model === "classroomMember") return "classroomMembers";
  if (model === "event") return "events";
  if (model === "announcement") return "announcements";
  if (model === "assignment") return "assignments";
  if (model === "assignmentCompletion") return "assignmentCompletions";
  if (model === "note") return "notes";
  if (model === "export") return "exports";
  if (model === "notificationPreferences") return "notificationPreferences";
  return model.endsWith("s") ? model : `${model}s`;
};

function createInMemoryModelHandler(modelName: string) {
  const storeKey = mapModelToKey(modelName);
  if (!memoryStore[storeKey]) {
    memoryStore[storeKey] = [];
  }

  const matchesWhere = (item: any, where: any): boolean => {
    if (!where || typeof where !== "object") return true;
    for (const [key, value] of Object.entries(where)) {
      if (value === undefined) continue;
      if (key === "OR" && Array.isArray(value)) {
        return value.some((cond) => matchesWhere(item, cond));
      }
      if (key === "AND" && Array.isArray(value)) {
        return value.every((cond) => matchesWhere(item, cond));
      }
      if (typeof value === "object" && value !== null) {
        const itemValue = (item as any)[key];
        const filterValue = value as any;
        if ("equals" in filterValue && itemValue !== filterValue.equals) return false;
        if ("not" in filterValue) {
          if (filterValue.not === null ? (itemValue === null || itemValue === undefined) : itemValue === filterValue.not) return false;
        }
        if ("endsWith" in filterValue && typeof itemValue === "string" && !itemValue.endsWith(filterValue.endsWith)) return false;
        if ("startsWith" in filterValue && typeof itemValue === "string" && !itemValue.startsWith(filterValue.startsWith)) return false;
        if ("in" in filterValue && Array.isArray(filterValue.in) && !filterValue.in.includes(itemValue)) return false;
        if ("gte" in filterValue && !(itemValue >= filterValue.gte)) return false;
        if ("gt" in filterValue && !(itemValue > filterValue.gt)) return false;
        if ("lte" in filterValue && !(itemValue <= filterValue.lte)) return false;
        if ("lt" in filterValue && !(itemValue < filterValue.lt)) return false;
        continue;
      }
      if ((item as any)[key] !== value) return false;
    }
    return true;
  };

  return {
    async findUnique(args: any) {
      const list = memoryStore[storeKey];
      return list.find((item) => matchesWhere(item, args?.where)) || null;
    },
    async findFirst(args: any) {
      const list = memoryStore[storeKey];
      return list.find((item) => matchesWhere(item, args?.where)) || null;
    },
    async findMany(args: any) {
      const list = memoryStore[storeKey];
      let results = list.filter((item) => matchesWhere(item, args?.where));
      if (args?.take) {
        results = results.slice(0, args.take);
      }
      return results;
    },
    async create(args: any) {
      const list = memoryStore[storeKey];
      const newItem = {
        id: args?.data?.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...(args?.data || {}),
      };
      list.push(newItem);
      return newItem;
    },
    async update(args: any) {
      const list = memoryStore[storeKey];
      const index = list.findIndex((item) => matchesWhere(item, args?.where));
      if (index === -1) return null;
      list[index] = {
        ...list[index],
        ...(args?.data || {}),
        updatedAt: new Date(),
      };
      return list[index];
    },
    async updateMany(args: any) {
      const list = memoryStore[storeKey];
      let count = 0;
      for (let i = 0; i < list.length; i++) {
        if (matchesWhere(list[i], args?.where)) {
          list[i] = {
            ...list[i],
            ...(args?.data || {}),
            updatedAt: new Date(),
          };
          count++;
        }
      }
      return { count };
    },
    async upsert(args: any) {
      const existing = await this.findFirst({ where: args?.where });
      if (existing) {
        return this.update({ where: args?.where, data: args?.update });
      } else {
        return this.create({ data: { ...args?.where, ...args?.create } });
      }
    },
    async delete(args: any) {
      const list = memoryStore[storeKey];
      const index = list.findIndex((item) => matchesWhere(item, args?.where));
      if (index === -1) return null;
      const [removed] = list.splice(index, 1);
      return removed;
    },
    async deleteMany(args: any) {
      const list = memoryStore[storeKey];
      const initialCount = list.length;
      memoryStore[storeKey] = list.filter((item) => !matchesWhere(item, args?.where));
      return { count: initialCount - memoryStore[storeKey].length };
    },
    async count(args: any) {
      const list = memoryStore[storeKey];
      return list.filter((item) => matchesWhere(item, args?.where)).length;
    },
  };
}

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const isTransientConnectionError = (dbError: any): boolean => {
  if (!dbError) return false;
  const code = String(dbError?.code || dbError?.cause?.code || "");
  const msg = `${dbError?.message || ""} ${dbError?.cause?.message || ""}`.toLowerCase();
  return (
    code.startsWith("P1") ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "EPIPE" ||
    code === "57P01" ||
    msg.includes("connection") ||
    msg.includes("timeout") ||
    msg.includes("terminated unexpectedly") ||
    msg.includes("network") ||
    msg.includes("socket")
  );
};

let realPrisma: any = null;
if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
  try {
    let connStr = process.env.DATABASE_URL.trim();
    if (!connStr.includes("uselibpqcompat=")) {
      connStr = connStr.replace(/sslmode=(require|prefer|verify-ca)\b/g, "sslmode=verify-full");
    }
    // Strip channel_binding=require on Neon PgBouncer (-pooler) endpoints to avoid extra SCRAM-SHA-256-PLUS WAN round-trips
    if (connStr.includes("-pooler")) {
      connStr = connStr
        .replace(/([?&])channel_binding=require(&|$)/g, (_, p1, p2) => (p2 === "&" ? p1 : ""))
        .replace(/[?&]$/, "");
    }
    const pool = new Pool({
      connectionString: connStr,
      keepAlive: true,
      keepAliveInitialDelayMillis: 5000,
      min: 2,
      max: 8,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 20000,
      maxUses: 500,
    });
    pool.on("error", (err) => {
      console.warn("[pg] Idle client error (evicted from pool):", err.message);
    });
    // Pre-warm 2 pooled connections on startup so the first wave of requests never waits on cold TLS handshakes
    Promise.all([pool.connect(), pool.connect()])
      .then((clients) => clients.forEach((c) => c.release()))
      .catch(() => {});
    // Keep pooled Neon connections warm with a lightweight 20s heartbeat
    setInterval(() => {
      pool.query("SELECT 1").catch(() => {});
    }, 20000).unref();
    const adapter = new PrismaPg(pool);
    realPrisma = new PrismaClient({ adapter });
  } catch (err) {
    console.warn("[AI Studio] Prisma init warning — fallback active:", err);
  }
}

export const prisma = new Proxy(
  {},
  {
    get(_, prop: string) {
      if (prop === "$connect" || prop === "$disconnect") {
        return async () => {};
      }
      if (realPrisma && typeof realPrisma[prop] === "function") {
        const boundFn = realPrisma[prop].bind(realPrisma);
        return async (...args: any[]) => {
          try {
            return await boundFn(...args);
          } catch (dbError: any) {
            if (isTransientConnectionError(dbError)) {
              await new Promise((r) => setTimeout(r, 200));
              return await boundFn(...args);
            }
            throw dbError;
          }
        };
      }
      if (realPrisma && realPrisma[prop]) {
        // Wrap model calls to retry transient DB connection drops on a fresh pooled socket
        const model = realPrisma[prop];
        const fallbackModel = createInMemoryModelHandler(prop);
        return new Proxy(model, {
          get(targetModel, method: string) {
            const originalFn = (targetModel as any)[method];
            if (typeof originalFn !== "function") return (fallbackModel as any)[method];
            return async (...args: any[]) => {
              try {
                return await originalFn.apply(targetModel, args);
              } catch (dbError: any) {
                if (dbError?.code === 'ECONNREFUSED' || (dbError.message && dbError.message.includes('ECONNREFUSED'))) {
                  throw new Error("CRITICAL: Database connection refused (ECONNREFUSED). Your PostgreSQL server is offline or unreachable.");
                }

                if (isTransientConnectionError(dbError)) {
                  // Retry up to 2 times on a fresh pooled connection
                  for (const delayMs of [200, 500]) {
                    try {
                      await new Promise((r) => setTimeout(r, delayMs));
                      return await originalFn.apply(targetModel, args);
                    } catch (retryError: any) {
                      dbError = retryError;
                      if (!isTransientConnectionError(dbError)) break;
                    }
                  }
                }
                throw dbError;
              }
            };
          },
        });
      }
      return createInMemoryModelHandler(prop);
    },
  }
) as unknown as PrismaClient;

export default prisma;
