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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-border flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <div>
            <h3 className="font-bold text-foreground">Future Schedule</h3>
            <p className="text-xs text-muted-foreground">{subjectName}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-muted hover:bg-muted/80 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-foreground" />
          </button>
        </div>

        {/* Stats row */}
        <div className="flex p-4 gap-2 bg-background border-b border-border">
          <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-emerald-500">{totalPresent}</span>
            <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Present</span>
          </div>
          <div className="flex-1 bg-rose-500/10 border border-rose-500/20 rounded-xl p-2 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-rose-500">{totalAbsent}</span>
            <span className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider">Absent</span>
          </div>
          <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-amber-500">{totalOff}</span>
            <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">Off</span>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {breakdown.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No scheduled classes found.</p>
          ) : (
            <>
              {/* ALREADY LOGGED SECTION */}
              {loggedItems.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 border-b border-border pb-1">
                    Already Logged
                  </h4>
                  {loggedItems.map((item, idx) => {
                    const d = new Date(item.date);
                    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    return (
                      <div key={`logged-${idx}`} className="flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-primary/5 opacity-70">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 text-primary">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{dateStr}</p>
                            <p className="text-xs text-muted-foreground">{item.reason}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase ${
                           item.status === 'present' ? 'bg-green-500/20 text-green-500' :
                           item.status === 'absent' ? 'bg-red-500/20 text-red-500' :
                           'bg-gray-500/20 text-gray-500'
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
                  <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mt-4 mb-2 border-b border-border pb-1">
                    Future & Simulated
                  </h4>
                  {simulatedItems.map((item, idx) => {
                    const d = new Date(item.date);
                    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    const isHoliday = item.type === 'OFF';
                    const isRestricted = item.reason?.toLowerCase().includes('restricted');
                    const status = dateOverrides[item.date] || (item.type === 'HELD' ? 'PRESENT' : 'OFF');

                    return (
                      <div key={`sim-${idx}`} className={`flex flex-col p-3 rounded-xl border transition-colors ${
                        status === 'PRESENT' ? 'border-green-500/30 bg-green-500/5' :
                        status === 'ABSENT' ? 'border-red-500/30 bg-red-500/5' :
                        isHoliday ? 'border-amber-500/30 bg-amber-500/5 opacity-80' :
                        'border-border bg-card'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              status === 'PRESENT' ? 'bg-green-500/20 text-green-500' :
                              status === 'ABSENT' ? 'bg-red-500/20 text-red-500' :
                              'bg-amber-500/20 text-amber-500'
                            }`}>
                              <CalendarIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{dateStr}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground">
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
                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/25 scale-[1.02]' 
                                : 'bg-background hover:bg-muted text-muted-foreground border border-border'
                            }`}
                          >
                            Present
                          </button>
                          <button
                            onClick={() => onOverrideChange?.(item.date, 'ABSENT')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                              status === 'ABSENT' 
                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/25 scale-[1.02]' 
                                : 'bg-background hover:bg-muted text-muted-foreground border border-border'
                            }`}
                          >
                            Absent
                          </button>
                          <button
                            onClick={() => onOverrideChange?.(item.date, 'OFF')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                              status === 'OFF' 
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25 scale-[1.02]' 
                                : 'bg-background hover:bg-muted text-muted-foreground border border-border'
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
