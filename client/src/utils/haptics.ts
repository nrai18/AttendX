import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

let lastHapticTime = 0;

/**
 * Subtle, crisp light impact for regular button taps, general clicks, and UI interactions.
 */
export const hapticLight = async () => {
  try {
    lastHapticTime = Date.now();
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(8);
    }
  }
};

/**
 * Noticeable medium impact for primary actions (Save, Login, Sign Up, Add Slot, Edit Subject).
 */
export const hapticMedium = async () => {
  try {
    lastHapticTime = Date.now();
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (e) {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(22);
    }
  }
};

/**
 * Firm heavy impact for destructive actions (Delete Slot, Delete Subject, Delete Account, Reset).
 */
export const hapticHeavy = async () => {
  try {
    lastHapticTime = Date.now();
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (e) {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(40);
    }
  }
};

/**
 * Distinct selection tick for switching between navbar tabs, timetable days, segmented pills, and dropdowns.
 */
export const hapticSelection = async () => {
  try {
    lastHapticTime = Date.now();
    await Haptics.selectionChanged();
  } catch (e) {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(10);
      }
    }
  }
};

/**
 * Satisfying success pulse pattern for successful login, signup, attendance present marking, slot saved.
 */
export const hapticSuccess = async () => {
  try {
    lastHapticTime = Date.now();
    await Haptics.notification({ type: NotificationType.Success });
  } catch (e) {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([15, 30, 20]);
    }
  }
};

/**
 * Warning double-pulse for missed / absent attendance, logout confirmation, low attendance warnings.
 */
export const hapticWarning = async () => {
  try {
    lastHapticTime = Date.now();
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (e) {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([25, 40, 30]);
    }
  }
};

/**
 * Error buzz for failed login, failed network actions, invalid input validation.
 */
export const hapticError = async () => {
  try {
    lastHapticTime = Date.now();
    await Haptics.notification({ type: NotificationType.Error });
  } catch (e) {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([35, 45, 35]);
    }
  }
};

/**
 * Crisp swipe vibration for swiping between dates, agendas, months, and tabs.
 */
export const hapticSwipe = async () => {
  await hapticSelection();
};

/**
 * Sets up a universal global tap, click, and swipe delegator across the entire application.
 * Any tap on interactive elements (buttons, dates, tabs, inputs, cards, switches) and
 * every swipe gesture automatically triggers tactile haptic feedback.
 */
export const initGlobalHaptics = () => {
  if (typeof window === "undefined") return;

  const triggerHaptic = (target: HTMLElement | null) => {
    if (!target) return;
    if (Date.now() - lastHapticTime < 70) return;

    // Check custom haptic directive or closest interactive ancestor
    const interactive = target.closest<HTMLElement>(
      'button, a, input, select, textarea, label, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="menuitem"], [role="option"], [role="radio"], .cursor-pointer, [data-haptic], [tabindex]'
    );

    let isClickable = false;
    let customHaptic: string | null = null;

    if (interactive) {
      isClickable = true;
      customHaptic = interactive.getAttribute("data-haptic");
    } else {
      // Check computed cursor style on target and immediate parents (up to 3 levels)
      let curr: HTMLElement | null = target;
      for (let i = 0; i < 3 && curr; i++) {
        try {
          const style = window.getComputedStyle(curr);
          if (style.cursor === "pointer" || curr.onclick !== null) {
            isClickable = true;
            customHaptic = curr.getAttribute("data-haptic");
            break;
          }
        } catch {
          break;
        }
        curr = curr.parentElement;
      }
    }

    if (isClickable) {
      if (customHaptic === "none") return;
      if (customHaptic === "heavy") {
        hapticHeavy();
      } else if (customHaptic === "medium") {
        hapticMedium();
      } else if (customHaptic === "selection") {
        hapticSelection();
      } else if (customHaptic === "success") {
        hapticSuccess();
      } else if (customHaptic === "warning") {
        hapticWarning();
      } else if (customHaptic === "error") {
        hapticError();
      } else {
        hapticLight();
      }
    }
  };

  // Instantaneous zero-latency tactile feedback on pointerdown (finger touch or mouse click)
  const handlePointerDown = (e: PointerEvent) => {
    // Only process primary touch or primary left-click
    if (e.pointerType === "mouse" && e.button !== 0) return;
    triggerHaptic(e.target as HTMLElement | null);
  };

  // Fallback for synthetic/programmatic clicks that didn't generate pointerdown
  const handleClick = (e: MouseEvent) => {
    triggerHaptic(e.target as HTMLElement | null);
  };

  window.addEventListener("pointerdown", handlePointerDown, { capture: true, passive: true });
  window.addEventListener("click", handleClick, { capture: true, passive: true });

  // Universal Swipe Gesture Haptic Engine
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let hasSwipedInCurrentTouch = false;

  window.addEventListener(
    "touchstart",
    (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
        hasSwipedInCurrentTouch = false;
      }
    },
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    (e: TouchEvent) => {
      if (hasSwipedInCurrentTouch || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - touchStartX;
      const deltaY = e.touches[0].clientY - touchStartY;
      const dist = Math.hypot(deltaX, deltaY);

      // If finger swiftly traveled over 45px horizontally or vertically, trigger swipe haptic!
      if (dist > 45 && Date.now() - touchStartTime < 500) {
        hasSwipedInCurrentTouch = true;
        hapticSwipe();
      }
    },
    { passive: true }
  );
};
