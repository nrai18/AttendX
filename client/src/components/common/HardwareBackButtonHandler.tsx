import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

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
      const currentPath = locationRef.current;
      
      // If we are on the main landing/home pages, exit the app
      if (currentPath === "/today" || currentPath === "/login" || currentPath === "/") {
        await CapacitorApp.minimizeApp();
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
