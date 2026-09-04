import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useBackHandlerStore } from "../../stores/backHandlerStore";

export const HardwareBackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const historyStack = useRef<string[]>([]);
  const locationRef = useRef(location.pathname);

  useEffect(() => {
    // Keep our own reliable history stack
    if (historyStack.current[historyStack.current.length - 1] !== location.pathname) {
      historyStack.current.push(location.pathname);
    }
    locationRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const backButtonListener = CapacitorApp.addListener("backButton", async () => {
      // 1. Check if any component (like a modal) wants to handle the back press
      const handlers = useBackHandlerStore.getState().handlers;
      for (let i = handlers.length - 1; i >= 0; i--) {
        if (handlers[i]()) {
          return; // The handler processed the back press, do not navigate!
        }
      }

      const currentPath = locationRef.current;
      
      // If we are on the main landing/home pages, exit the app
      if (currentPath === "/today" || currentPath === "/") {
        await CapacitorApp.minimizeApp();
        return;
      }
      
      if (currentPath === "/login" || currentPath === "/signup") {
        navigate("/", { replace: true });
        return;
      }

      // If we have history to pop
      if (historyStack.current.length > 1) {
        historyStack.current.pop(); // Remove current
        const previousPath = historyStack.current[historyStack.current.length - 1];
        
        // If the previous path is the same (somehow), just navigate to /today as fallback
        if (previousPath === currentPath) {
          navigate("/today", { replace: true });
        } else {
          // Standard React Router back navigation
          navigate(-1);
        }
      } else {
        // We are deep in the app but have no history (e.g., opened via deep link/notification)
        // Fallback to the home tab so the user isn't trapped
        navigate("/today", { replace: true });
      }
    });

    return () => {
      backButtonListener.then((listener: any) => listener.remove());
    };
  }, [navigate]);

  return null;
};
