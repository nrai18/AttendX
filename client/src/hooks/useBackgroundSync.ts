import { useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useCacheStore } from '../stores/cacheStore';

export const useBackgroundSync = () => {
  const { isAuthenticated } = useAuthStore();
  const isOnline = navigator.onLine;
  const hasSynced = useRef(false);

  useEffect(() => {
    // Only run once per session when authenticated and online
    if (isAuthenticated && isOnline && !hasSynced.current) {
      hasSynced.current = true;
      
      const performSync = async () => {
        try {
          console.log("[BackgroundSync] Starting global offline pre-fetch...");
          
          // 1. Fetch active semester
          const semRes = await api.get("/semesters/active");
          const activeSemester = semRes.data;
          
          if (activeSemester) {
            // 2. Fetch timetable (Active + Archived)
            const ttRes = await api.get(`/timetable/${activeSemester.id}`);
            const archivedRes = await api.get(`/timetable/semester/${activeSemester.id}/archived`);
            
            useCacheStore.getState().setCache("timetable", {
              activeSemester: activeSemester,
              slots: ttRes.data,
              archivedSlots: archivedRes.data,
              // Note: subjects are fetched below anyway
            });
          }
          
          // 3. Fetch all logs (Overall)
          const logsRes = await api.get("/attendance/logs?subjectId=all");
          const existingLogsCache = useCacheStore.getState().subject_logs || {};
          const newLogsCache = { ...existingLogsCache, "all": logsRes.data, "overall": logsRes.data };
          
          if (logsRes.data && logsRes.data.subjects) {
            logsRes.data.subjects.forEach((sub: any) => {
               const subjectLogs = logsRes.data.logs ? logsRes.data.logs.filter((l: any) => l.subjectId === sub.id) : [];
               newLogsCache[sub.id] = {
                 logs: subjectLogs,
                 subjects: logsRes.data.subjects.filter((s: any) => s.id === sub.id)
               };
            });
          }
          useCacheStore.getState().setCache("subject_logs", newLogsCache);
          
          // 4. Fetch subjects overview
          const subjRes = await api.get("/subjects");
          useCacheStore.getState().setCache("subjects_overview", subjRes.data);
          
          // 5. Fetch Calendar for ALL months in active semester (or fallback to current/prev)
          const monthsToFetch = new Set<string>();
          const today = new Date();
          const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
          const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
          
          // Always ensure current and previous months are cached
          monthsToFetch.add(currentMonthStr);
          monthsToFetch.add(prevMonthStr);

          if (activeSemester && activeSemester.startDate && activeSemester.endDate) {
            const start = new Date(activeSemester.startDate);
            const end = new Date(activeSemester.endDate);
            let current = new Date(start.getFullYear(), start.getMonth(), 1);
            const endLimit = new Date(end.getFullYear(), end.getMonth(), 1);
            
            // Cap to a maximum of 12 months just to be safe against bad data
            let safeGuard = 0;
            while (current <= endLimit && safeGuard < 12) {
              monthsToFetch.add(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
              current.setMonth(current.getMonth() + 1);
              safeGuard++;
            }
          }
          
          for (const m of Array.from(monthsToFetch)) {
            try {
              const calRes = await api.get(`/attendance/calendar?month=${m}`);
              const existingCalCache = useCacheStore.getState().calendar || {};
              useCacheStore.getState().setCache("calendar", { ...existingCalCache, [m]: calRes.data });
            } catch (e) {
              console.warn(`Failed to pre-fetch calendar for ${m}`, e);
            }
          }
          
          console.log("[BackgroundSync] Global pre-fetch complete!");
        } catch (err) {
          console.error("[BackgroundSync] Pre-fetch failed:", err);
          hasSynced.current = false; // Allow retry if it failed (e.g. spotty network)
        }
      };
      
      // Delay sync slightly to prioritize immediate user-facing API calls on app load
      setTimeout(performSync, 3000);
    }
  }, [isAuthenticated]);
};
