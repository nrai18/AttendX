import React from "react";
import { PredictiveAttendanceView } from "../../components/attendance/PredictiveAttendanceView";

export const PredictiveAttendancePage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full pb-20">
      <PredictiveAttendanceView />
    </div>
  );
};
