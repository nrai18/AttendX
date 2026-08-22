import { create } from "zustand";

export type AnimationType = "thumbs_up" | "crying" | "target_hit" | "off_class" | "full_day_off" | "diwali" | "republic_day" | "christmas" | "eid" | "muharram" | "holi" | "ram_navami" | "mahavir_jayanti" | "good_friday" | "buddha_purnima" | "janmashtami" | "gandhi_jayanti" | "dussehra" | "guru_nanak" | "bakrid" | "bhai_duj" | "independence_day" | "makar_sankranti" | "new_year" | "pongal" | "maha_shivaratri" | "milad_un_nabi" | "rakshabandhan" | "christmas_eve" | "ganesh_chaturthi";

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
    if (type === "thumbs_up") defaultMsg = "Awesome! Attendance Marked 🎉";
    if (type === "crying") defaultMsg = "Oh No! Attendance Dropped 😢";
    if (type === "target_hit") defaultMsg = "Bullseye! Target Touched 🎯";
    if (type === "off_class") defaultMsg = "Yay! Off Class! 💃🕺";
    if (type === "full_day_off") defaultMsg = "Congratulations on a full day off! 🥳🎉";
    if (type === "diwali") defaultMsg = "Happy Diwali! 🪔🎆";
    if (type === "republic_day") defaultMsg = "Happy Republic/Independence Day! 🇮🇳🫡";
    if (type === "christmas") defaultMsg = "Merry Christmas! 🎄🎅";
    if (type === "eid") defaultMsg = "Eid Mubarak! 🌙🕌";
    if (type === "muharram") defaultMsg = "Observing Muharram 🤲";
    if (type === "holi") defaultMsg = "Happy Holi! 🎨";
    if (type === "ram_navami") defaultMsg = "Happy Ram Navami! 🏹";
    if (type === "mahavir_jayanti") defaultMsg = "Happy Mahavir Jayanti! 🪷";
    if (type === "good_friday") defaultMsg = "Blessed Good Friday! ✝️";
    if (type === "buddha_purnima") defaultMsg = "Happy Buddha Purnima! ☸️";
    if (type === "janmashtami") defaultMsg = "Happy Krishna Janmashtami! 🦚";
    if (type === "gandhi_jayanti") defaultMsg = "Happy Gandhi Jayanti! 👓";
    if (type === "dussehra") defaultMsg = "Happy Dussehra! ⚔️";
    if (type === "guru_nanak") defaultMsg = "Happy Gurpurab! 🕌";

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
