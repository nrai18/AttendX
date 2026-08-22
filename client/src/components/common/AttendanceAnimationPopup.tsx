import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnimationPopupStore, AnimationType } from "../../stores/animationPopupStore";
import { ThumbsUp, Target, Frown, Sparkles } from "lucide-react";
import { HolidayIconRenderer } from "./HolidayIconRenderer";

export const HOLIDAY_ASSETS: Partial<Record<AnimationType, string>> = {
  republic_day: "/lottie/republic_day.json",
  holi: "/lottie/holi.json",
  eid: "/lottie/eid_al_fitr.json",
  ram_navami: "/lottie/ram_navami.json",
  mahavir_jayanti: "/lottie/mahavir_jayanti.json",
  good_friday: "/lottie/good_friday.json",
  buddha_purnima: "/lottie/buddha_purnima.json",
  muharram: "/lottie/muharram.json",
  janmashtami: "/lottie/janmashtami.json",
  gandhi_jayanti: "/lottie/gandhi_jayanti.json",
  dussehra: "/lottie/dussehra.json",
  diwali: "/lottie/diwali.json",
  guru_nanak: "/lottie/guru_nanak_jayanti.json",
  christmas: "/lottie/christmas.json",
  bakrid: "/lottie/bakrid.json",
  bhai_duj: "/lottie/bhai_duj.json",
  independence_day: "/lottie/independence_day.json",
  makar_sankranti: "/lottie/makar_sankranti.json",
  new_year: "/lottie/new_year.json",
  pongal: "/lottie/pongal.json",
  maha_shivaratri: "/lottie/maha_shivaratri.json",
  milad_un_nabi: "/lottie/milad_un_nabi.json",
  rakshabandhan: "/lottie/rakshabandhan.json",
  christmas_eve: "/lottie/christmas_eve.json"
};

