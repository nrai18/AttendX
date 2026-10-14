import { useEffect, useRef } from "react";

export const useScrollLock = (isLocked: boolean) => {
  const scrollPosRef = useRef(0);

  useEffect(() => {
    if (isLocked) {
      scrollPosRef.current = window.scrollY || document.documentElement.scrollTop || 0;
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      if (scrollPosRef.current > 0) {
        const targetY = scrollPosRef.current;
        window.scrollTo({ top: targetY, behavior: "instant" });
        requestAnimationFrame(() => {
          window.scrollTo({ top: targetY, behavior: "instant" });
        });
      }
    }
    return () => {
      document.body.style.overflow = "";
      if (scrollPosRef.current > 0) {
        const targetY = scrollPosRef.current;
        window.scrollTo({ top: targetY, behavior: "instant" });
        requestAnimationFrame(() => {
          window.scrollTo({ top: targetY, behavior: "instant" });
        });
      }
    };
  }, [isLocked]);
};
