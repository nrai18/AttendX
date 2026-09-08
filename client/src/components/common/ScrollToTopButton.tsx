import React, { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "../../lib/utils";

export const ScrollToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = (e?: Event) => {
      let scrolled = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
      
      // If the scroll event came from an inner container, check its scroll position
      if (e && e.target && (e.target as Element).scrollTop) {
        scrolled = Math.max(scrolled, (e.target as Element).scrollTop);
      }

      if (scrolled > 100) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility, { passive: true });
    document.addEventListener("scroll", toggleVisibility, { passive: true, capture: true });
    
    toggleVisibility();

    return () => {
      window.removeEventListener("scroll", toggleVisibility);
      document.removeEventListener("scroll", toggleVisibility, { capture: true });
    };
  }, []);

  const scrollToTop = () => {
    // Scroll window
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Scroll document
    document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
    document.body.scrollTo({ top: 0, behavior: "smooth" });
    
    // Scroll any inner scrollable containers that might be hijacking the scroll
    const scrollableElements = document.querySelectorAll('.overflow-y-auto, .overflow-y-scroll, .overflow-auto');
    scrollableElements.forEach(el => {
      el.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  return (
    <button
      onClick={scrollToTop}
      className={cn(
        "fixed z-[100] p-4 rounded-none bg-[#E63946] hover:bg-[#E63946]/90 text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_#111111] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[8px_8px_0px_0px_#111111] border-2 border-black dark:border-none transition-all duration-300 transform",
        "bottom-24 right-4 md:bottom-24 md:right-8 lg:bottom-8 lg:right-8",
        isVisible ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-90 pointer-events-none focus:outline-none"
      )}
      aria-label="Scroll to top"
    >
      <ArrowUp className="w-6 h-6 stroke-[3]" />
    </button>
  );
};
