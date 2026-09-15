import React from "react";
import { X, Calendar as CalendarIcon, CheckCircle2, XCircle } from "lucide-react";

interface FutureBreakdown {
  date: string;
  type: 'HELD' | 'OFF' | 'LOGGED';
  reason?: string;
  count: number;
  status?: string;
}

interface FutureClassesModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  breakdown: FutureBreakdown[];
  dateOverrides?: Record<string, 'PRESENT' | 'ABSENT' | 'OFF'>;
  onOverrideChange?: (date: string, status: 'PRESENT' | 'ABSENT' | 'OFF') => void;
}

export const FutureClassesModal: React.FC<FutureClassesModalProps> = ({
  isOpen,
  onClose,
  subjectName,
  breakdown,
  dateOverrides = {},
  onOverrideChange
}) => {
  if (!isOpen) return null;

  let totalPresent = 0;
  let totalAbsent = 0;
  let totalOff = 0;

  breakdown.forEach(b => {
    if (b.type === 'LOGGED') return;
    const status = dateOverrides[b.date] || (b.type === 'HELD' ? 'PRESENT' : 'OFF');
    if (status === 'PRESENT') totalPresent += b.count;
    else if (status === 'ABSENT') totalAbsent += b.count;
    else if (status === 'OFF') totalOff += b.count;
  });

  const loggedItems = breakdown.filter(b => b.type === 'LOGGED');
  const simulatedItems = breakdown.filter(b => b.type !== 'LOGGED');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/40 dark:bg-black/60 backdrop-blur-md">
      <div className="bg-white/60 dark:bg-black/60 backdrop-blur-2xl w-full max-w-md rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden border border-white/40 dark:border-white/10 flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-black/10 dark:border-white/10 bg-white/30 dark:bg-black/30">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Future Schedule</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">{subjectName}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-slate-900 dark:text-white" />
          </button>
        </div>

        {/* Stats row */}
        <div className="flex p-4 gap-2 border-b border-black/10 dark:border-white/10 bg-white/20 dark:bg-black/20">
          <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-emerald-700 dark:text-emerald-500">{totalPresent}</span>
            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-500 uppercase tracking-wider">Present</span>
          </div>
          <div className="flex-1 bg-rose-500/10 border border-rose-500/20 rounded-xl p-2 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-rose-700 dark:text-rose-500">{totalAbsent}</span>
            <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-500 uppercase tracking-wider">Absent</span>
          </div>
          <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-amber-700 dark:text-amber-500">{totalOff}</span>
            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-500 uppercase tracking-wider">Off</span>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-transparent">
          {breakdown.length === 0 ? (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">No scheduled classes found.</p>
          ) : (
            <>
              {/* ALREADY LOGGED SECTION */}
              {loggedItems.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 border-b border-black/10 dark:border-white/10 pb-1">
                    Already Logged
                  </h4>
                  {loggedItems.map((item, idx) => {
                    const d = new Date(item.date);
                    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    return (
                      <div key={`logged-${idx}`} className="flex items-center justify-between p-3 rounded-xl border border-black/10 dark:border-white/10 bg-white/30 dark:bg-black/30 opacity-70">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-900/10 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{dateStr}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{item.reason}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase ${
                           item.status === 'present' ? 'bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                           item.status === 'absent' ? 'bg-rose-500/20 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' :
                           'bg-slate-500/20 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400'
                        }`}>
                          {item.status || 'RECORDED'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* FUTURE SIMULATED SECTION */}
              {simulatedItems.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-4 mb-2 border-b border-black/10 dark:border-white/10 pb-1">
                    Future & Simulated
                  </h4>
                  {simulatedItems.map((item, idx) => {
                    const d = new Date(item.date);
                    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    const isHoliday = item.type === 'OFF';
                    const isRestricted = item.reason?.toLowerCase().includes('restricted');
                    const status = dateOverrides[item.date] || (item.type === 'HELD' ? 'PRESENT' : 'OFF');

                    return (
                      <div key={`sim-${idx}`} className={`flex flex-col p-3 rounded-xl border transition-colors bg-white/40 dark:bg-black/40 backdrop-blur-md ${
                        status === 'PRESENT' ? 'border-emerald-500/30' :
                        status === 'ABSENT' ? 'border-rose-500/30' :
                        isHoliday ? 'border-amber-500/30 opacity-80' :
                        'border-black/10 dark:border-white/10'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              status === 'PRESENT' ? 'bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                              status === 'ABSENT' ? 'bg-rose-500/20 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' :
                              'bg-amber-500/20 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                            }`}>
                              <CalendarIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">{dateStr}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                  {isHoliday ? item.reason : `${item.count} slot${item.count > 1 ? 's' : ''}`}
                                </p>
                                {isRestricted && (
                                  <span className="text-[10px] bg-blue-500/20 text-blue-500 px-1.5 py-0.5 rounded-full font-semibold">
                                    Restricted
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Toggles */}
                        <div className="flex gap-2 w-full">
                          <button
                            onClick={() => onOverrideChange?.(item.date, 'PRESENT')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                              status === 'PRESENT' 
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 scale-[1.02]' 
                                : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 border border-black/10 dark:border-white/10'
                            }`}
                          >
                            Present
                          </button>
                          <button
                            onClick={() => onOverrideChange?.(item.date, 'ABSENT')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                              status === 'ABSENT' 
                                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 scale-[1.02]' 
                                : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 border border-black/10 dark:border-white/10'
                            }`}
                          >
                            Absent
                          </button>
                          <button
                            onClick={() => onOverrideChange?.(item.date, 'OFF')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                              status === 'OFF' 
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25 scale-[1.02]' 
                                : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 border border-black/10 dark:border-white/10'
                            }`}
                          >
                            Off
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
};
