import { useEffect, useRef } from "react";

let lockCount = 0;
let originalBodyOverflow = "";

export const useScrollLock = (isLocked: boolean) => {
  const scrollPosRef = useRef(0);

  useEffect(() => {
    if (!isLocked) return;

    // Record the current scroll position before locking
    const currentY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    if (currentY > 0) {
      scrollPosRef.current = currentY;
    }

    lockCount++;
    if (lockCount === 1) {
      originalBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = originalBodyOverflow || "";
      }

      // Re-apply preserved scroll position cleanly if browser shifted it
      const targetY = scrollPosRef.current;
      if (targetY > 0 && Math.abs((window.scrollY || 0) - targetY) > 2) {
        window.scrollTo({ top: targetY, behavior: "instant" });
      }
    };
  }, [isLocked]);
};
