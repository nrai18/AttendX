'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { Check, ChevronRight } from 'lucide-react';

/* ---------- Types ---------- */
export type FrequencyType = 'Never' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

export interface FrequencyData {
  type: FrequencyType;
  subValue?: string;
}

interface FrequencySelectorProps {
  value: FrequencyData;
  onChange: (data: FrequencyData) => void;
  className?: string;
}

/* ---------- Motion Config ---------- */
const smoothSpring = {
  type: 'spring',
  bounce: 0.3,
  duration: 0.7,
} as const;

/* ---------- Data ---------- */
const FREQUENCIES: FrequencyType[] = ['Never', 'Daily', 'Weekly', 'Monthly', 'Yearly'];

const SUB_OPTIONS: Record<FrequencyType, string[]> = {
  Never: [],
  Daily: [],
  Weekly: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  Monthly: Array.from({ length: 31 }, (_, i) => (i + 1).toString()),
  Yearly: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ],
};

export const FrequencySelector: React.FC<FrequencySelectorProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempType, setTempType] = useState<FrequencyType>(value.type);
  const [tempSubValue, setTempSubValue] = useState<string | undefined>(
    value.subValue,
  );

  const handleOpen = () => {
    setTempType(value.type);
    setTempSubValue(value.subValue || SUB_OPTIONS[value.type][0]);
    setIsOpen(true);
  };

  const handleConfirm = () => {
    onChange({
      type: tempType,
      subValue: tempType === 'Daily' ? undefined : tempSubValue,
    });
    setIsOpen(false);
  };

  return (
    <LayoutGroup id="frequency-root">
      <div
        className={`flex w-full items-center justify-center antialiased select-none ${className}`}
      >
        <AnimatePresence mode="wait">
          {!isOpen ? (
            /* ---------- CLOSED STATE ---------- */
            <motion.div
              layoutId="container"
              initial={{ filter: 'blur(4px)', opacity: 0 }}
              animate={{ filter: 'blur(0px)', opacity: 1 }}
              exit={{ filter: 'blur(4px)', opacity: 0 }}
              onClick={handleOpen}
              transition={smoothSpring}
              className="flex min-h-14 w-full max-w-md cursor-pointer items-center justify-between rounded-full bg-white/60 dark:bg-black/60 backdrop-blur-2xl border border-black/10 dark:border-white/10 p-1 pl-4 sm:pl-6 gap-4 hover:bg-white/80 dark:hover:bg-black/80 transition-colors shadow-sm"
            >
              <motion.span
                layout
                className="text-base font-bold text-slate-600 dark:text-slate-400 sm:text-lg"
              >
                Frequency
              </motion.span>

              <motion.div
                layoutId="trigger-pill"
                transition={smoothSpring}
                className="flex min-h-12 flex-1 items-center justify-between gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 py-1.5 shadow-sm sm:flex-initial sm:gap-3 sm:px-4"
              >
                <span className="text-base font-bold sm:text-lg text-slate-900 dark:text-white">
                  {value.type}
                  {value.subValue ? `, ${value.subValue}` : ''}
                </span>

                <ChevronRight size={18} className="shrink-0 text-slate-500 dark:text-slate-400" />
              </motion.div>
            </motion.div>
          ) : (
            /* ---------- OPEN STATE ---------- */
            <motion.div
              layoutId="container"
              initial={{ filter: 'blur(4px)', opacity: 0 }}
              animate={{ filter: 'blur(0px)', opacity: 1 }}
              exit={{ filter: 'blur(4px)', opacity: 0 }}
              transition={smoothSpring}
              className="flex w-full max-w-lg flex-col gap-3 rounded-[32px] border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/70 p-2 shadow-2xl backdrop-blur-2xl"
            >
              {/* Top Row */}
              <div className="flex items-center gap-2">
                <motion.div
                  layoutId="trigger-pill"
                  transition={smoothSpring}
                  className="custom-scrollbar relative flex h-11 flex-1 items-center gap-2 overflow-x-auto rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 p-1 shadow-inner sm:h-13 sm:gap-2"
                >
                  {FREQUENCIES.map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setTempType(type);
                        setTempSubValue(SUB_OPTIONS[type][0]);
                      }}
                      className={`relative flex h-full flex-none items-center justify-center px-4 text-xs font-bold transition-colors sm:flex-1 sm:min-w-fit sm:px-6 sm:text-[15px] ${
                        tempType === type ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      {tempType === type && (
                        <motion.div
                          layoutId="active-tab"
                          transition={smoothSpring}
                          className="absolute inset-0 z-0 rounded-full bg-white dark:bg-black shadow-sm border border-black/10 dark:border-white/10"
                        />
                      )}

                      <span className="relative z-10">{type}</span>
                    </button>
                  ))}
                </motion.div>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleConfirm}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 sm:h-12 sm:w-12 shadow-md hover:opacity-90 transition-opacity"
                >
                  <Check size={18} className="text-white dark:text-slate-900 stroke-white dark:stroke-slate-900" strokeWidth={2.5} />
                </motion.button>
              </div>

              {/* Sub Options */}
              <AnimatePresence mode="wait">
                {SUB_OPTIONS[tempType].length > 0 && (
                  <motion.div
                    layout
                    transition={smoothSpring}
                    className="overflow-hidden"
                  >
                    {SUB_OPTIONS[tempType].length > 0 && (
                      <motion.div
                        key={tempType}
                        layout
                        transition={smoothSpring}
                        className={`grid gap-2 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 p-3 shadow-inner ${
                          tempType === 'Monthly'
                            ? 'grid-cols-7'
                            : tempType === 'Yearly'
                              ? 'grid-cols-4'
                              : 'grid-cols-7'
                        }`}
                      >
                        {SUB_OPTIONS[tempType].map((option) => (
                          <button
                            key={option}
                            onClick={() => setTempSubValue(option)}
                            className={`relative flex h-8 items-center justify-center rounded-full text-[10px] font-bold transition-colors sm:h-9 sm:text-sm ${
                              tempSubValue === option ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                          >
                            {tempSubValue === option && (
                              <motion.div
                                layoutId="active-sub"
                                transition={smoothSpring}
                                className="absolute inset-0 z-0 rounded-full bg-white dark:bg-black shadow-sm border border-black/10 dark:border-white/10"
                              />
                            )}

                            <span className="relative z-10">{option}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
};
