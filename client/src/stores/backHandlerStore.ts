import { create } from "zustand";

type BackHandler = () => boolean;

interface BackHandlerState {
  handlers: BackHandler[];
  register: (handler: BackHandler) => () => void;
}

export const useBackHandlerStore = create<BackHandlerState>((set, get) => ({
  handlers: [],
  register: (handler: BackHandler) => {
    set((state) => ({ handlers: [...state.handlers, handler] }));
    return () => {
      set((state) => ({
        handlers: state.handlers.filter((h) => h !== handler),
      }));
    };
  },
}));