export const AttendanceAnimationPopup: React.FC = () => {
  const { isOpen, type, message, closeAnimation } = useAnimationPopupStore();

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        closeAnimation();
      }, 1900); // 1.9s popup duration
      return () => clearTimeout(timer);
    }
  }, [isOpen, closeAnimation]);

  return (
    <AnimatePresence>
      {isOpen && type && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm cursor-pointer select-none"
          onClick={closeAnimation}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.3, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: -20 }}
            transition={{ type: "spring", damping: 15, stiffness: 300 }}
            className="relative bg-card/95 border border-border/80 shadow-2xl rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center flex flex-col items-center gap-4 overflow-hidden backdrop-blur-xl"
          >
            <button 
              onClick={closeAnimation} 
              className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors z-10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            {/* Background Glow Effect */}
            <div
              className={`absolute -inset-10 opacity-20 blur-3xl rounded-full transition-colors ${
                type === "thumbs_up"
                  ? "bg-emerald-500"
                  : type === "crying"
                  ? "bg-rose-500"
                  : type === "off_class"
                  ? "bg-amber-500"
                  : type === "full_day_off"
                  ? "bg-purple-500"
                  : "bg-blue-500"
              }`}
            />

            {/* 1. THUMBS UP ANIMATION */}
            {type === "thumbs_up" && (
              <div className="relative flex flex-col items-center">
                {/* Sparkle particles */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1], rotate: [0, 15, -10, 0] }}
                  transition={{ duration: 0.6 }}
                  className="w-24 h-24 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/30"
                >
                  <ThumbsUp className="w-12 h-12 fill-emerald-500/20 text-emerald-500" />
                </motion.div>

                {/* Floating Stars */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: [0, 1, 0], y: [-10, -40], x: [-15, 15] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="absolute -top-2 left-2 text-emerald-400"
                >
                  <Sparkles className="w-6 h-6" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: [0, 1, 0], y: [-10, -35], x: [15, -10] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }}
                  className="absolute -top-2 right-2 text-amber-400"
                >
                  <Sparkles className="w-5 h-5" />
                </motion.div>
              </div>
            )}

            {/* 2. CRYING / ATTENDANCE FALLS ANIMATION */}
            {type === "crying" && (
              <div className="relative flex flex-col items-center">
                <motion.div
                  initial={{ scale: 0.5, rotate: -10 }}
                  animate={{
                    scale: [0.8, 1.05, 1],
                    rotate: [-5, 5, -5, 0],
                  }}
                  transition={{ duration: 0.5 }}
                  className="w-24 h-24 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center border-2 border-rose-500/40 shadow-lg shadow-rose-500/30 relative"
                >
                  {/* Sad Emoji SVG / Icon */}
                  <span className="text-5xl">😭</span>

                  {/* Falling Animated Tear Drops */}
                  <motion.div
                    initial={{ opacity: 0, y: 0, scale: 0.8 }}
                    animate={{ opacity: [1, 1, 0], y: [0, 30], scale: [1, 1.2, 0.5] }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "easeIn" }}
                    className="absolute bottom-2 left-4 w-2.5 h-4 bg-cyan-400 rounded-full blur-[0.5px]"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 0, scale: 0.8 }}
                    animate={{ opacity: [1, 1, 0], y: [0, 30], scale: [1, 1.2, 0.5] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: 0.3, ease: "easeIn" }}
                    className="absolute bottom-2 right-4 w-2.5 h-4 bg-cyan-400 rounded-full blur-[0.5px]"
                  />
                </motion.div>
              </div>
            )}

            {/* 3. ARROW HITTING TARGET (75% TOUCHED) */}
            {type === "target_hit" && (
              <div className="relative w-32 h-32 flex items-center justify-center">
                {/* Dartboard Target */}
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="relative w-28 h-28 rounded-full border-4 border-amber-500 bg-amber-500/10 flex items-center justify-center shadow-xl shadow-amber-500/20 overflow-hidden"
                >
                  {/* Target Rings */}
                  <div className="w-20 h-20 rounded-full border-4 border-rose-500 bg-rose-500/10 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full border-4 border-white bg-amber-400 flex items-center justify-center font-black text-black text-xs shadow-inner">
                      75%
                    </div>
                  </div>
                </motion.div>

                {/* Flying Arrow striking center */}
                <motion.div
                  initial={{ x: 90, y: -90, scale: 1.5, opacity: 0, rotate: -45 }}
                  animate={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: -45 }}
                  transition={{ type: "spring", damping: 12, stiffness: 250, delay: 0.15 }}
                  className="absolute z-20"
                >
                  {/* Arrow SVG */}
                  <svg className="w-16 h-16 text-rose-600 drop-shadow-md" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </motion.div>

                {/* Impact Ripple Effect */}
                <motion.div
                  initial={{ scale: 0.2, opacity: 0 }}
                  animate={{ scale: [0.5, 1.8, 2.2], opacity: [0.8, 0.4, 0] }}
                  transition={{ duration: 0.6, delay: 0.25 }}
                  className="absolute w-12 h-12 rounded-full border-4 border-amber-400 pointer-events-none"
                />
              </div>
            )}

            {/* 4. DANCE ANIMATION FOR OFF CLASS */}
            {type === "off_class" && (
              <div className="relative flex flex-col items-center justify-center">
                <motion.div
                  initial={{ scale: 0, rotate: -15 }}
                  animate={{
                    scale: [0.8, 1.1, 1],
                    rotate: [-12, 12, -8, 8, 0],
                    y: [0, -10, 0, -5, 0],
                  }}
                  transition={{ duration: 0.7, repeat: Infinity, repeatType: "reverse" }}
                  className="w-24 h-24 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/30 text-5xl relative"
                >
                  💃
                </motion.div>

                {/* Floating Dancing Emojis & Music Notes */}
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.5 }}
                  animate={{ opacity: [0, 1, 0], y: [-10, -45], x: [-20, 20], scale: [0.5, 1.2, 0.8] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                  className="absolute -top-3 -left-3 text-2xl"
                >
                  🕺
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.5 }}
                  animate={{ opacity: [0, 1, 0], y: [-10, -40], x: [20, -15], scale: [0.5, 1.2, 0.8] }}
                  transition={{ duration: 1.3, repeat: Infinity, delay: 0.2 }}
                  className="absolute -top-2 -right-3 text-2xl"
                >
                  🎵
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 1] }}
                  transition={{ duration: 1.0, repeat: Infinity, delay: 0.4 }}
                  className="absolute -bottom-1 text-xl"
                >
                  ✨
                </motion.div>
              </div>
            )}

            {/* 5. CELEBRATION ANIMATION FOR FULL DAY OFF */}
            {type === "full_day_off" && (
              <div className="relative flex flex-col items-center justify-center">
                {/* Party Emoji Big Icon */}
                <motion.div
                  initial={{ scale: 0.2, rotate: -20 }}
                  animate={{
                    scale: [0.8, 1.25, 1],
                    rotate: [-15, 15, -10, 10, 0],
                  }}
                  transition={{ duration: 0.6 }}
                  className="w-28 h-28 rounded-full bg-gradient-to-tr from-purple-500/30 via-pink-500/20 to-amber-500/30 border-2 border-purple-500/40 flex items-center justify-center shadow-xl shadow-purple-500/30 text-6xl relative"
                >
                  🥳
                </motion.div>

                {/* Confetti Explosion Burst */}
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                    animate={{
                      opacity: [1, 1, 0],
                      scale: [0.5, 1, 0.5],
                      x: (i % 2 === 0 ? 1 : -1) * (20 + (i * 12)),
                      y: -20 - (i * 10),
                      rotate: i * 45,
                    }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1 }}
                    className="absolute text-xl pointer-events-none"
                  >
                    {["🎉", "✨", "🎈", "🍾", "🥂", "🎊", "🌟", "💫"][i]}
                  </motion.div>
                ))}
              </div>
            )}

            {/* 6. GENERIC HOLIDAY SVG ANIMATION */}
            {HOLIDAY_ASSETS[type as AnimationType] && (
              <div className="relative flex flex-col items-center justify-center">
                <motion.div
                  initial={{ scale: 0.2, rotate: -10 }}
                  animate={{ scale: [0.8, 1.15, 1], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 0.8, type: "spring", bounce: 0.5 }}
                  className="w-28 h-28 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center shadow-xl shadow-primary/10 relative overflow-hidden"
                >
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <HolidayIconRenderer 
                      src={HOLIDAY_ASSETS[type as AnimationType] as string} 
                      alt="Holiday Icon" 
                      className="w-16 h-16 drop-shadow-md"
                    />
                  </motion.div>
                </motion.div>
                {/* Soft Sparkles */}
                {[...Array(4)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 1, scale: 0, y: 0 }}
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [0.5, 1.2, 0],
                      y: -40 - (i * 10),
                      x: (i % 2 === 0 ? 1 : -1) * 35,
                    }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                    className="absolute text-primary/60"
                  >
                    <Sparkles size={16} />
                  </motion.div>
                ))}
              </div>
            )}

            {/* Message Text */}
            <div className="space-y-1 relative z-10 text-center">
              <h3 className="text-lg font-black text-foreground tracking-tight max-w-[200px] leading-tight mx-auto">
                {type === "thumbs_up" && "Awesome Job!"}
                {type === "crying" && "Attendance Dropped!"}
                {type === "target_hit" && "Target Touched!"}
                {type === "off_class" && "Yay! Off Class! 💃🕺"}
                {type === "full_day_off" && "Full Day Off! 🥳"}
                {HOLIDAY_ASSETS[type as AnimationType] && message}
              </h3>
              {!HOLIDAY_ASSETS[type as AnimationType] && (
                <p className="text-xs font-bold text-muted-foreground">{message}</p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
