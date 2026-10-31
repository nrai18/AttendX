import React, { useEffect } from "react";
import { PredictiveAttendanceView } from "../../components/attendance/PredictiveAttendanceView";
import { api } from "../../lib/api";

export const PredictiveAttendancePage: React.FC = () => {
  useEffect(() => {
    localStorage.setItem("onboarding_predictive", "true");
    api.patch("/users/onboarding-status", { step: "predictive" }).catch(() => {});
    window.dispatchEvent(new CustomEvent("onboarding-step-completed", { detail: { step: "predictive" } }));
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full pb-20">
      <PredictiveAttendanceView />
    </div>
  );
};
