import { VolumetricRays } from "../../components/ui/volumetric-rays";
import React, { useState } from "react";
import { FeedbackModal } from "../../components/support/FeedbackModal";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, HelpCircle, Import, Target, Smartphone, RefreshCw, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FAQS = [
  {
    question: "How do I import my timetable?",
    answer: "You can import your timetable seamlessly in Settings > Timetable. We support direct JSON imports or OCR-based photo scanning of your college timetable schedule.",
    icon: <Import className="w-5 h-5 text-emerald-500" />
  },
  {
    question: "How does the attendance criteria work?",
    answer: "The target percentage (e.g. 75%) is your threshold. AttendX calculates how many classes you can afford to miss (Safe Skips) or how many you need to attend (Required) to maintain this minimum target.",
    icon: <Target className="w-5 h-5 text-emerald-500" />
  },
  {
    question: "Does AttendX work offline?",
    answer: "Yes! AttendX uses an offline-first architecture. You can mark attendance, view your timetable, and see predictive forecasts entirely offline. Data will sync seamlessly once you reconnect.",
    icon: <Smartphone className="w-5 h-5 text-emerald-500" />
  },
  {
    question: "How do I clear or reset my data?",
    answer: "If you want to start fresh for a new semester, go to Settings > Danger Zone. You can selectively wipe your attendance logs, timetable, or perform a full factory reset.",
    icon: <RefreshCw className="w-5 h-5 text-emerald-500" />
  },
  {
    question: "Can I use AttendX on multiple devices?",
    answer: "Absolutely. Log in with the same account across your phone, tablet, and laptop. You can manage your active sessions from Settings > Linked Devices.",
    icon: <LogOut className="w-5 h-5 text-emerald-500" />
  }
];

export const FaqPage: React.FC = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  return (
    <div className="theme-nova-green w-full min-h-screen relative text-foreground">
      {/* Settings Isolated Theme Background */}
      <VolumetricRays />

      <div className="p-4 md:p-8 max-w-3xl mx-auto w-full pb-36 md:pb-8 space-y-8 animate-in fade-in duration-200 relative z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/settings")}
            className="p-2.5 rounded-xl bg-card border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors cursor-pointer shadow-lg shadow-emerald-500/5"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
              <HelpCircle className="w-7 h-7 text-emerald-500" />
              Frequently Asked Questions
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Everything you need to know about AttendX.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                key={index} 
                className={"bg-card border transition-colors duration-300 rounded-2xl overflow-hidden shadow-lg " + (isOpen ? "border-emerald-500/50 shadow-emerald-500/5" : "border-border/50 hover:border-emerald-500/30")}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-5 text-left cursor-pointer bg-transparent outline-none focus:outline-none"
                >
                  <div className="flex items-center gap-4">
                    <div className={"p-2 rounded-xl transition-colors " + (isOpen ? "bg-emerald-500/20" : "bg-muted/50")}>
                      {faq.icon}
                    </div>
                    <span className="font-bold text-[15px] text-foreground tracking-tight">
                      {faq.question}
                    </span>
                  </div>
                  <ChevronDown className={"w-5 h-5 text-muted-foreground transition-transform duration-300 " + (isOpen ? "rotate-180 text-emerald-500" : "")} />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="px-5 pb-6 pt-1 text-sm text-muted-foreground leading-relaxed border-t border-border/10 ml-16 mr-4">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="mt-12 bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-8 text-center max-w-xl mx-auto space-y-4 shadow-xl shadow-emerald-500/5">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <HelpCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-xl font-extrabold text-foreground tracking-tight">Still have questions?</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Can't find the answer you're looking for? Please reach out to our developer team and we'll get back to you as soon as possible.
          </p>
          <button
            onClick={() => setIsFeedbackOpen(true)}
            className="mt-2 inline-flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-8 py-3.5 rounded-full text-sm transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            Contact Support
          </button>
        </div>
      </div>
      
      <FeedbackModal 
        isOpen={isFeedbackOpen} 
        onClose={() => setIsFeedbackOpen(false)} 
      />
    </div>
  );
};
