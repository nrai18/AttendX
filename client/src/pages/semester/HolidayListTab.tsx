import React, { useState } from "react";
import { Info, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { SaveToggle } from "../../components/ui/save-toggle";
import { useCacheStore } from "../../stores/cacheStore";
import { useAttendanceStore } from "../../stores/attendanceStore";

export const HolidayListTab = ({ semesterId, semesterStartDate, semesterEndDate }: { semesterId?: string, semesterStartDate?: string, semesterEndDate?: string }) => {
  const [activeSubTab, setActiveSubTab] = useState<"fixed" | "restricted">("fixed");
  const [isSyncing, setIsSyncing] = useState(false);
  
  const defaultYear = semesterStartDate ? new Date(semesterStartDate).getFullYear() : new Date().getFullYear();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  // Always start empty — data is always loaded from the backend, never from a hardcoded fallback
  const [fixedList, setFixedList] = useState<any[]>([]);
  const [restrictedList, setRestrictedList] = useState<any[]>([]);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(true);


  const availableYears = React.useMemo(() => {
    const years = new Set([currentYear, currentYear + 1, currentYear + 2, defaultYear]);
    return Array.from(years).sort((a, b) => a - b);
  }, [currentYear, defaultYear]);

  React.useEffect(() => {
    if (defaultYear) {
      setSelectedYear(defaultYear);
    }
  }, [defaultYear]);

  React.useEffect(() => {
    let isMounted = true;
    const loadHolidays = async () => {
      try {
        // Clear immediately on year switch so stale data from a previous year never lingers
        if (isMounted) {
          setFixedList([]);
          setRestrictedList([]);
          setIsLoadingHolidays(true);
        }
        const res = await api.get(`/events/templates/holidays?year=${selectedYear}`);
        if (isMounted && res.data) {
          setFixedList(Array.isArray(res.data.fixedHolidays) ? res.data.fixedHolidays : []);
          setRestrictedList(Array.isArray(res.data.restrictedHolidays) ? res.data.restrictedHolidays : []);
        }
      } catch (e) {
        console.warn("Could not load backend holidays:", e);
        if (isMounted) {
          setFixedList([]);
          setRestrictedList([]);
        }
      } finally {
        if (isMounted) setIsLoadingHolidays(false);
      }
    };
    loadHolidays();
    return () => { isMounted = false; };
  }, [selectedYear]);

  const handleSyncHolidays = async () => {
    if (!semesterId) {
      toast.error("No active semester to sync holidays to!");
      return;
    }
    
    setIsSyncing(true);
    try {
      const res = await api.post("/events/templates/sync", {
        semesterId,
        syncHolidayList: true,
        syncAcademicCalendar: false,
        year: selectedYear
      });

      useCacheStore.getState().setCache("calendar", null);
      useAttendanceStore.getState().fetchStats(true);
      window.dispatchEvent(new Event("attendance-updated"));
      window.dispatchEvent(new Event("events-updated"));
      toast.success(`Successfully synced ${res.data?.syncedCount ?? 'all'} holidays for this semester!`);
      // Reload page to reflect changes in UI
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error("Failed to sync holidays", err);
      toast.error("Failed to sync holidays to calendar.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearEvents = async () => {
    toast("Clear Holidays", {
      description: "Are you sure you want to clear ALL synced holidays?",
      action: {
        label: "Clear All",
        onClick: async () => {
          try {
            await api.delete("/events/all?target=holiday_list");
            useCacheStore.getState().setCache("calendar", null);
            useAttendanceStore.getState().fetchStats(true);
            window.dispatchEvent(new Event("attendance-updated"));
            window.dispatchEvent(new Event("events-updated"));
            toast.success("Holidays cleared successfully!");
            setTimeout(() => window.location.reload(), 1500);
          } catch (err) {
            console.error(err);
            toast.error("Failed to clear holidays.");
          }
        }
      },
      cancel: { label: "Cancel", onClick: () => {} }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">Holiday List {selectedYear}</h2>
            <div className="flex bg-muted/60 p-1 rounded-xl items-center border border-border/40">
              {availableYears.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setSelectedYear(y)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    selectedYear === y
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Official list of holidays for the calendar year {selectedYear}.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          <div className="flex bg-muted/50 p-1 rounded-xl w-full md:w-auto">
            <button
              onClick={() => setActiveSubTab("fixed")}
              className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeSubTab === "fixed" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              Fixed Holidays
            </button>
            <button
              onClick={() => setActiveSubTab("restricted")}
              className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeSubTab === "restricted" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              Restricted Holidays
            </button>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleClearEvents}
              className="flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all whitespace-nowrap"
            >
              Clear All
            </button>

            <SaveToggle
              onClick={handleSyncHolidays}
              idleText="Sync to Calendar"
              savedText="Synced!"
              size="sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-card/50 border border-border/50 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-6 py-4 font-semibold w-16">Sr. No.</th>
                <th className="px-6 py-4 font-semibold">Holidays</th>
                <th className="px-6 py-4 font-semibold w-40">Date & Month</th>
                <th className="px-6 py-4 font-semibold w-32">Day</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {isLoadingHolidays ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      <span>Loading {selectedYear} holidays...</span>
                    </div>
                  </td>
                </tr>
              ) : (activeSubTab === "fixed" ? fixedList : restrictedList).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    No {activeSubTab} holidays found for {selectedYear}.
                  </td>
                </tr>
              ) : (activeSubTab === "fixed" ? fixedList : restrictedList).map((holiday: any, idx: number) => (
                <tr key={holiday.sr || holiday.isoDate || idx} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 text-muted-foreground">{holiday.sr || idx + 1}</td>
                  <td className="px-6 py-4 font-medium text-foreground">{holiday.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">{holiday.date}</td>
                  <td className="px-6 py-4 text-muted-foreground">{holiday.day}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-600 dark:text-blue-400">
          <p className="font-semibold mb-1">Important Note</p>
          {activeSubTab === "fixed" ? (
            <p>* Holidays may change depending upon shifting of the moon. Holidays announced by Central Government Welfare coordination committee will be followed for these holidays.</p>
          ) : (
            <p>Restricted Holidays (02 Nos.) to be observed for the year {selectedYear}. Students and staff may choose any two holidays from this list.</p>
          )}
        </div>
      </div>
    </div>
  );
};

