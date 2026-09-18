import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { api } from '../lib/api';
import { toast } from 'sonner';

export interface QueuedRequest {
  id: string;
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

        try {
          // Process in order
          for (const req of queue) {
            try {
              // Pass a custom header to bypass the queue interceptor itself just in case
              await api.request({
                method: req.method,
                url: req.url,
                data: req.data,
                headers: { ...req.headers, 'X-Offline-Retry': 'true' },
              });
              dequeue(req.id);
              successCount++;
            } catch (err: any) {
              // If it's a 4xx error (bad request), drop it so it doesn't block the queue
              if (err.response && err.response.status >= 400 && err.response.status < 500 && err.response.status !== 401 && err.response.status !== 429) {
                 dequeue(req.id);
              }
              // Otherwise keep it in the queue for next time
              console.error("Offline sync failed for request", req.url, err);
            }
          }
          
          if (successCount > 0) {
            toast.success(`Successfully synced ${successCount} offline actions!`);
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
    }
  )
);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useOfflineStore.getState().flushQueue();
  });
}
