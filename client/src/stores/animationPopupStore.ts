import { create } from "zustand";

export type AnimationType = "thumbs_up" | "crying" | "target_hit" | "off_class" | "full_day_off";

interface AnimationPopupState {
  isOpen: boolean;
  type: AnimationType | null;
  message: string;
  triggerAnimation: (type: AnimationType, customMessage?: string) => void;
  closeAnimation: () => void;
}

export const useAnimationPopupStore = create<AnimationPopupState>((set) => ({
  isOpen: false,
  type: null,
  message: "",
  triggerAnimation: (type, customMessage) => {
    let defaultMsg = "";
    if (type === "thumbs_up") defaultMsg = "Awesome! Attendance Marked 👍";
    if (type === "crying") defaultMsg = "Oh No! Attendance Dropped 😭";
    if (type === "target_hit") defaultMsg = "Bullseye! Target Touched 🎯";
    if (type === "off_class") defaultMsg = "Yay! Off Class! 💃🕺";
    if (type === "full_day_off") defaultMsg = "Congratulations on a full day off! 🥳🎉";

    set({
      isOpen: true,
      type,
      message: customMessage || defaultMsg,
    });
  },
  closeAnimation: () => {
    set({ isOpen: false, type: null, message: "" });
  },
}));

// Global helper function so it can be called anywhere easily
export const triggerAttendancePopup = (type: AnimationType, customMessage?: string) => {
  useAnimationPopupStore.getState().triggerAnimation(type, customMessage);
};
