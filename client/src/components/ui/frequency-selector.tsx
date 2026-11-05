'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ChevronDown, Calendar, Sparkles, X } from 'lucide-react';
import { hapticSelection, hapticSuccess, hapticLight } from '../../utils/haptics';

/* ---------- Types ---------- */
export type FrequencyType = 'Never' | 'Daily' | 'Weekly' | 'Monthly';

export interface FrequencyData {
  type: FrequencyType;
  subValue?: string;
}

interface FrequencySelectorProps {
  value: FrequencyData;
  onChange: (data: FrequencyData) => void;
  className?: string;
  memory?: Record<string, string | undefined>;
}

/* ---------- Motion Config ---------- */
const tabSpring = { type: 'spring', bounce: 0.12, duration: 0.28 } as const;

/* ---------- Data ---------- */
const FREQUENCIES: FrequencyType[] = ['Never', 'Daily', 'Weekly', 'Monthly'];

const SUB_OPTIONS: Record<FrequencyType, string[]> = {
  Never: [],
  Daily: [],
  Weekly: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  Monthly: Array.from({ length: 31 }, (_, i) => (i + 1).toString()),
};

export const FrequencySelector: React.FC<FrequencySelectorProps> = ({
  value,
  onChange,
  className = '',
  memory = {},
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempType, setTempType] = useState<FrequencyType>(value.type);
  const [tempSubValue, setTempSubValue] = useState<string | undefined>(
    value.subValue || memory[value.type] || SUB_OPTIONS[value.type][0]
  );

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync temp state when incoming value changes while closed
  useEffect(() => {
    if (!isOpen) {
      setTempType(value.type);
      setTempSubValue(value.subValue || memory[value.type] || SUB_OPTIONS[value.type][0]);
    }
  }, [value, isOpen, memory]);

  // Click outside to dismiss without saving
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleOpen = () => {
    hapticLight();
    setTempType(value.type);
    setTempSubValue(value.subValue || memory[value.type] || SUB_OPTIONS[value.type][0]);
    setIsOpen(true);
  };

  const handleClose = () => {
    hapticLight();
    setIsOpen(false);
  };

  const handleConfirm = () => {
    hapticSuccess();
    onChange({
      type: tempType,
      subValue: tempType === 'Daily' || tempType === 'Never' ? undefined : tempSubValue,
    });
    setIsOpen(false);
  };

  const renderDisplayLabel = () => {
    if (value.type === 'Never') return 'Never';
    if (value.type === 'Daily') return 'Daily';
    if (value.type === 'Weekly') return `Weekly, ${value.subValue || 'Sun'}`;
    if (value.type === 'Monthly') return `Monthly, Day ${value.subValue || '1'}`;
    return value.type;
  };

  return (
    <div
      ref={containerRef}
      className={`w-full antialiased select-none ${className}`}
    >
      {/* ---------- CLOSED TRIGGER PILL ---------- */}
      <div
        onClick={() => {
          if (isOpen) handleClose();
          else handleOpen();
        }}
        className="flex min-h-14 w-full cursor-pointer items-center justify-between rounded-2xl sm:rounded-full bg-slate-50 dark:bg-slate-900/60 border border-black/10 dark:border-white/10 p-2 px-4 sm:px-5 gap-3 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 active:scale-[0.99] transition-all shadow-sm"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <span className="text-sm sm:text-base font-bold text-slate-700 dark:text-slate-300">
            Frequency
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-black/80 px-3.5 py-1.5 shadow-sm">
          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
            {renderDisplayLabel()}
          </span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-slate-400"
          >
            <ChevronDown size={16} />
          </motion.div>
        </div>
      </div>

      {/* ---------- EXPANDED SELECTION CARD ---------- */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden mt-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#151518] p-3 sm:p-4 shadow-xl space-y-3.5"
          >
            {/* Top Tab Bar: 4-Segment Grid (Never, Daily, Weekly, Monthly) */}
            <div className="relative grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-black/5 dark:border-white/5">
              {FREQUENCIES.map((type) => {
                const isSelected = tempType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      hapticSelection();
                      setTempType(type);
                      setTempSubValue(memory[type] || SUB_OPTIONS[type][0]);
                    }}
                    className={`relative z-10 flex h-9 items-center justify-center rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                      isSelected
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="active-freq-tab"
                        transition={tabSpring}
                        className="absolute inset-0 z-[-1] rounded-lg bg-white dark:bg-black shadow-sm border border-black/10 dark:border-white/10"
                      />
                    )}
                    <span>{type}</span>
                  </button>
                );
              })}
            </div>

            {/* Sub-Options Container */}
            <div className="space-y-2">
              {/* Weekly Sub-Options: 7 Days */}
              {tempType === 'Weekly' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Delivery Day
                    </span>
                    <span className="text-xs font-bold text-primary">
                      Every {tempSubValue || 'Sun'}
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/5">
                    {SUB_OPTIONS.Weekly.map((day) => {
                      const isDaySelected = tempSubValue === day;
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            hapticSelection();
                            setTempSubValue(day);
                          }}
                          className={`relative flex h-8 sm:h-9 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                            isDaySelected
                              ? 'bg-primary text-primary-foreground font-black shadow-sm scale-105'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Monthly Sub-Options: Days 1 to 31 + Quick Presets */}
              {tempType === 'Monthly' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Day of Month
                    </span>
                    <span className="text-xs font-bold text-primary">
                      Day {tempSubValue || '1'} of every month
                    </span>
                  </div>

                  {/* Quick Presets: 1st, 15th, 28th, Last Day */}
                  <div className="flex items-center gap-1.5 pb-1 overflow-x-auto">
                    {[
                      { label: '1st (Start)', val: '1' },
                      { label: '15th (Mid)', val: '15' },
                      { label: '28th', val: '28' },
                      { label: '30th (End)', val: '30' },
                    ].map((preset) => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => {
                          hapticSelection();
                          setTempSubValue(preset.val);
                        }}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all shrink-0 ${
                          tempSubValue === preset.val
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-black/5 dark:bg-white/5 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* 31-Day Compact Grid */}
                  <div className="grid grid-cols-7 gap-1 p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/5 max-h-48 overflow-y-auto">
                    {SUB_OPTIONS.Monthly.map((numStr) => {
                      const isNumSelected = tempSubValue === numStr;
                      return (
                        <button
                          key={numStr}
                          type="button"
                          onClick={() => {
                            hapticSelection();
                            setTempSubValue(numStr);
                          }}
                          className={`flex h-7 sm:h-8 items-center justify-center rounded-md text-[11px] sm:text-xs font-bold transition-all ${
                            isNumSelected
                              ? 'bg-primary text-primary-foreground font-black shadow-sm scale-105'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          {numStr}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Daily Informational Note */}
              {tempType === 'Daily' && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Daily briefings are delivered every evening with tomorrow&apos;s schedule and attendance pace.
                  </p>
                </div>
              )}

              {/* Never Informational Note */}
              {tempType === 'Never' && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center gap-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Academic update summaries are turned off. You can re-enable Daily, Weekly, or Monthly anytime.
                  </p>
                </div>
              )}
            </div>

            {/* Action Row: Cancel / Apply */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={handleClose}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all shadow-sm"
              >
                <Check size={14} strokeWidth={2.5} />
                <span>Apply Frequency</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
