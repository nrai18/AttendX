import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Preferences } from "@capacitor/preferences";
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
  deleteAssignment: (id: string) => Promise<void>;
  toggleCompletion: (id: string) => Promise<void>;
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
        } catch (err) {
          console.error("Failed to fetch assignments", err);
        } finally {
          set({ loading: false });
        }
      },
      addAssignment: async (data) => {
        try {
          const res = await api.post("/assignments", data);
          const newItem: Assignment = {
            id: res.data?.id || `temp-${Date.now()}`,
            userId: res.data?.userId || "",
            title: data.title || "New Assignment",
            description: data.description || null,
            deadline: data.deadline || new Date().toISOString(),
            priority: data.priority || "medium",
            isShared: data.isShared || false,
            subjectId: data.subjectId || null,
            classroomId: data.classroomId || null,
            createdAt: res.data?.createdAt || new Date().toISOString(),
            updatedAt: res.data?.updatedAt || new Date().toISOString(),
            completions: res.data?.completions || [],
            ...res.data,
            ...data,
          };
          set({ assignments: [...get().assignments, newItem] });
          import('../services/NotificationService').then(m => m.NotificationService.scheduleAssignmentReminders()).catch(() => {});
        } catch (err) {
          console.error("Failed to add assignment", err);
        }
      },
      deleteAssignment: async (id) => {
        try {
          await api.delete(`/assignments/${id}`);
          set({ assignments: get().assignments.filter(a => a.id !== id) });
          import('../services/NotificationService').then(m => m.NotificationService.scheduleAssignmentReminders()).catch(() => {});
        } catch (err) {
          console.error("Failed to delete assignment", err);
        }
      },
      toggleCompletion: async (id) => {
        const currentAssignments = get().assignments;
        const target = currentAssignments.find(a => a.id === id);

        // Optimistically toggle completion in state immediately (offline-first)
        if (target) {
          const isCompleted = target.completions && target.completions.length > 0;
          const updated = currentAssignments.map(a => {
            if (a.id === id) {
              return {
                ...a,
                completions: isCompleted
                  ? []
                  : [{ id: `temp-${Date.now()}`, assignmentId: id, createdAt: new Date().toISOString() }],
              };
            }
            return a;
          });
          set({ assignments: updated });
          import('../services/NotificationService').then(m => m.NotificationService.scheduleAssignmentReminders()).catch(() => {});
        }

        try {
          await api.post(`/assignments/${id}/toggle`);
          try {
            const res = await api.get("/assignments");
            if (res.data && Array.isArray(res.data)) {
              set({ assignments: res.data });
              import('../services/NotificationService').then(m => m.NotificationService.scheduleAssignmentReminders()).catch(() => {});
            }
          } catch {
            // Keep optimistic toggle if offline
          }
        } catch (err) {
          console.error("Failed to toggle completion", err);
          // Rollback on genuine failure
          set({ assignments: currentAssignments });
          import('../services/NotificationService').then(m => m.NotificationService.scheduleAssignmentReminders()).catch(() => {});
        }
      }
    }),
    {
      name: "attendx-assignments",
      storage: createJSONStorage(() => capacitorStorage),
    }
  )
);
