import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, ArrowLeft, ArrowRight, CalendarDays, Brain, Users, Moon, Sun, Phone, Mail } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useThemeStore } from "../../stores/themeStore";

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  
  const [animStep, setAnimStep] = useState(0);

  const photoRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: photoRef,
    offset: ["start end", "center center"]
  });

  const grayscale = useTransform(scrollYProgress, [0, 1], ["100%", "0%"]);
  const [isPhotoVisible, setIsPhotoVisible] = useState(false);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    setIsPhotoVisible(latest > 0.8);
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/today");
      return;
    }
    
    const t1 = setTimeout(() => setAnimStep(1), 800);
    const t2 = setTimeout(() => setAnimStep(2), 1600);
    const t3 = setTimeout(() => setAnimStep(3), 2400);
    const t4 = setTimeout(() => setAnimStep(4), 3000);

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
    };
  }, [isAuthenticated, navigate]);

  return (
    <div className="bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-slate-50 overflow-x-hidden relative font-sans selection:bg-[#48CAE4] selection:text-black">
      
      {/* --- SKELETON LOADER (Visible only in Step 0) --- */}
      <div 
        className={`fixed inset-0 z-50 bg-slate-50 dark:bg-[#050505] flex flex-col justify-between p-8 md:p-16 transition-opacity duration-1000 pointer-events-none ${animStep >= 1 ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className="flex justify-between items-center w-full">
          <div className="w-32 h-8 bg-slate-50/5 rounded-md animate-pulse" />
          <div className="hidden md:flex gap-12">
            <div className="w-16 h-4 bg-slate-50/5 rounded-md animate-pulse" />
            <div className="w-16 h-4 bg-slate-50/5 rounded-md animate-pulse" />
            <div className="w-16 h-4 bg-slate-50/5 rounded-md animate-pulse" />
          </div>
        </div>
        <div className="w-full flex justify-between items-end">
          <div className="w-[60vw] h-[20vh] bg-slate-50/5 rounded-xl animate-pulse" />
          <div className="w-32 h-24 bg-slate-50/5 rounded-lg animate-pulse" />
        </div>
        <div className="flex justify-between items-center">
          <div className="w-48 h-10 bg-slate-50/5 rounded-full animate-pulse" />
          <div className="w-14 h-14 bg-slate-50/5 rounded-full animate-pulse" />
        </div>
      </div>

      {/* --- GEOMETRIC BACKGROUND (Fades in at Step 1) --- */}
      <div className={`fixed inset-0 z-0 pointer-events-none transition-opacity duration-[1500ms] ${animStep >= 1 ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-0 bg-[#2d007a]" />
        <div 
          className="absolute top-0 left-0 w-[80vw] h-[120vh] bg-[#0066ff] shadow-[20px_0_50px_rgba(0,0,0,0.5)]"
          style={{ clipPath: 'polygon(0 0, 70% 0, 0 100%)' }}
        />
        <div 
          className="absolute top-0 right-0 w-[100vw] h-[150vh] bg-[#f0143c] shadow-[-20px_0_50px_rgba(0,0,0,0.5)]"
          style={{ clipPath: 'polygon(45% 0, 100% 0, 100% 100%, 15% 100%)' }}
        />
        <div 
          className="absolute -bottom-[30vh] right-[-10vw] w-[120vw] h-[60vh] bg-[#3d0010] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] rounded-[100%_100%_0_0]" 
        />
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{ 
            backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', 
            backgroundSize: '80px 80px',
            backgroundPosition: 'center center'
          }} 
        />
      </div>

      {/* --- MOBILE MENU OVERLAY --- */}
      <div className={`fixed inset-0 z-[100] bg-white/95 dark:bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center transition-all duration-500 md:hidden ${isMobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
        <button onClick={() => setIsMobileMenuOpen(false)} className="absolute top-8 right-8 p-2 text-slate-500 hover:text-slate-900 dark:text-slate-50/50 dark:hover:text-slate-50">
          <X className="w-8 h-8" />
        </button>
        <div className="flex flex-col items-center gap-12 text-2xl font-black tracking-widest uppercase text-slate-900/90 dark:text-slate-50/90">
          <a href="#overview" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#48CAE4] transition-colors">Overview</a>
          <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#48CAE4] transition-colors">Platform</a>
          <a href="#about" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#48CAE4] transition-colors">Creator</a>
          <a href="#support" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#48CAE4] transition-colors">Connect</a>
          <Link to="/login" className="text-[#48CAE4] mt-8 px-8 py-4 border border-[#48CAE4]/30 rounded-full hover:bg-[#48CAE4]/10 transition-colors">Get Started</Link>
        </div>
      </div>

      {/* --- CONTENT LAYER --- */}
      <div className="relative z-10 w-full">
        
        {/* HERO SECTION */}
        <div className="min-h-[100dvh] flex flex-col justify-between">
          
          {/* NAVIGATION (Fades in at Step 3) */}
          <nav className={`flex items-center justify-between px-8 py-8 md:px-16 w-full transition-all duration-1000 translate-y-0 ${animStep >= 3 ? 'opacity-100' : 'opacity-0 -translate-y-4'}`}>
            <div className="flex items-center z-20">
              <img 
                src="/attendx_logo_lockup.png" 
                alt="AttendX Logo" 
                className="h-14 md:h-20 w-auto object-contain brightness-0 invert opacity-90 hover:opacity-100 transition-opacity" 
              />
            </div>
            <div className="hidden md:flex items-center gap-10 text-[9px] font-bold tracking-[0.25em] uppercase text-slate-50/90">
              <a href="#overview" className="hover:text-[#48CAE4] transition-colors">Overview</a>
              <span className="w-1 h-1 rounded-full bg-slate-50/30" />
              <a href="#features" className="hover:text-[#48CAE4] transition-colors">Platform</a>
              <span className="w-1 h-1 rounded-full bg-slate-50/30" />
              <a href="#about" className="hover:text-[#48CAE4] transition-colors">Creator</a>
              <span className="w-1 h-1 rounded-full bg-slate-50/30" />
              <a href="#support" className="hover:text-[#48CAE4] transition-colors">Connect</a>
              <span className="w-1 h-1 rounded-full bg-slate-50/30" />
              <Link to="/login" className="hover:text-[#48CAE4] transition-colors">Get Started</Link>
            </div>
            <div className="flex items-center gap-2 md:gap-4 z-20">
              <button 
                onClick={toggleTheme} 
                className="p-2 text-slate-50/80 hover:text-slate-50 hover:bg-slate-50/10 rounded-full transition-colors"
                title="Toggle App Theme"
              >
                {theme === "dark" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
              <Link to="/login" className="text-xs sm:text-sm font-bold tracking-widest uppercase text-slate-50 md:hidden hover:text-[#48CAE4] transition-colors ml-2 mr-2">
                Log In
              </Link>
              <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-50/80 hover:text-slate-50 transition-colors md:hidden">
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </nav>

          {/* HERO TYPOGRAPHY */}
          <main className="flex-1 flex items-center px-8 md:px-16 lg:px-32 relative">
            <div className="w-full flex flex-col md:flex-row items-start md:items-end justify-between gap-8 translate-y-[-10vh]">
              
              <h1 
                className="text-[18vw] md:text-[13vw] lg:text-[11vw] font-black leading-[0.8] tracking-tighter uppercase drop-shadow-2xl overflow-hidden py-4"
              >
                <div 
                  className="transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] flex"
                  style={{ transform: animStep >= 2 ? 'translateY(0)' : 'translateY(120%)' }}
                >
                  <span className="text-[#48CAE4]">A</span>
                  <span className="text-slate-50">TTENDX</span>
                </div>
              </h1>

              <div 
                className={`flex flex-col gap-5 mb-4 md:mb-12 shrink-0 z-20 transition-all duration-1000 delay-300 ${animStep >= 3 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
              >
                <div className="text-[10px] md:text-[11px] font-mono font-bold tracking-[0.3em] uppercase leading-[1.8] text-slate-900 dark:text-slate-50">
                  Smart<br />
                  Attendance<br />
                  Tracker
                </div>
                <div className="w-12 h-[1px] bg-slate-50/60" />
              </div>
            </div>
          </main>

          {/* BOTTOM CONTROLS (Step 4) */}
          <footer className={`w-full px-6 md:px-16 py-8 md:py-12 flex flex-col md:flex-row items-center justify-end z-20 transition-all duration-1000 ${animStep >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="hidden md:block flex-1" />
            <Link 
              to="/login"
              className="w-full md:w-auto px-8 h-14 rounded-none border-2 border-black dark:border-[#222222] bg-[#48CAE4] flex items-center justify-center gap-4 text-[#050505] font-black uppercase tracking-widest text-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_#111111] hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[10px_10px_0px_0px_#111111] transition-all cursor-pointer group"
            >
              <span>Get Started</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </footer>
        </div>

        
        {/* --- SCROLLABLE SECTIONS --- */}
        <div className="bg-slate-50/95 dark:bg-[#050505]/95 backdrop-blur-xl relative z-20 border-t border-black/10 dark:border-slate-50/10 transition-opacity duration-1000 delay-500">
          
          {/* OVERVIEW SECTION */}
          <section id="overview" className="py-20 md:py-32 px-6 md:px-16 lg:px-32 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row gap-12 md:gap-16 justify-between items-start">
              <div className="w-full md:w-1/2">
                <div className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase text-slate-400 mb-4">01 — Overview</div>
                <h2 className="text-5xl md:text-6xl lg:text-7xl font-black uppercase tracking-tight mb-8 text-black dark:text-[#ffffff] leading-[0.9]">Built for<br />Modern<br />Campuses.</h2>
              </div>
              <div className="w-full md:w-1/2 text-slate-600 dark:text-slate-50/60 leading-relaxed space-y-6 pt-0 md:pt-16">
                <p className="text-xl font-medium text-slate-900 dark:text-slate-50/90">
                  We built AttendX to solve the exact problems we face every semester. Automated, smart, and beautifully designed.
                </p>
                <p>
                  Say goodbye to manual tracking and messy spreadsheets. AttendX uses advanced algorithms and seamless peer synchronization to ensure you always know exactly where your attendance stands, so you can focus on what actually matters.
                </p>
                <div className="flex gap-8 pt-8 border-t border-black/10 dark:border-slate-50/10">
                  <div>
                    <div className="text-4xl font-black text-[#48CAE4] mb-2">200+</div>
                    <div className="text-[10px] font-mono tracking-widest uppercase text-slate-400">Active Students</div>
                  </div>
                  <div>
                    <div className="text-4xl font-black text-[#E63946] mb-2">100%</div>
                    <div className="text-[10px] font-mono tracking-widest uppercase text-slate-400">Automated Tracking</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FEATURES SECTION */}
          <section id="features" className="py-20 md:py-32 px-6 md:px-16 lg:px-32 max-w-7xl mx-auto border-t border-black/5 dark:border-slate-50/5">
            <div className="mb-16 md:mb-20">
              <div className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase text-[#48CAE4] mb-4">02 — Platform</div>
              <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-black dark:text-[#ffffff] leading-[0.9]">Everything you need<br />to succeed.</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              <div className="bg-white dark:bg-[#111111] border-2 border-black dark:border-[#222222] p-8 hover:-translate-y-2 hover:border-[#48CAE4] hover:shadow-[8px_8px_0px_0px_#48CAE4] transition-all duration-300 group cursor-default">
                <div className="w-14 h-14 border-2 border-[#48CAE4] bg-[#48CAE4]/10 flex items-center justify-center mb-8">
                  <CalendarDays className="w-6 h-6 text-[#48CAE4] group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h3 className="text-xl font-black mb-4 text-black dark:text-[#ffffff] uppercase tracking-wide">Smart Timetable</h3>
                <p className="text-slate-600 dark:text-slate-50/60 leading-relaxed text-sm font-medium">Interactive dynamic timetable that knows exactly what classes you have today and automatically calculates absences.</p>
              </div>

              <div className="bg-white dark:bg-[#111111] border-2 border-black dark:border-[#222222] p-8 hover:-translate-y-2 hover:border-[#E63946] hover:shadow-[8px_8px_0px_0px_#E63946] transition-all duration-300 group cursor-default">
                <div className="w-14 h-14 border-2 border-[#E63946] bg-[#E63946]/10 flex items-center justify-center mb-8">
                  <Brain className="w-6 h-6 text-[#E63946] group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h3 className="text-xl font-black mb-4 text-black dark:text-[#ffffff] uppercase tracking-wide">Absence Predictions</h3>
                <p className="text-slate-600 dark:text-slate-50/60 leading-relaxed text-sm font-medium">Set your target (e.g. 75%) and AttendX will tell you exactly how many more classes you can safely skip.</p>
              </div>

              <div className="bg-white dark:bg-[#111111] border-2 border-black dark:border-[#222222] p-8 hover:-translate-y-2 hover:border-[#A855F7] hover:shadow-[8px_8px_0px_0px_#A855F7] transition-all duration-300 group cursor-default">
                <div className="w-14 h-14 border-2 border-[#A855F7] bg-[#A855F7]/10 flex items-center justify-center mb-8">
                  <Users className="w-6 h-6 text-[#A855F7] group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h3 className="text-xl font-black mb-4 text-black dark:text-[#ffffff] uppercase tracking-wide">Classrooms Hub</h3>
                <p className="text-slate-600 dark:text-slate-50/60 leading-relaxed text-sm font-medium">Join your batch's classroom to get official announcements and notes directly from your CR.</p>
              </div>
            </div>
          </section>

          {/* ABOUT THE CREATOR SECTION */}
          <section id="about" className="py-20 md:py-32 px-6 md:px-16 lg:px-32 max-w-7xl mx-auto border-t border-black/5 dark:border-slate-50/5">
          <div className="flex flex-col md:flex-row gap-12 md:gap-16 justify-between items-start">
              <div className="w-full md:w-1/3">
                <div className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase text-[#48CAE4] mb-4">03 — Creator</div>
                <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tight mb-8 text-black dark:text-[#ffffff] leading-[0.9]">Naman<br />Rai.</h2>
                
<motion.div 
  ref={photoRef}
  style={{ "--mobile-grayscale": grayscale } as any}
  className={`w-full max-w-[280px] md:max-w-none aspect-square overflow-hidden border-2 mb-6 transition-all duration-700 mx-auto md:mx-0 cursor-pointer
    [filter:grayscale(var(--mobile-grayscale,100%))] md:!filter-none
    ${isPhotoVisible ? 'border-[#48CAE4] shadow-[8px_8px_0px_0px_#48CAE4] -translate-y-2' : 'border-black dark:border-[#333333] shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[8px_8px_0px_0px_#222222]'}
    md:grayscale md:border-black md:dark:border-[#333333] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] md:dark:shadow-[8px_8px_0px_0px_#222222] md:translate-y-0
    md:hover:grayscale-0 md:hover:border-[#48CAE4] md:dark:hover:border-[#48CAE4] md:hover:-translate-y-2 md:hover:shadow-[8px_8px_0px_0px_#48CAE4] md:dark:hover:shadow-[8px_8px_0px_0px_#48CAE4]
  `}
>
                  <img src="/developer-photo.jpg" alt="Naman Rai" className="w-full h-full object-cover bg-slate-100 dark:bg-[#111111]" />
                </motion.div>
                <div className="text-sm font-black tracking-widest uppercase text-slate-900 dark:text-slate-50 text-center md:text-left">Founder & Developer</div>
                <div className="text-xs text-slate-500 font-mono mt-2 text-center md:text-left">IIITU Student</div>
              </div>
              
              <div className="w-full md:w-2/3 text-slate-600 dark:text-slate-50/60 leading-relaxed space-y-6 pt-0 md:pt-8">
                <div className="p-6 md:p-8 border-2 border-black dark:border-[#222222] bg-white dark:bg-[#0A0A0A] relative shadow-[8px_8px_0px_0px_#E63946]">
                  <div className="absolute top-0 left-0 w-2 h-full bg-[#E63946]" />
                  <p className="text-xl md:text-2xl font-black uppercase tracking-tight text-black dark:text-[#ffffff] mb-4 leading-snug">
                    "I was tired of manually calculating attendance percentages."
                  </p>
                  <p className="font-mono text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400">
                    Constantly worrying about falling below the mandatory 75% criteria was a massive distraction.
                  </p>
                </div>
                <p className="pt-6 md:pt-8 font-medium">
                  AttendX was developed out of absolute necessity. Our mission is to provide a seamless, stress-free academic experience. By centralizing timetables, attendance tracking, and classroom communication into one platform, students can focus on learning instead of spreadsheets.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 md:pt-8">
                  <div className="border-2 border-black dark:border-[#222222] bg-white dark:bg-[#111111] p-6 flex flex-col gap-2 hover:border-[#48CAE4] dark:hover:border-[#48CAE4] hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#48CAE4] transition-all">
                    <div className="text-[10px] font-mono tracking-widest uppercase text-[#48CAE4] font-bold">Tech Stack</div>
                    <div className="text-slate-900 dark:text-slate-50 font-black uppercase tracking-wide text-sm">Modern Web Tech</div>
                  </div>
                  <div className="border-2 border-black dark:border-[#222222] bg-white dark:bg-[#111111] p-6 flex flex-col gap-2 hover:border-[#E63946] dark:hover:border-[#E63946] hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#E63946] transition-all">
                    <div className="text-[10px] font-mono tracking-widest uppercase text-[#E63946] font-bold">Ecosystem</div>
                    <div className="text-slate-900 dark:text-slate-50 font-black uppercase tracking-wide text-sm">Exclusive for IIITU</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SUPPORT & CONNECT SECTION */}
          <section id="support" className="py-20 md:py-32 px-6 md:px-16 lg:px-32 max-w-7xl mx-auto border-t border-black/5 dark:border-slate-50/5">
            <div className="flex flex-col md:flex-row gap-12 md:gap-16 justify-between items-start">
              <div className="w-full md:w-1/3">
                <div className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase text-[#E63946] mb-4">04 — Connect</div>
                <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tight mb-8 text-black dark:text-[#ffffff] leading-[0.9]">Reach<br className="hidden md:block" /> Us.</h2>
                <p className="text-slate-600 dark:text-slate-50/60 font-medium leading-relaxed max-w-sm">
                  Have questions, feature requests, or need help setting up your college's timetable?
                </p>
              </div>

              <div className="w-full md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 md:pl-16">
                
                <a href="tel:+918076408958" className="border-2 border-black dark:border-[#222222] bg-white dark:bg-[#111111] p-6 md:p-8 flex flex-col items-start gap-6 hover:border-[#E63946] dark:hover:border-[#E63946] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#E63946] transition-all group">
                  <div className="w-12 h-12 border-2 border-[#E63946] bg-[#E63946]/10 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-[#E63946] group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono tracking-widest uppercase text-slate-400 font-bold mb-1">Phone</div>
                    <div className="text-slate-900 dark:text-slate-50 font-black group-hover:text-[#E63946] transition-colors">+91 80764 08958</div>
                  </div>
                </a>

                <a href="mailto:support@mail.attendx.tech" className="border-2 border-black dark:border-[#222222] bg-white dark:bg-[#111111] p-6 md:p-8 flex flex-col items-start gap-6 hover:border-[#E63946] dark:hover:border-[#E63946] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#E63946] transition-all group overflow-hidden">
                  <div className="w-12 h-12 border-2 border-[#E63946] bg-[#E63946]/10 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-[#E63946] group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="w-full">
                    <div className="text-[10px] font-mono tracking-widest uppercase text-slate-400 font-bold mb-1">Support Email</div>
                    <div className="text-slate-900 dark:text-slate-50 font-black group-hover:text-[#E63946] transition-colors text-xs sm:text-sm md:text-base truncate w-full">support@mail.attendx.tech</div>
                  </div>
                </a>
                
                <a href="mailto:admin@mail.attendx.tech" className="border-2 border-black dark:border-[#222222] bg-white dark:bg-[#111111] p-6 md:p-8 flex flex-col items-start gap-6 hover:border-[#E63946] dark:hover:border-[#E63946] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#E63946] transition-all group overflow-hidden">
                  <div className="w-12 h-12 border-2 border-[#E63946] bg-[#E63946]/10 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-[#E63946] group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="w-full">
                    <div className="text-[10px] font-mono tracking-widest uppercase text-slate-400 font-bold mb-1">Admin / Developer</div>
                    <div className="text-slate-900 dark:text-slate-50 font-black group-hover:text-[#E63946] transition-colors text-xs sm:text-sm md:text-base truncate w-full">admin@mail.attendx.tech</div>
                  </div>
                </a>

                <a href="mailto:rai18naman@gmail.com" className="border-2 border-black dark:border-[#222222] bg-white dark:bg-[#111111] p-6 md:p-8 flex flex-col items-start gap-6 hover:border-[#E63946] dark:hover:border-[#E63946] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#E63946] transition-all group overflow-hidden">
                  <div className="w-12 h-12 border-2 border-[#E63946] bg-[#E63946]/10 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-[#E63946] group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="w-full">
                    <div className="text-[10px] font-mono tracking-widest uppercase text-slate-400 font-bold mb-1">Personal Email</div>
                    <div className="text-slate-900 dark:text-slate-50 font-black group-hover:text-[#E63946] transition-colors text-xs sm:text-sm md:text-base truncate w-full">rai18naman@gmail.com</div>
                  </div>
                </a>

                <a href="https://github.com/nrai18/AttendX" target="_blank" rel="noopener noreferrer" className="sm:col-span-2 border-2 border-black dark:border-[#222222] bg-white dark:bg-[#111111] p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 hover:border-[#E63946] dark:hover:border-[#E63946] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#E63946] transition-all group">
                  <div className="flex flex-col gap-1 w-full sm:w-auto">
                    <div className="text-[10px] font-mono tracking-widest uppercase text-slate-400 font-bold">GitHub Repository</div>
                    <div className="text-slate-900 dark:text-slate-50 font-black group-hover:text-[#E63946] transition-colors truncate">github.com/nrai18/AttendX</div>
                  </div>
                  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className="w-8 h-8 text-[#E63946] group-hover:scale-110 transition-transform shrink-0"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                </a>
              </div>
            </div>
          </section>
          
          <footer className="py-12 px-6 md:px-16 flex flex-col md:flex-row justify-between items-center text-xs font-mono text-slate-400 border-t border-black/10 dark:border-slate-50/10 gap-6 text-center md:text-left">
            <div>© 2026 ATTENDX. ALL RIGHTS RESERVED.</div>
            <div className="flex gap-8">
               <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-slate-50 transition-colors uppercase tracking-widest font-bold">Privacy Policy</Link>
               <Link to="/terms" className="hover:text-slate-900 dark:hover:text-slate-50 transition-colors uppercase tracking-widest font-bold">Terms of Service</Link>
            </div>
          </footer>
        </div>

      </div>
    </div>
  );
};
