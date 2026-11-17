import { create } from "zustand";
import { capacitorStorage } from "./capacitorStorage";
import { persist, createJSONStorage } from "zustand/middleware";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useAuthStore } from "./authStore";

export interface QueuedRequest {
  id: string;
  tempId?: string;
  method: string;
  url: string;
  data?: any;
  headers?: any;
  timestamp: number;
  retryCount?: number;
  lastAttempt?: number;
}

interface OfflineState {
  queue: QueuedRequest[];
  enqueue: (req: Omit<QueuedRequest, "id" | "timestamp">) => void;
  dequeue: (id: string) => void;
  clearQueue: () => void;
  isSyncing: boolean;
  flushQueue: () => Promise<void>;
}
// Real-time cross-tab synchronization channel
const syncChannel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("attendx_offline_sync")
    : null;

let syncWatchdogTimer: any = null;
let isFlushingMutex = false;

const broadcastQueueUpdate = (queue: QueuedRequest[]) => {
  if (syncChannel) {
    syncChannel.postMessage({ type: "QUEUE_UPDATED", queue });
  }
  window.dispatchEvent(
    new CustomEvent("offline-queue-changed", { detail: { queue } }),
  );
};

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      queue: [],
      isSyncing: false,
      enqueue: (req) => {
        set((state) => {
          const isToggleAction = /\/toggle\b|\/complete\b/.test(req.url || "");
          const existingIdx = isToggleAction
            ? -1
            : state.queue.findIndex(
                (q) =>
                  q.method === req.method &&
                  q.url === req.url &&
                  JSON.stringify(q.data) === JSON.stringify(req.data),
              );
          if (existingIdx !== -1) {
            const nextQueue = [...state.queue];
            nextQueue[existingIdx] = {
              ...nextQueue[existingIdx],
              ...req,
              timestamp: Date.now(),
            };
            broadcastQueueUpdate(nextQueue);
            return { queue: nextQueue };
          }
          const nextQueue = [
            ...state.queue,
            {
              ...req,
              id: Math.random().toString(36).substring(7),
              timestamp: Date.now(),
            },
          ];
          broadcastQueueUpdate(nextQueue);
          return {
            queue: nextQueue,
          };
        });
        if (typeof navigator !== "undefined" && navigator.onLine) {
          setTimeout(() => {
            useOfflineStore.getState().flushQueue();
          }, 2500);
        }
      },
      dequeue: (id) => {
        set((state) => {
          const nextQueue = state.queue.filter((req) => req.id !== id);
          broadcastQueueUpdate(nextQueue);
          return { queue: nextQueue };
        });
      },
      clearQueue: () => {
        clearTimeout(syncWatchdogTimer);
        broadcastQueueUpdate([]);
        set({ queue: [], isSyncing: false });
      },
      flushQueue: async () => {
        const { queue, isSyncing, dequeue } = get();
        if (isSyncing || isFlushingMutex || queue.length === 0) return;
        isFlushingMutex = true;
        set({ isSyncing: true });

        // Safety watchdog: Automatically release lock if sync hangs or freezes
        clearTimeout(syncWatchdogTimer);
        syncWatchdogTimer = setTimeout(() => {
          if (useOfflineStore.getState().isSyncing || isFlushingMutex) {
            console.warn("[offlineStore] Sync deadlock watchdog triggered - releasing lock");
            isFlushingMutex = false;
            useOfflineStore.setState({ isSyncing: false });
          }
        }, 15000);
        // Pre-Flight Check: Never replay if the backend server is offline or restarting
        let isBackendReachable = false;
        try {
          const check = await api.get("/health", {
            timeout: 1500,
            headers: { "X-Offline-Retry": "true" },
          } as any);
          isBackendReachable = check.status === 200;
        } catch {
          isBackendReachable = false;
        }

        if (!isBackendReachable) {
          console.log(
            "%c[offlineStore] ⏸️ Backend is unreachable / offline. Queue safely preserved in storage.",
            "color: #f59e0b; font-weight: bold;"
          );
          isFlushingMutex = false;
          set({ isSyncing: false });
          clearTimeout(syncWatchdogTimer);
          return;
        }

        console.group(
          `%c[AttendX Sync Engine] 🔄 Reconnected • Processing ${queue.length} Queued Action(s)`,
          "background: #0284c7; color: #ffffff; font-weight: bold; padding: 4px 8px; border-radius: 4px;",
        );

        let successCount = 0;
        let conflictCount = 0;
        const syncedItems: Array<{ id: string; method: string; url: string; summary: string }> = [];

        try {
          // Deduplicate onboarding-status and identical duplicate mutations (preserving toggle sequences)
          const seenSignatures = new Set<string>();
          const deduplicatedQueue: QueuedRequest[] = [];
          for (let i = queue.length - 1; i >= 0; i--) {
            const req = queue[i];
            const isToggleAction = /\/toggle\b|\/complete\b/.test(req.url || "");
            const sig = `${req.method}:${req.url}:${JSON.stringify(req.data || {})}`;
            if (
              req.url?.includes("/users/onboarding-status") &&
              seenSignatures.has("onboarding")
            ) {
              dequeue(req.id);
              continue;
            }
            if (req.url?.includes("/users/onboarding-status"))
              seenSignatures.add("onboarding");
            if (!isToggleAction && seenSignatures.has(sig)) {
              dequeue(req.id);
              continue;
            }
            if (!isToggleAction) {
              seenSignatures.add(sig);
            }
            deduplicatedQueue.unshift(req);
          }

          // 1. Queue Compaction: drop mutually cancelling creates, dependents, and deletes performed offline
          // e.g. An assignment, subject, slot, or extra class created offline (with tempId) and later deleted offline
          const deletedTempIds = new Set<string>();
          for (const req of deduplicatedQueue) {
            if (req.method?.toLowerCase() === "delete") {
              const match = req.url.match(/(temp[-_][a-zA-Z0-9_-]+)/);
              if (match) {
                deletedTempIds.add(match[1]);
              }
            }
          }

          const compactedQueue: QueuedRequest[] = [];
          if (deletedTempIds.size > 0) {
            for (const req of deduplicatedQueue) {
              const match = req.url.match(/(temp[-_][a-zA-Z0-9_-]+)/);
              const urlTemp = match ? match[1] : null;
              const isCreatedWithDeletedTemp = Boolean(
                req.tempId && deletedTempIds.has(req.tempId),
              );
              const isTargetingDeletedTemp = Boolean(
                urlTemp && deletedTempIds.has(urlTemp),
              );
              const dataRefs = [
                req.data?.subjectId,
                req.data?.timetableSlotId,
                req.data?.overrideId,
                req.data?.assignmentId,
                req.data?.semesterId,
              ].filter((v) => typeof v === "string");
              const referencesDeletedTemp = dataRefs.some((v) =>
                deletedTempIds.has(v),
              );

              if (
                isCreatedWithDeletedTemp ||
                isTargetingDeletedTemp ||
                referencesDeletedTemp
              ) {
                dequeue(req.id);
                continue;
              }
              compactedQueue.push(req);
            }
          } else {
            compactedQueue.push(...deduplicatedQueue);
          }

          // 2. Dynamic ID Mapping to resolve foreign key relationships across sequential replays (Zero P2003 FK errors)
          const idMap = new Map<string, string>();
          const now = Date.now();

          // Process compacted queue in sequential order
          for (const req of compactedQueue) {
            // Respect exponential backoff on previously failed 500s/timeouts
            if (req.lastAttempt && (req.retryCount || 0) > 0) {
              const backoffMs = Math.min(30000, Math.pow(2, req.retryCount || 1) * 2000);
              if (now - req.lastAttempt < backoffMs) {
                continue;
              }
            }
            try {
              let resolvedUrl = req.url;
              let resolvedData = req.data;
              // Prevent accidental /api/api double prefix if URL already has /api
              if (resolvedUrl.startsWith("/api/")) {
                resolvedUrl = resolvedUrl.replace(/^\/api/, "");
              }

              // Substitute any known temporary IDs in URL and payload
              if (idMap.size > 0) {
                for (const [tempId, realId] of idMap.entries()) {
                  if (resolvedUrl.includes(tempId)) {
                    resolvedUrl = resolvedUrl.split(tempId).join(realId);
                  }
                }

                if (resolvedData) {
                  try {
                    let dataStr = JSON.stringify(resolvedData);
                    let changed = false;
                    for (const [tempId, realId] of idMap.entries()) {
                      if (dataStr.includes(tempId)) {
                        dataStr = dataStr.split(tempId).join(realId);
                        changed = true;
                      }
                    }
                    if (changed) {
                      resolvedData = JSON.parse(dataStr);
                    }
                  } catch (e) {
                    console.warn(
                      "[offlineStore] Failed to replace temp IDs in payload:",
                      e,
                    );
                  }
                }
              }
              console.log(
                `%c[Replaying #${successCount + 1}] %c${req.method.toUpperCase()} %c${resolvedUrl}`,
                "color: #a855f7; font-weight: bold;",
                "color: #38bdf8; font-weight: bold;",
                "color: #e2e8f0;",
                { payload: resolvedData, tempId: req.tempId },
              );

              const freshToken = useAuthStore.getState().accessToken;
              const res = await api.request({
                method: req.method,
                url: resolvedUrl,
                data: resolvedData,
                timeout: 8000,
                headers: {
                  ...req.headers,
                  "X-Offline-Retry": "true",
                  ...(freshToken ? { Authorization: `Bearer ${freshToken}` } : {}),
                },
              });

              console.log(
                `%c[Accepted] ✅ Server synced %c${req.method.toUpperCase()} ${resolvedUrl}`,
                "color: #22c55e; font-weight: bold;",
                "color: #94a3b8;",
              );

              dequeue(req.id);
              successCount++;

              const summary = req.data?.status
                ? `Status: ${req.data.status}${req.data.date ? ` • ${req.data.date}` : ""}`
                : resolvedUrl;

              syncedItems.push({
                id: req.id,
                method: req.method.toUpperCase(),
                url: resolvedUrl,
                summary,
              });

              // Harvest created real ID (e.g. CUID from Prisma across wrapped or array responses)
              const resData = res.data;
              const realId =
                resData?.id ||
                resData?._id ||
                resData?.semester?.id ||
                resData?.subject?.id ||
                resData?.assignment?.id ||
                resData?.slot?.id ||
                resData?.override?.id ||
                resData?.extraClass?.id ||
                (Array.isArray(resData?.events) && resData.events[0]?.id) ||
                resData?.data?.id;

              if (realId && typeof realId === "string") {
                if (req.tempId && req.tempId !== realId) {
                  idMap.set(req.tempId, realId);
                }
                if (req.data?.tempId && req.data.tempId !== realId) {
                  idMap.set(req.data.tempId, realId);
                }
                if (
                  req.data?.id &&
                  typeof req.data.id === "string" &&
                  /^temp[-_]/.test(req.data.id) &&
                  req.data.id !== realId
                ) {
                  idMap.set(req.data.id, realId);
                }
              }
              if (
                Array.isArray(req.data?.clientTempIds) &&
                Array.isArray(resData?.events)
              ) {
                req.data.clientTempIds.forEach((cid: any, idx: number) => {
                  const evId = resData.events[idx]?.id;
                  if (typeof cid === "string" && typeof evId === "string" && cid !== evId) {
                    idMap.set(cid, evId);
                  }
                });
              }
            } catch (err: any) {
              const status = err.response?.status;
              const isDelete = req.method?.toLowerCase() === "delete";

              // 1. Detect if the server is offline, down, or unreachable
              const isServerUnavailable =
                !err.response ||
                err.code === "ECONNABORTED" ||
                err.code === "ERR_NETWORK" ||
                err.message === "Network Error" ||
                (err.message && err.message.toLowerCase().includes("timeout")) ||
                status === 502 ||
                status === 503 ||
                status === 504 ||
                status === 0;

              if (isServerUnavailable) {
                console.warn(
                  `%c[Server Offline] ⏸️ Sync paused at ${req.method.toUpperCase()} ${req.url} (Server unreachable: ${status || err.code || "No response"}). Queue preserved safely.`,
                  "background: #ea580c; color: #ffffff; font-weight: bold; padding: 3px 6px; border-radius: 3px;",
                  err?.message || err,
                );
                // Pause replay immediately, NEVER drop, NEVER increment conflictCount
                console.groupEnd();
                break;
              }

              // 2. Only drop if the active server explicitly rejected with a 4xx client error (400, 403, 404, 409)
              const isClientError =
                status && status >= 400 && status < 500 && status !== 429 && status !== 401;
              const isAlreadyGone = status === 404 && isDelete;

              if (isClientError || isAlreadyGone) {
                dequeue(req.id);
                if (!isAlreadyGone) {
                  conflictCount++;
                }
              } else if (status === 401) {
                // Auth expired - pause queue and let silent refresh or user login handle it
                console.warn("[offlineStore] 401 Unauthorized encountered during replay. Pausing queue.");
                console.groupEnd();
                break;
              } else {
                // 3. Persistent 500 internal server error on an active backend
                const nextRetry = (req.retryCount || 0) + 1;
                if (nextRetry >= 10) {
                  console.warn(
                    `%c[Unblocking Queue] ⚠️ Dropping mutation after ${nextRetry} consecutive 500 crashes: ${req.method.toUpperCase()} ${req.url}`,
                    "background: #dc2626; color: #ffffff; font-weight: bold; padding: 3px 6px; border-radius: 3px;",
                    err?.message || err,
                  );
                  dequeue(req.id);
                  conflictCount++;
                } else {
                  set((state) => {
                    const nextQ = state.queue.map((q) =>
                      q.id === req.id
                        ? { ...q, retryCount: nextRetry, lastAttempt: Date.now() }
                        : q,
                    );
                    broadcastQueueUpdate(nextQ);
                    return { queue: nextQ };
                  });
                  console.groupEnd();
                  break;
                }
              }
            }
          }

          if (conflictCount > 0) {
            toast.error(
              `${conflictCount} offline action(s) were rejected by the server and rolled back.`,
            );
          } else if (successCount > 0) {
            try {
              const { triggerDynamicHUD } = await import(
                "../components/ui/dynamic-island-hud"
              );
              triggerDynamicHUD({
                type: "success",
                title: "Offline Synced",
                subtitle: `Synced ${successCount} offline action(s) • ${syncedItems[0]?.summary || "Updated"}`,
                durationMs: 4500,
              });
            } catch {}

            const firstSummary = syncedItems[0]?.summary
              ? ` (${syncedItems[0].summary})`
              : "";
            toast.success(
              `Synced ${successCount} offline action(s) with server!${firstSummary}`,
              { id: "offline-sync", duration: 5000 },
            );
          }

          // Broadcast sync completion event across tabs and to local listeners
          if (syncChannel && (successCount > 0 || conflictCount > 0)) {
            syncChannel.postMessage({
              type: "SYNC_COMPLETED",
              successCount,
              conflictCount,
              syncedItems,
            });
          }

          window.dispatchEvent(
            new CustomEvent("offline-sync-completed", {
              detail: {
                successCount,
                conflictCount,
                syncedItems,
                isCrossTab: false,
              },
            }),
          );

          // If we mutated anything (success or dropped conflict), force UI and stores to refresh
          if (successCount > 0 || conflictCount > 0) {
            try {
              const [{ useCacheStore }, { useAttendanceStore }] = await Promise.all([
                import("./cacheStore"),
                import("./attendanceStore"),
              ]);
              const cache = useCacheStore.getState();
              // Clear potentially stale snapshots so pages pull authoritative post-flush data
              useCacheStore.setState({
                calendar: {},
                today: {},
                subject_logs: {},
                all_logs: null,
                insights: null,
                mutationVersion: (cache.mutationVersion || 0) + 1,
              });
              const nowLocal = new Date();
              const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, "0")}-${String(nowLocal.getDate()).padStart(2, "0")}`;
              const touchedAssignments = syncedItems.some((s) =>
                s.url.includes("/assignments"),
              );
              await Promise.allSettled([
                useAttendanceStore.getState().fetchStats(true),
                api
                  .get(`/attendance/today?date=${todayStr}`, {
                    silent: true,
                    skipToast: true,
                  } as any)
                  .then((todayRes) => {
                    if (todayRes?.data && Array.isArray(todayRes.data.agenda)) {
                      const prevToday = useCacheStore.getState().today || {};
                      useCacheStore.getState().setCache("today", {
                        ...prevToday,
                        [todayStr]: {
                          agenda: todayRes.data.agenda,
                          todayStatus: todayRes.data.todayStatus || null,
                        },
                      });
                    }
                  }),
                touchedAssignments
                  ? import("./assignmentStore").then(({ useAssignmentStore }) =>
                      useAssignmentStore.getState().fetchAssignments(),
                    )
                  : Promise.resolve(),
              ]);
            } catch (syncErr) {
              console.warn("[offlineStore] Post-flush store resync warning:", syncErr);
            }
            window.dispatchEvent(new Event("attendance-updated"));
            window.dispatchEvent(new Event("events-updated"));
            window.dispatchEvent(new Event("timetable-updated"));
            window.dispatchEvent(new Event("semester-updated"));
          }
        } finally {
          isFlushingMutex = false;
          clearTimeout(syncWatchdogTimer);
          set({ isSyncing: false });
          try { console.groupEnd(); } catch {}
        }
      },
    }),
    {
      name: "attendx-offline-queue",
      storage: createJSONStorage(() => capacitorStorage),
       // INVARIANT: Only persist queue data. NEVER persist transient locks like isSyncing!
      partialize: (state) => ({ queue: state.queue }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isSyncing = false;
        }
      },
    },
  ),
);
if (typeof window !== "undefined") {
  // Listen for real-time mutations from other open tabs
  if (syncChannel) {
    syncChannel.onmessage = async (event) => {
      if (
        event.data?.type === "QUEUE_UPDATED" &&
        Array.isArray(event.data.queue)
      ) {
        useOfflineStore.setState({ queue: event.data.queue });
      } else if (event.data?.type === "SYNC_COMPLETED") {
        const { successCount, conflictCount, syncedItems } = event.data;
        if (successCount > 0) {
          try {
            const { triggerDynamicHUD } = await import(
              "../components/ui/dynamic-island-hud"
            );
            triggerDynamicHUD({
              type: "success",
              title: "Offline Synced",
              subtitle: `Synced ${successCount} offline action(s) • ${syncedItems?.[0]?.summary || "Updated"}`,
              durationMs: 4500,
            });
          } catch {}

          const firstSummary = syncedItems?.[0]?.summary
            ? ` (${syncedItems[0].summary})`
            : "";
          toast.success(
            `Synced ${successCount} offline action(s) with server!${firstSummary}`,
            { id: "offline-sync", duration: 5000 },
          );
        } else if (conflictCount > 0) {
          toast.error(
            `${conflictCount} offline action(s) were rejected by the server and rolled back.`,
          );
        }

        window.dispatchEvent(
          new CustomEvent("offline-sync-completed", {
            detail: {
              successCount,
              conflictCount,
              syncedItems,
              isCrossTab: true,
            },
          }),
        );

        if (successCount > 0 || conflictCount > 0) {
          window.dispatchEvent(new Event("attendance-updated"));
          window.dispatchEvent(new Event("events-updated"));
          window.dispatchEvent(new Event("timetable-updated"));
          window.dispatchEvent(new Event("semester-updated"));
        }
      }
    };
  }
  window.addEventListener("online", () => {
    useOfflineStore.getState().flushQueue();
  });
  window.addEventListener("focus", () => {
    useOfflineStore.getState().flushQueue();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      useOfflineStore.getState().flushQueue();
    }
  });
  // Periodic auto-sync heartbeat whenever mutations are pending
  setInterval(() => {
    const state = useOfflineStore.getState();
    if (state.queue.length > 0 && !state.isSyncing) {
      const head = state.queue[0];
      if (head && head.lastAttempt && (head.retryCount || 0) > 0) {
        const backoffMs = Math.min(30000, Math.pow(2, head.retryCount || 1) * 2000);
        if (Date.now() - head.lastAttempt < backoffMs) {
          return;
        }
      }
      state.flushQueue();
    }
  }, 5000);
}