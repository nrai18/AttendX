export const generateLocalInsights = (subjects: any[]) => {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  let totalAbsences = 0;
  const missedDaysCount: Record<string, number> = {};
  const missedSubjectsCount: Record<string, number> = {};
  
  subjects.forEach(sub => {
    if (sub.attendance) {
      sub.attendance.forEach((log: any) => {
        if (log.status === "ABSENT") {
          totalAbsences++;
          
          // Track by Subject
          missedSubjectsCount[sub.name] = (missedSubjectsCount[sub.name] || 0) + 1;
          
          // Track by Day of Week
          const dayName = dayNames[new Date(log.date).getDay()];
          missedDaysCount[dayName] = (missedDaysCount[dayName] || 0) + 1;
        }
      });
    }
  });

  if (totalAbsences === 0) {
    return {
      summary: "You have a perfect attendance record! No vulnerable patterns detected.",
      keyReasons: ["No absences recorded"],
      vulnerableTimings: ["None"],
      actionableAdvice: "Keep up the excellent work! You are comfortably above your target."
    };
  }

  // Find most missed subject
  const mostMissedSubject = Object.keys(missedSubjectsCount).reduce((a, b) => missedSubjectsCount[a] > missedSubjectsCount[b] ? a : b, Object.keys(missedSubjectsCount)[0]);
  
  // Find most missed days
  const sortedMissedDays = Object.keys(missedDaysCount).sort((a, b) => missedDaysCount[b] - missedDaysCount[a]);
  const topMissedDays = sortedMissedDays.slice(0, 2);

  // Generate Summary Text
  let summary = `The student demonstrates a clear pattern of missing classes, particularly for ${mostMissedSubject}. `;
  if (topMissedDays.length > 0) {
    summary += `A high concentration of absences occurs on ${topMissedDays.join("s and ")}s.`;
  }

  const vulnerableTimings = topMissedDays.map(day => `${day} classes`);
  if (vulnerableTimings.length === 0) vulnerableTimings.push("Scattered absences");

  let alarmDay = 'the night before';
  if (topMissedDays[0]) {
      const today = new Date();
      today.setDate(today.getDate() - 1);
      alarmDay = today.toLocaleDateString('en-US', {weekday: 'long'});
  }

  return {
    summary,
    keyReasons: ["Unspecified"],
    vulnerableTimings,
    actionableAdvice: `Setting multiple alarms and planning ahead on ${alarmDay} can help you arrive consistently for your critical ${mostMissedSubject} classes.`
  };
};
