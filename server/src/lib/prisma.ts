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
        if ("equals" in value && item[key] !== value.equals) return false;
        if ("endsWith" in value && typeof item[key] === "string" && !item[key].endsWith(value.endsWith)) return false;
        if ("startsWith" in value && typeof item[key] === "string" && !item[key].startsWith(value.startsWith)) return false;
        if ("in" in value && Array.isArray(value.in) && !value.in.includes(item[key])) return false;
        continue;
      }
      if (item[key] !== value) return false;
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

let realPrisma: any = null;
if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
        return realPrisma[prop].bind(realPrisma);
      }
      if (realPrisma && realPrisma[prop]) {
        // Wrap model calls to catch runtime DB connection errors
        const model = realPrisma[prop];
        const fallbackModel = createInMemoryModelHandler(prop);
        return new Proxy(model, {
          get(targetModel, method: string) {
            const originalFn = targetModel[method];
            if (typeof originalFn !== "function") return fallbackModel[method];
            return async (...args: any[]) => {
              try {
                return await originalFn.apply(targetModel, args);
              } catch (dbError: any) {
                console.warn(`[AI Studio] DB error on prisma.${prop}.${method}, using in-memory fallback:`, dbError?.message || dbError);
                if (fallbackModel[method]) {
                  return await fallbackModel[method](...args);
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
