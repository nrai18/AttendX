import { create } from 'zustand';
import { capacitorStorage } from './capacitorStorage';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { api } from '../lib/api';
import { toast } from 'sonner';

export interface QueuedRequest {
  id: string;
  tempId?: string;
  method: string;
  url: string;
  data?: any;
  headers?: any;
  timestamp: number;
}

interface OfflineState {
  queue: QueuedRequest[];
  enqueue: (req: Omit<QueuedRequest, 'id' | 'timestamp'>) => void;
  dequeue: (id: string) => void;
  clearQueue: () => void;
  isSyncing: boolean;
  flushQueue: () => Promise<void>;
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      queue: [],
      isSyncing: false,
      enqueue: (req) => {
        set((state) => ({
          queue: [
            ...state.queue,
            {
              ...req,
              id: Math.random().toString(36).substring(7),
              timestamp: Date.now(),
            },
          ],
        }));
      },
      dequeue: (id) => {
        set((state) => ({
          queue: state.queue.filter((req) => req.id !== id),
        }));
      },
      clearQueue: () => set({ queue: [] }),
      flushQueue: async () => {
        const { queue, isSyncing, dequeue } = get();
        if (isSyncing || queue.length === 0) return;

        set({ isSyncing: true });
        let successCount = 0;
        let conflictCount = 0;

        try {
          // 1. Queue Compaction: drop mutually cancelling creates and deletes performed offline
          // e.g. An assignment or subject created offline (with tempId) and subsequently deleted offline
          const deletedTempIds = new Set<string>();
          for (const req of queue) {
            if (req.method?.toLowerCase() === 'delete') {
              const match = req.url.match(/(temp-[a-zA-Z0-9_-]+)/);
              if (match) {
                deletedTempIds.add(match[1]);
              }
            }
          }

          const compactedQueue: QueuedRequest[] = [];
          if (deletedTempIds.size > 0) {
            for (const req of queue) {
              const match = req.url.match(/(temp-[a-zA-Z0-9_-]+)/);
              const urlTemp = match ? match[1] : null;
              const isCreatedWithDeletedTemp = Boolean(req.tempId && deletedTempIds.has(req.tempId));
              const isTargetingDeletedTemp = Boolean(urlTemp && deletedTempIds.has(urlTemp));

              if (isCreatedWithDeletedTemp || isTargetingDeletedTemp) {
                dequeue(req.id);
                continue;
              }
              compactedQueue.push(req);
            }
          } else {
            compactedQueue.push(...queue);
          }

          // 2. Dynamic ID Mapping to resolve foreign key relationships across sequential replays (Zero P2003 FK errors)
          const idMap = new Map<string, string>();

          // Process compacted queue in sequential order
          for (const req of compactedQueue) {
            try {
              let resolvedUrl = req.url;
              let resolvedData = req.data;

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
                    console.warn("[offlineStore] Failed to replace temp IDs in payload:", e);
                  }
                }
              }

              const res = await api.request({
                method: req.method,
                url: resolvedUrl,
                data: resolvedData,
                headers: { ...req.headers, 'X-Offline-Retry': 'true' },
              });

              dequeue(req.id);
              successCount++;

              // Harvest created real ID (e.g. CUID from Prisma)
              const resData = res.data;
              const realId =
                resData?.id ||
                resData?._id ||
                (resData?.semester && resData.semester.id) ||
                (resData?.subject && resData.subject.id);

              if (realId && typeof realId === 'string') {
                if (req.tempId && req.tempId !== realId) {
                  idMap.set(req.tempId, realId);
                }
                if (req.data?.tempId && req.data.tempId !== realId) {
                  idMap.set(req.data.tempId, realId);
                }
                if (
                  req.data?.id &&
                  typeof req.data.id === 'string' &&
                  req.data.id.startsWith('temp-') &&
                  req.data.id !== realId
                ) {
                  idMap.set(req.data.id, realId);
                }
              }
            } catch (err: any) {
              // If it's a 4xx error (bad request/invalid input), drop it so it doesn't block the queue
              if (
                err.response &&
                err.response.status >= 400 &&
                err.response.status < 500 &&
                err.response.status !== 401 &&
                err.response.status !== 429
              ) {
                dequeue(req.id);
                conflictCount++;
              }
              // Otherwise keep it in the queue for next time
              console.error("Offline sync failed for request", req.url, err);
            }
          }

          if (conflictCount > 0) {
            toast.error(`${conflictCount} offline action(s) were rejected by the server and rolled back.`);
          }

          // If we mutated anything (success or dropped conflict), force UI and stores to refresh
          if (successCount > 0 || conflictCount > 0) {
            window.dispatchEvent(new Event("attendance-updated"));
            window.dispatchEvent(new Event("events-updated"));
            window.dispatchEvent(new Event("timetable-updated"));
            window.dispatchEvent(new Event("semester-updated"));
          }
        } finally {
          set({ isSyncing: false });
        }
      },
    }),
    {
      name: 'attendx-offline-queue',
      storage: createJSONStorage(() => capacitorStorage),
    }
  )
);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useOfflineStore.getState().flushQueue();
  });
}
