import { create } from "zustand";
import { capacitorStorage } from "./capacitorStorage";
import { persist, createJSONStorage } from "zustand/middleware";
import { api } from "../lib/api";
import { useOfflineStore, type QueuedRequest } from "./offlineStore";

export interface Assignment {
  id: string;
  userId: string;
  classroomId?: string | null;
  subjectId?: string | null;
  title: string;
  description?: string | null;
  deadline: string;
  priority: "high" | "medium" | "low";
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
  completions: any[];
}

function sortByDeadline(list: Assignment[]): Assignment[] {
  return [...list].sort((a, b) => {
    const da = new Date(a.deadline).getTime();
    const db = new Date(b.deadline).getTime();
    return (isNaN(da) ? Number.MAX_SAFE_INTEGER : da) - (isNaN(db) ? Number.MAX_SAFE_INTEGER : db);
  });
}

function applyPendingAssignmentQueue(serverList: Assignment[], queue: QueuedRequest[]): Assignment[] {
  let result = Array.isArray(serverList) ? [...serverList] : [];
  for (const req of queue) {
    const url = req.url || "";
    if (!url.includes("/assignments")) continue;
    const method = (req.method || "").toLowerCase();
    const data = req.data || {};

    if (method === "post" && !/\/toggle\b|\/complete\b/.test(url)) {
      const tempId = req.tempId || data.tempId || data.id;
      if (tempId && !result.some((a) => a.id === tempId)) {
        result.push({
          ...data,
          id: tempId,
          userId: data.userId || "local",
          isShared: Boolean(data.isShared),
          createdAt: new Date(req.timestamp || Date.now()).toISOString(),
          updatedAt: new Date(req.timestamp || Date.now()).toISOString(),
          completions: [],
        });
      }
    } else if (method === "put" || method === "patch") {
      const targetId = req.tempId || url.split("?")[0].split("/").pop();
      result = result.map((a) => (a.id === targetId ? { ...a, ...data } : a));
    } else if (method === "delete") {
      const targetId = req.tempId || url.split("?")[0].split("/").pop();
      result = result.filter((a) => a.id !== targetId);
    } else if (method === "post" && /\/toggle\b|\/complete\b/.test(url)) {
      const parts = url.split("?")[0].split("/").filter(Boolean);
      const targetId = parts[parts.length - 2];
      result = result.map((a) => {
        if (a.id !== targetId) return a;
        const done = Boolean(a.completions && a.completions.length > 0);
        return {
          ...a,
          completions: done ? [] : [{ id: "local", assignmentId: targetId }],
        };
      });
    }
  }
  return sortByDeadline(result);
}

interface AssignmentState {
  assignments: Assignment[];
  loading: boolean;
  fetchAssignments: () => Promise<void>;
  mergeFetchedAssignments: (serverList: Assignment[]) => void;
  addAssignment: (data: Partial<Assignment>) => Promise<void>;
  updateAssignment: (id: string, data: Partial<Assignment>) => Promise<void>;
  deleteAssignment: (id: string) => Promise<void>;
  toggleCompletion: (id: string) => Promise<void>;
  resetAssignments: () => void;
}

