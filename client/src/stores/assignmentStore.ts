import { create } from "zustand";
import { capacitorStorage } from "./capacitorStorage";
import { persist, createJSONStorage } from "zustand/middleware";
import { api } from "../lib/api";

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

interface AssignmentState {
  assignments: Assignment[];
  loading: boolean;
  fetchAssignments: () => Promise<void>;
  addAssignment: (data: Partial<Assignment>) => Promise<void>;
  updateAssignment: (id: string, data: Partial<Assignment>) => Promise<void>;
  deleteAssignment: (id: string) => Promise<void>;
  toggleCompletion: (id: string) => Promise<void>;
}

export const useAssignmentStore = create<AssignmentState>()(
  persist(
    (set, get) => ({
      assignments: [],
      loading: false,
      fetchAssignments: async () => {
        set({ loading: true });
        try {
          const res = await api.get("/assignments");
          set({ assignments: res.data });
          import("../services/NotificationService")
            .then(m => m.NotificationService.scheduleAssignmentReminders())
            .catch(console.error);
        } catch (err) {
          console.error("Failed to fetch assignments", err);
        } finally {
          set({ loading: false });
        }
      },
      addAssignment: async (data) => {
        try {
          const res = await api.post("/assignments", data);
          const newAssignment = {
            ...res.data,
            completions: res.data?.completions || []
          };
          set({ assignments: [...get().assignments, newAssignment] });
          import("../services/NotificationService")
            .then(m => m.NotificationService.scheduleAssignmentReminders())
            .catch(console.error);
        } catch (err) {
          console.error("Failed to add assignment", err);
        }
      },
      updateAssignment: async (id, data) => {
        try {
          const res = await api.put(`/assignments/${id}`, data);
          set({
            assignments: get().assignments.map(a => a.id === id ? { ...a, ...res.data } : a)
          });
          import("../services/NotificationService")
            .then(m => {
              m.NotificationService.cancelAssignmentReminders(id);
              return m.NotificationService.scheduleAssignmentReminders();
            })
            .catch(console.error);
        } catch (err) {
          console.error("Failed to update assignment", err);
        }
      },
      deleteAssignment: async (id) => {
        const prevAssignments = get().assignments;
        // Optimistic instant delete
        set({ assignments: prevAssignments.filter(a => a.id !== id) });
        try {
          await api.delete(`/assignments/${id}`);
          import("../services/NotificationService")
            .then(m => {
              m.NotificationService.cancelAssignmentReminders(id);
              return m.NotificationService.scheduleAssignmentReminders();
            })
            .catch(console.error);
        } catch (err: any) {
          console.error("Failed to delete assignment", err);
          const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
          if (!isOffline && err?.response?.status && err.response.status >= 400 && err.response.status < 500) {
            set({ assignments: prevAssignments });
          }
        }
      },
      toggleCompletion: async (id) => {
        const assignment = get().assignments.find(a => a.id === id);
        if (!assignment) return;
        const currentlyDone = Boolean(assignment.completions && assignment.completions.length > 0);
        const nextCompleted = !currentlyDone;

        // 1. Optimistic visual toggle immediately (0ms latency, works offline)
        set({
          assignments: get().assignments.map(a => {
            if (a.id !== id) return a;
            return {
              ...a,
              completions: nextCompleted ? [{ id: `local-${Date.now()}`, assignmentId: id }] : []
            };
          })
        });

        // 2. Fire backend toggle mutation (queued in offlineStore if offline)
        try {
          const res = await api.post(`/assignments/${id}/toggle`);
          // If server returned authoritative boolean, synchronize with it
          if (res?.data && typeof res.data.completed === 'boolean') {
            const authoritativeCompleted = res.data.completed;
            set({
              assignments: get().assignments.map(a => {
                if (a.id !== id) return a;
                return {
                  ...a,
                  completions: authoritativeCompleted ? [{ id: 'local', assignmentId: id }] : []
                };
              })
            });
          }

          import("../services/NotificationService")
            .then(m => {
              if (nextCompleted) {
                m.NotificationService.cancelAssignmentReminders(id);
              }
              return m.NotificationService.scheduleAssignmentReminders();
            })
            .catch(console.error);
        } catch (err: any) {
          console.error("Failed to toggle completion", err);
          const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
          if (!isOffline && err?.response?.status && err.response.status >= 400 && err.response.status < 500) {
            set({
              assignments: get().assignments.map(a => {
                if (a.id !== id) return a;
                return {
                  ...a,
                  completions: currentlyDone ? [{ id: 'local', assignmentId: id }] : []
                };
              })
            });
          }
        }
      }
    }),
    {
      name: "attendx-assignments",
      storage: createJSONStorage(() => capacitorStorage),
    }
  )
);
