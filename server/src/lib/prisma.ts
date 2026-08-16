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
        if ("endsWith" in filterValue && typeof itemValue === "string" && !itemValue.endsWith(filterValue.endsWith)) return false;
        if ("startsWith" in filterValue && typeof itemValue === "string" && !itemValue.startsWith(filterValue.startsWith)) return false;
        if ("in" in filterValue && Array.isArray(filterValue.in) && !filterValue.in.includes(itemValue)) return false;
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
    async createMany(args: any) {
      const list = memoryStore[storeKey];
      const items = Array.isArray(args?.data) ? args.data : [args?.data];
      let count = 0;
      for (const item of items) {
        if (!item) continue;
        const newItem = {
          id: item.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...item,
        };
        list.push(newItem);
        count++;
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

let realPrisma: any = null;
if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
  try {
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
      max: 10,
    });
    const adapter = new PrismaPg(pool);
    realPrisma = new PrismaClient({ adapter });
  } catch (err) {
    console.warn("[AttendX] Prisma init warning — fallback active:", err);
  }
}

export const prisma = new Proxy(
  {},
  {
    get(_, prop: string) {
      if (prop === "$connect" || prop === "$disconnect") {
        return async () => {};
      }
      if (prop === "$transaction") {
        return async (callbackOrArray: any, options?: any) => {
          if (realPrisma && typeof realPrisma.$transaction === "function") {
            try {
              return await realPrisma.$transaction(callbackOrArray, options);
            } catch (txErr: any) {
              console.warn("[AttendX] $transaction DB error, executing on in-memory proxy:", txErr?.message || txErr);
            }
          }
          if (typeof callbackOrArray === "function") {
            return await callbackOrArray(prisma);
          }
          if (Array.isArray(callbackOrArray)) {
            return await Promise.all(callbackOrArray);
          }
          return null;
        };
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
            const originalFn = (targetModel as any)[method];
            if (typeof originalFn !== "function") return (fallbackModel as any)[method];
            return async (...args: any[]) => {
              try {
                return await originalFn.apply(targetModel, args);
              } catch (dbError: any) {
                console.warn(`[AttendX] DB error on prisma.${prop}.${method}, using in-memory fallback:`, dbError?.message || dbError);
                if ((fallbackModel as any)[method]) {
                  return await (fallbackModel as any)[method](...args);
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
