import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useBackHandlerStore } from "../../stores/backHandlerStore";
import { useAuthStore } from "../../stores/authStore";

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
      
      // 2. ROOT & EXIT PATHS
      // Pressing back on the landing page or main attendance dashboard minimizes the app to prevent an accidental exit loop.
      const rootExitPaths = ["/", "/today"];
      if (rootExitPaths.includes(currentPath)) {
        await CapacitorApp.minimizeApp();
        return;
      }
      
      // 3. PUBLIC ENTRY & LEGAL ROUTES
      // For legal pages (/privacy, /terms), respect user auth state & navigation history
      if (currentPath.startsWith("/privacy") || currentPath.startsWith("/terms")) {
        const { isAuthenticated } = useAuthStore.getState();
        if (historyStack.current.length > 1) {
          historyStack.current.pop();
          const prev = historyStack.current[historyStack.current.length - 1];
          if (!prev || prev === "/" || prev === "/login" || prev === "/signup" || prev === "/privacy" || prev === "/terms") {
            navigate(isAuthenticated ? "/today" : "/", { replace: true });
          } else {
            navigate(-1);
          }
        } else {
          navigate(isAuthenticated ? "/today" : "/", { replace: true });
        }
        return;
      }

      // For auth entry routes (/login, /signup, etc.)
      const authRoutes = ["/login", "/signup", "/forgot-password", "/reset-password"];
      if (authRoutes.includes(currentPath)) {
        navigate("/", { replace: true });
        return;
      }
      
      // Sub-routes for subjects, semester, settings, and classrooms: backing from logs, tabs, or sub-pages returns to parent tab
      if (currentPath.startsWith("/subjects/")) {
        navigate("/subjects", { replace: true });
        return;
      }
      if (currentPath.startsWith("/semester/")) {
        navigate("/semester", { replace: true });
        return;
      }
      if (currentPath.startsWith("/settings/")) {
        navigate("/settings", { replace: true });
        return;
      }
      if (currentPath.startsWith("/classrooms/")) {
        navigate("/classrooms", { replace: true });
        return;
      }

      // Secondary pages opened from Subjects or Settings return to their parent page
      if (currentPath === "/semester" || currentPath === "/predictive" || currentPath.startsWith("/predictive/")) {
        navigate("/subjects", { replace: true });
        return;
      }
      if (currentPath === "/report" || currentPath === "/reports" || currentPath.startsWith("/report/")) {
        navigate("/settings", { replace: true });
        return;
      }
      if (currentPath === "/classrooms") {
        navigate("/settings", { replace: true });
        return;
      }

      // Top-level tabs return to the main dashboard
      if (currentPath === "/timetable" || currentPath === "/calendar" || currentPath === "/subjects" || currentPath === "/settings") {
        navigate("/today", { replace: true });
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