export const useAssignmentStore = create<AssignmentState>()(
  persist(
    (set, get) => ({
      assignments: [],
      loading: false,
      mergeFetchedAssignments: (serverList: Assignment[]) => {
        if (!Array.isArray(serverList)) return;
        const queue = useOfflineStore.getState().queue;
        set({ assignments: applyPendingAssignmentQueue(serverList, queue) });
      },
      fetchAssignments: async () => {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          set({ loading: false });
          return;
        }
        set({ loading: true });
        try {
          const res = await api.get("/assignments");
          if (Array.isArray(res.data)) {
            const queue = useOfflineStore.getState().queue;
            set({ assignments: applyPendingAssignmentQueue(res.data, queue) });
            import("../services/NotificationService")
              .then((m) => m.NotificationService.scheduleAssignmentReminders())
              .catch(console.error);
          }
        } catch (err) {
          console.error("Failed to fetch assignments", err);
        } finally {
          set({ loading: false });
        }
      },
      addAssignment: async (data) => {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const nowIso = new Date().toISOString();
        const optimisticAssignment: Assignment = {
          id: tempId,
          userId: "local",
          title: (data.title || "").trim(),
          description: data.description,
          deadline: data.deadline || nowIso,
          priority: data.priority || "medium",
          classroomId: data.classroomId ?? null,
          subjectId: data.subjectId ?? null,
          isShared: Boolean(data.isShared),
          createdAt: nowIso,
          updatedAt: nowIso,
          completions: [],
        };

        set({
          assignments: sortByDeadline([...get().assignments, optimisticAssignment]),
        });

        try {
          const res = await api.post("/assignments", { ...data, tempId });
          const isQueued = Boolean(res.data?._queued);
          const savedAssignment: Assignment = {
            ...optimisticAssignment,
            ...(res.data || {}),
            id: isQueued ? tempId : res.data?.id || tempId,
            completions: res.data?.completions || [],
          };
          set({
            assignments: sortByDeadline(
              get().assignments.map((a) => (a.id === tempId ? savedAssignment : a)),
            ),
          });
          import("../services/NotificationService")
            .then((m) => m.NotificationService.scheduleAssignmentReminders())
            .catch(console.error);
        } catch (err) {
          console.error("Failed to add assignment", err);
          set({
            assignments: get().assignments.filter((a) => a.id !== tempId),
          });
          throw err;
        }
      },
      updateAssignment: async (id, data) => {
        const existingItem = get().assignments.find((a) => a.id === id);
        if (existingItem) {
          set({
            assignments: sortByDeadline(
              get().assignments.map((a) => (a.id === id ? { ...a, ...data } : a)),
            ),
          });
        }
        try {
          const res = await api.put(`/assignments/${id}`, data);
          if (!res.data?._queued) {
            set({
              assignments: sortByDeadline(
                get().assignments.map((a) =>
                  a.id === id ? { ...a, ...res.data, id: a.id } : a,
                ),
              ),
            });
          }
          import("../services/NotificationService")
            .then((m) => {
              m.NotificationService.cancelAssignmentReminders(id);
              return m.NotificationService.scheduleAssignmentReminders();
            })
            .catch(console.error);
        } catch (err) {
          console.error("Failed to update assignment", err);
          if (existingItem) {
            set({
              assignments: sortByDeadline(
                get().assignments.map((a) => (a.id === id ? existingItem : a)),
              ),
            });
          }
          throw err;
        }
      },
      deleteAssignment: async (id) => {
        const deletedItem = get().assignments.find((a) => a.id === id);
        // Optimistic instant delete
        set({ assignments: get().assignments.filter((a) => a.id !== id) });
        import("../services/NotificationService")
          .then((m) => m.NotificationService.cancelAssignmentReminders(id))
          .catch(() => {});

        // If this temp item hasn't synced to server yet, purge its queued mutations directly
        if (id.startsWith("temp")) {
          const pendingCreate = useOfflineStore
            .getState()
            .queue.some((q) => q.tempId === id && q.method?.toLowerCase() === "post");
          if (pendingCreate) {
            useOfflineStore.setState((state) => ({
              queue: state.queue.filter(
                (q) =>
                  q.tempId !== id &&
                  !q.url.includes(id) &&
                  q.data?.assignmentId !== id,
              ),
            }));
            import("../services/NotificationService")
              .then((m) => m.NotificationService.scheduleAssignmentReminders())
              .catch(() => {});
            return;
          }
        }

        try {
          await api.delete(`/assignments/${id}`);
          import("../services/NotificationService")
            .then((m) => {
              m.NotificationService.cancelAssignmentReminders(id);
              return m.NotificationService.scheduleAssignmentReminders();
            })
            .catch(console.error);
        } catch (err: any) {
          console.error("Failed to delete assignment", err);
          if (deletedItem) {
            const cur = get().assignments;
            if (!cur.some((a) => a.id === id)) {
              set({ assignments: sortByDeadline([...cur, deletedItem]) });
            }
          }
          import("../services/NotificationService")
            .then((m) => m.NotificationService.scheduleAssignmentReminders())
            .catch(() => {});
          throw err;
        }
      },
      toggleCompletion: async (id) => {
        const assignment = get().assignments.find((a) => a.id === id);
        if (!assignment) return;
        const currentlyDone = Boolean(assignment.completions && assignment.completions.length > 0);
        const nextCompleted = !currentlyDone;

        // 1. Optimistic visual toggle immediately (0ms latency, works offline)
        set({
          assignments: get().assignments.map((a) => {
            if (a.id !== id) return a;
            return {
              ...a,
              completions: nextCompleted ? [{ id: `local-${Date.now()}`, assignmentId: id }] : [],
            };
          }),
        });

        // 2. Fire backend toggle mutation (enqueued cleanly if offline)
        let authoritativeCompleted = nextCompleted;
        try {
          const res = await api.post(`/assignments/${id}/toggle`);
          if (res?.data && typeof res.data.completed === "boolean") {
            authoritativeCompleted = res.data.completed;
            set({
              assignments: get().assignments.map((a) => {
                if (a.id !== id) return a;
                return {
                  ...a,
                  completions: authoritativeCompleted ? [{ id: "local", assignmentId: id }] : [],
                };
              }),
            });
          }

          import("../services/NotificationService")
            .then((m) => {
              if (authoritativeCompleted) {
                m.NotificationService.cancelAssignmentReminders(id);
              }
              return m.NotificationService.scheduleAssignmentReminders();
            })
            .catch(console.error);
        } catch (err: any) {
          console.error("Failed to toggle completion", err);
          set({
            assignments: get().assignments.map((a) => {
              if (a.id !== id) return a;
              return {
                ...a,
                completions: currentlyDone ? [{ id: "local", assignmentId: id }] : [],
              };
            }),
          });
          import("../services/NotificationService")
            .then((m) => m.NotificationService.scheduleAssignmentReminders())
            .catch(() => {});
          throw err;
        }
      },
      resetAssignments: () => set({ assignments: [], loading: false }),
    }),
    {
      name: "attendx-assignments",
      storage: createJSONStorage(() => capacitorStorage),
    }
  )
);
