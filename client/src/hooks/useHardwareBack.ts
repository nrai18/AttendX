import { useEffect } from "react";
import { useBackHandlerStore } from "../stores/backHandlerStore";

export const useHardwareBack = (isOpen: boolean, onClose: () => void) => {
  const register = useBackHandlerStore((state) => state.register);

  useEffect(() => {
    if (!isOpen) return;

    const handler = () => {
      onClose();
      return true; // handled
    };

    const unregister = register(handler);
    return () => unregister();
  }, [isOpen, onClose, register]);
};
