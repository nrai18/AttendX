"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronRight, Check, X, Sparkles } from 'lucide-react';

interface Step {
  id: number;
  title: string;
  isCompleted: boolean;
  onClick?: () => void;
}

interface ChecklistProps {
  steps: Step[];
  title?: string;
  onDismiss?: () => void;
}

export const OnboardingChecklist: React.FC<ChecklistProps> = ({ 
  steps, 
  title = "Getting started",
  onDismiss
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [theme] = useState<'light' | 'dark'>('light');
  
  const completedCount = steps.filter(s => s.isCompleted).length;
  const totalSteps = steps.length;
  const isAllComplete = totalSteps > 0 && completedCount === totalSteps;
  const springConfig = { type: "spring", stiffness: 300, damping: 30 } as const;

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="w-full flex flex-col items-center justify-center p-0 relative transition-colors duration-300">
        <motion.div
          layout
          transition={springConfig}
          className={`w-full max-w-md bg-[#F5F5F7] dark:bg-[#161616] border ${
            isAllComplete
              ? 'border-emerald-500/40 shadow-emerald-500/10'
              : 'border-[#E5E5E5] dark:border-white/10'
          } rounded-xl shadow-lg overflow-hidden transition-colors duration-300`}
        >
          {/* Header Section */}
          <div 
            onClick={() => setIsExpanded(!isExpanded)} 
            className="p-3 sm:p-3.5 flex items-center justify-between gap-2 cursor-pointer select-none"
          >
            {/* Left: Chevron + Title + Complete Status Pill */}
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
              <motion.div
                animate={{ rotate: isExpanded ? 0 : 180 }}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[#A1A1A1] hover:text-[#1A1A1A] dark:hover:text-[#EDEDED] shrink-0"
              >
                <ChevronUp size={18} className="sm:hidden" />
                <ChevronUp size={20} className="hidden sm:block" />
              </motion.div>
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <span className="font-bold text-[#1A1A1A] dark:text-[#EDEDED] text-[13px] sm:text-[14px] truncate">
                  {title}
                </span>
                {isAllComplete && (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                    <Sparkles size={10} className="text-emerald-500" /> Complete
                  </span>
                )}
              </div>
            </div>

            {/* Right: Step Indicator Micro-Dots + Counter + Close X */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <div className={`items-center gap-1 ${isAllComplete ? 'hidden sm:flex' : 'flex'}`}>
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-2.5 sm:h-3 w-1.5 sm:w-2 rounded-full transition-colors duration-300 ${
                      i < completedCount 
                      ? 'bg-emerald-500' 
                      : 'bg-[#E5E5E7] dark:bg-white/10'
                    }`}
                  />
                ))}
              </div>
              
              <span className={`text-[11px] sm:text-[12px] font-bold min-w-6 text-right tabular-nums ${
                isAllComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-500 dark:text-neutral-400'
              }`}>
                {completedCount}/{totalSteps}
              </span>

              {onDismiss && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                  title="Dismiss checklist"
                  className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Celebratory Banner when All Steps Completed */}
          {isAllComplete && !isExpanded && (
            <div className="px-3 pb-3 pt-0 flex items-center justify-between bg-emerald-500/5 border-t border-emerald-500/15">
              <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 truncate">
                🎉 All {totalSteps} steps completed! You're fully set.
              </p>
              {onDismiss && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 underline underline-offset-2 ml-2 shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          {/* Expanded Checklist Items */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={springConfig}
                className="border-t-[1.4px] border-[#E9E8EF] dark:border-white/5 bg-white dark:bg-[#1C1C1C]"
              >
                {isAllComplete && (
                  <div className="m-2 p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 text-sm">
                        🎉
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">All {totalSteps} Steps Complete!</p>
                        <p className="text-[11px] text-muted-foreground truncate">Your academic cockpit is fully unlocked.</p>
                      </div>
                    </div>
                    {onDismiss && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDismiss();
                        }}
                        className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer shrink-0"
                      >
                        Finish & Dismiss
                      </button>
                    )}
                  </div>
                )}

                <div className="p-1.5 sm:p-2 space-y-0.5 sm:y-1">
                  {steps.map((step) => {
                    const firstUncompletedId = steps.find(s => !s.isCompleted)?.id;
                    const isActive = step.id === firstUncompletedId;
                    
                    return (
                    <div 
                      key={step.id}
                      onClick={step.onClick}
                      className="group flex items-center justify-between p-2.5 sm:p-3 px-3 sm:px-4 hover:bg-[#F9F9F9] dark:hover:bg-white/5 rounded-xl cursor-pointer transition-all active:scale-[0.98] sm:active:scale-100"
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        {step.isCompleted ? (
                          <div className="w-5 h-4.5 sm:w-6 sm:h-5 rounded-full bg-[#00B613] shadow-sm shadow-[#238848] flex items-center justify-center shrink-0">
                            <Check size={10} strokeWidth={4} className="text-white sm:hidden" />
                            <Check size={12} strokeWidth={4} className="text-white hidden sm:block" />
                          </div>
                        ) : (
                          <div className={`w-5 h-4.5 sm:w-6 sm:h-5 rounded-full border-2 flex items-center justify-center text-[10px] sm:text-[12px] font-bold shrink-0 ${
                            isActive 
                            ? 'bg-[#48CAE4]/10 dark:bg-[#48CAE4]/10 border-[#48CAE4] dark:border-[#48CAE4] text-[#48CAE4] dark:text-[#48CAE4]' 
                            : 'border-[#E5E5E7] dark:border-[#333] text-[#A1A1A1] dark:text-[#888] shadow-sm shadow-[#8f8e8e]/40'
                          }`}>
                            {step.id}
                          </div>
                        )}
                        <span className={`text-[13px] sm:text-[14px] font-medium transition-colors truncate ${
                          step.isCompleted ? 'text-[#A1A1A1] dark:text-[#888] line-through decoration-white/20' : 'text-[#1A1A1A] dark:text-[#D4D4D4]'
                        }`}>
                          {step.title}
                        </span>
                      </div>
                      
                      {!step.isCompleted && (
                        <ChevronRight size={14} className={`shrink-0 sm:size-4 ${isActive ? 'text-[#48CAE4]' : 'text-[#D1D1D6] dark:text-[#444]'}`} />
                      )}
                    </div>
                  )})}

                  {onDismiss && (
                    <div className="pt-2 pb-1 px-2 border-t border-[#E9E8EF] dark:border-white/5 flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDismiss();
                        }}
                        className="text-[11px] font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        Dismiss checklist
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};
