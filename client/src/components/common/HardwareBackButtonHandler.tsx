import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

export const HardwareBackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const backButtonListener = CapacitorApp.addListener("backButton", async (info: any) => {
      // Define root paths where pressing back should exit/minimize the app
      const rootPaths = ["/today", "/timetable", "/calendar", "/semester", "/subjects", "/settings", "/login"];

      if (rootPaths.includes(location.pathname)) {
        // We are on a main tab. Minimize or exit app instead of going back to previous tabs indefinitely.
        await CapacitorApp.minimizeApp();
      } else {
        // We are in a sub-page (like SubjectDetailPage: /subjects/123)
        // Check if history can go back
        if (window.history.length > 2 || info.canGoBack) {
          navigate(-1);
        } else {
          await CapacitorApp.minimizeApp();
        }
      }
    });

    return () => {
      backButtonListener.then((listener: any) => listener.remove());
    };
  }, [navigate, location.pathname]);

  return null;
};
