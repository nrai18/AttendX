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
          set({ assignments: [...get().assignments, res.data] });
        } catch (err) {
          console.error("Failed to add assignment", err);
        }
      },
      deleteAssignment: async (id) => {
        try {
          await api.delete(`/assignments/${id}`);
          set({ assignments: get().assignments.filter(a => a.id !== id) });
        } catch (err) {
          console.error("Failed to delete assignment", err);
        }
      },
      toggleCompletion: async (id) => {
        try {
          await api.post(`/assignments/${id}/toggle`);
          await get().fetchAssignments();
        } catch (err) {
          console.error("Failed to toggle completion", err);
        }
      }
    }),
    {
      name: "attendx-assignments",
      storage: createJSONStorage(() => capacitorStorage),
    }
  )
);
