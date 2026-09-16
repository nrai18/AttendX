import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Preferences } from '@capacitor/preferences';
import { api } from '../lib/api';
import { toast } from 'sonner';

export interface QueuedRequest {
  id: string;
  method: string;
  url: string;
  data?: any;
  headers?: any;
  timestamp: number;
  retryCount?: number;
}

interface OfflineState {
  queue: QueuedRequest[];
  enqueue: (req: Omit<QueuedRequest, 'id' | 'timestamp'>) => void;
  dequeue: (id: string) => void;
  clearQueue: () => void;
  isSyncing: boolean;
  flushQueue: () => Promise<void>;
  _hasHydrated: boolean;
  setHasHydrated: (h: boolean) => void;
}

const capacitorStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const { value } = await Preferences.get({ key: name });
    return value;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await Preferences.set({ key: name, value });
  },
  removeItem: async (name: string): Promise<void> => {
    await Preferences.remove({ key: name });
  },
};

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      queue: [],
      isSyncing: false,
      _hasHydrated: false,
      setHasHydrated: (h: boolean) => set({ _hasHydrated: h }),
      enqueue: (req) => {
        set((state) => ({
          queue: [
            ...state.queue,
            {
              ...req,
              id: Math.random().toString(36).substring(7),
              timestamp: Date.now(),
              retryCount: 0,
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

        try {
          // Process strictly in FIFO order
          for (const req of queue) {
            try {
              // Strip stale auth & loopback headers so active refreshed tokens are attached
              const reqHeaders = { ...(req.headers || {}) };
              delete reqHeaders['Authorization'];
              delete reqHeaders['authorization'];
              delete reqHeaders['X-Offline-Retry'];
              delete reqHeaders['x-offline-retry'];

              await api.request({
                method: req.method,
                url: req.url,
                data: req.data,
                headers: { ...reqHeaders, 'X-Offline-Retry': 'true' },
              });
              dequeue(req.id);
              successCount++;
            } catch (err: any) {
              const status = err.response?.status;
              const isNetworkError = !err.response || err.message === 'Network Error' || [502, 503, 504].includes(status);
              const currentRetries = (req.retryCount || 0) + 1;

              if (isNetworkError) {
                // Transient network failure / offline: update retry count and BREAK immediately
                // This guarantees strict FIFO causality (request N+1 is never executed if N failed)
                set((state) => ({
                  queue: state.queue.map((item) =>
                    item.id === req.id ? { ...item, retryCount: currentRetries } : item
                  ),
                }));
                console.warn(`[offlineStore] Network failure syncing ${req.url}. Halting queue to maintain FIFO order.`);
                break;
              }

              // Permanent 4xx errors (bad request, invalid payload) - drop so queue isn't blocked
              if (status && status >= 400 && status < 500 && status !== 401 && status !== 429) {
                dequeue(req.id);
                console.error(`[offlineStore] Dropped invalid 4xx request (${status}):`, req.url, err);
                continue;
              }

              // Unrecoverable 500 / server errors: limit retries to prevent permanent queue jamming
              if (currentRetries >= 3) {
                dequeue(req.id);
                console.error(`[offlineStore] Max retries (${currentRetries}) reached. Dropping jammed request:`, req.url, err);
                toast.error(`Offline sync failed for action after ${currentRetries} attempts.`);
              } else {
                set((state) => ({
                  queue: state.queue.map((item) =>
                    item.id === req.id ? { ...item, retryCount: currentRetries } : item
                  ),
                }));
                console.error(`[offlineStore] Server error (${status}) syncing ${req.url}. Attempt ${currentRetries}/3:`, err);
                // Break on 500 error to preserve causality until next flush attempt
                break;
              }
            }
          }
          
          if (successCount > 0) {
            toast.success(`Successfully synced ${successCount} offline action${successCount > 1 ? 's' : ''}!`);
            window.dispatchEvent(new Event("attendance-updated"));
          }
        } finally {
          set({ isSyncing: false });
        }
      },
    }),
    {
      name: 'attendx-offline-queue',
      storage: createJSONStorage(() => capacitorStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useOfflineStore.getState().flushQueue();
  });
}
