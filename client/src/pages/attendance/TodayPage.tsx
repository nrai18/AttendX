import React, { useState, useEffect } from "react";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { api } from "../../lib/api";

interface AgendaItem {
  id: string;
  type: "slot" | "override";
  subject: {
    id: string;
    name: string;
    code?: string;
    colorHex?: string;
  };
  startTime: string;
  endTime: string;
  room?: string;
  slotType: string;
  status: "present" | "absent" | "off" | "cancelled" | "medical" | "od" | null;
  attendanceId: string | null;
}

export const TodayPage = () => {
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTodayAgenda = async () => {
    try {
      setIsLoading(true);
      const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const res = await api.get(`/attendance/today?date=${dateStr}`);
      setAgenda(res.data);
    } catch (error) {
      console.error("Failed to fetch today's agenda:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayAgenda();
  }, []);

  const markAttendance = async (item: AgendaItem, status: string) => {
    // Optimistic update
    const updatedAgenda = agenda.map(a => 
      a.id === item.id ? { ...a, status: status as any } : a
    );
    setAgenda(updatedAgenda);

    try {
      const dateStr = new Date().toISOString().split("T")[0];
      await api.post("/attendance/mark", {
        subjectId: item.subject.id,
        date: dateStr,
        status,
        timetableSlotId: item.type === "slot" ? item.id : undefined,
        overrideId: item.type === "override" ? item.id : undefined,
      });
      // Optionally refetch or let optimistic update stand
    } catch (error) {
      console.error("Failed to mark attendance:", error);
      // Revert optimistic update
      fetchTodayAgenda();
    }
  };

  const pendingCount = agenda.filter(a => a.status === null).length;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full pb-24 md:pb-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-white">Today's Classes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{pendingCount}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending</p>
        </div>
      </div>

      {agenda.length === 0 ? (
        <div className="text-center py-12 bg-[#0c0d12] border border-white/5 rounded-2xl">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-white mb-2">No classes today!</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Enjoy your day off or use this time to catch up on assignments.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {agenda.map(item => (
            <div 
              key={item.id} 
              className={`p-4 md:p-5 rounded-2xl border transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                item.status 
                  ? "bg-[#050508] border-white/5 opacity-70" 
                  : "bg-[#0c0d12] border-white/10 hover:border-white/20 shadow-lg shadow-black/20"
              }`}
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-1.5 h-14 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: item.subject?.colorHex || "#8b5cf6" }} 
                />
                <div>
                  <h3 className="text-lg font-semibold text-white">{item.subject?.name || "Unknown Subject"}</h3>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground font-medium">
                    <span className="bg-white/5 px-2 py-0.5 rounded text-white/80">{item.startTime} - {item.endTime}</span>
                    <span className="uppercase tracking-wide">{item.slotType}</span>
                    {item.room && <span>• {item.room}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-3 self-end md:self-auto">
                <button
                  onClick={() => markAttendance(item, "present")}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    item.status === "present"
                      ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50"
                      : "bg-white/5 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Att
                </button>
                <button
                  onClick={() => markAttendance(item, "absent")}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    item.status === "absent"
                      ? "bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/50"
                      : "bg-white/5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400"
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  Miss
                </button>
                <button
                  onClick={() => markAttendance(item, "off")}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    item.status === "off"
                      ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50"
                      : "bg-white/5 text-muted-foreground hover:bg-yellow-500/10 hover:text-yellow-400"
                  }`}
                >
                  <AlertCircle className="w-4 h-4" />
                  Off
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
