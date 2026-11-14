import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  Calendar,
  Sparkles,
  Bot,
  GraduationCap,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Bell,
  Sliders,
  BookOpen,
  TrendingUp,
  ShieldCheck,
  CheckCheck,
  Undo2,
  MessageSquare,
  FileText,
  VolumeOff,
  Moon,
  LogOut,
  AppWindow,
  FileCheck,
  Share2,
  RefreshCw,
  Palette,
} from "lucide-react";

// Duration is exactly 90.00 seconds (2700 frames @ 30 FPS)
const TOTAL_DURATION = 90.0;

// All 9 Cinematic Acts
const SCENES = [
  { id: "act1", start: 0.0, end: 10.0, label: "01. Enter Ecosystem" },
  { id: "act2", start: 10.0, end: 20.0, label: "02. Academic Planning" },
  { id: "act3", start: 20.0, end: 31.0, label: "03. Attendance AI" },
  { id: "act4", start: 31.0, end: 41.0, label: "04. Calendar & Hub" },
  { id: "act5", start: 41.0, end: 51.0, label: "05. 0ms AI Copilot" },
  { id: "act6", start: 51.0, end: 61.0, label: "06. Theme Morph" },
  { id: "act7", start: 61.0, end: 71.0, label: "07. Connected Android" },
  { id: "act8", start: 71.0, end: 81.0, label: "08. Peer Sync & OTA" },
  { id: "act9", start: 81.0, end: 90.0, label: "09. Modern Ecosystem" },
];

export const PromoVideoPage: React.FC = () => {
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoViewportRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Sound Synthesizer Helper for Tactile Clicks & Transitions
  const playTactileSound = useCallback((type: "click" | "snap" | "chime" | "whoosh") => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const now = ctx.currentTime;
      if (type === "click") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(820, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.045);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.045);
      } else if (type === "snap") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === "chime") {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);
          gain.gain.setValueAtTime(0.06, now + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.05);
          osc.stop(now + idx * 0.05 + 0.5);
        });
      }
    } catch {}
  }, [isMuted]);

  // Synchronize Audio Soundtrack with Video Playhead
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.muted = isMuted;
    audio.playbackRate = playbackRate;

    if (isPlaying) {
      if (Math.abs(audio.currentTime - currentTime) > 0.3) {
        audio.currentTime = currentTime;
      }
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying, isMuted, playbackRate]);

  // Handle Playhead Seek in Audio
  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Trigger Tactile Sounds at precise timestamps
  const lastSoundRef = useRef<number>(-1);
  useEffect(() => {
    if (currentTime >= 12.75 && currentTime <= 12.95 && lastSoundRef.current !== 1) {
      playTactileSound("click");
      lastSoundRef.current = 1;
    } else if (currentTime >= 15.15 && currentTime <= 15.35 && lastSoundRef.current !== 2) {
      playTactileSound("click");
      lastSoundRef.current = 2;
    } else if (currentTime >= 42.0 && currentTime <= 42.2 && lastSoundRef.current !== 3) {
      playTactileSound("chime");
      lastSoundRef.current = 3;
    } else if (currentTime >= 53.4 && currentTime <= 53.6 && lastSoundRef.current !== 4) {
      playTactileSound("snap");
      lastSoundRef.current = 4;
    } else if (currentTime >= 56.9 && currentTime <= 57.1 && lastSoundRef.current !== 5) {
      playTactileSound("snap");
      lastSoundRef.current = 5;
    } else if (currentTime < 10.0) {
      lastSoundRef.current = -1;
    }
  }, [currentTime, playTactileSound]);

  // Request Animation Frame Loop (60 FPS playback clock)
  useEffect(() => {
    let animId: number;

    const tick = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      if (isPlaying) {
        setCurrentTime((prev) => {
          const next = prev + delta * playbackRate;
          if (next >= TOTAL_DURATION) {
            setIsPlaying(false);
            if (audioRef.current) audioRef.current.pause();
            return TOTAL_DURATION;
          }
          return next;
        });
      }

      animId = requestAnimationFrame(tick);
    };

    lastTimeRef.current = performance.now();
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, playbackRate]);

  // Keyboard Shortcuts (Space for toggle play, Left/Right arrow for seek)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handleSeek(Math.max(0, currentTime - 2));
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleSeek(Math.min(TOTAL_DURATION, currentTime + 2));
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if (e.key === "m" || e.key === "M") {
        setIsMuted((m) => !m);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentTime]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const jumpToScene = (start: number) => {
    handleSeek(start);
    playTactileSound("click");
  };

  // Direct High-Resolution MP4 Download
  const handleDownloadMp4 = () => {
    const a = document.createElement("a");
    a.href = "/AttendX_Launch_Video.mp4";
    a.download = "AttendX_Launch_Video.mp4";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Browser Screen Recording Pipeline
  const startRecording = async () => {
    if (!videoViewportRef.current) return;
    try {
      const stream = (videoViewportRef.current as any).captureStream
        ? (videoViewportRef.current as any).captureStream(60)
        : null;

      if (!stream) {
        handleDownloadMp4();
        return;
      }

      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "AttendX_Launch_Video.webm";
        a.click();
        URL.revokeObjectURL(url);
        setIsRecording(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      handleSeek(0);
      setIsPlaying(true);
    } catch (e) {
      console.error("Recording error:", e);
      handleDownloadMp4();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  // Active scene calculation
  const activeScene = useMemo(() => {
    return SCENES.find((s) => currentTime >= s.start && currentTime < s.end) || SCENES[SCENES.length - 1];
  }, [currentTime]);

  const t = currentTime;

  // Single Realistic Cursor Interpolation for Act 2 (11.5s – 17.5s)
  const cursorState = useMemo(() => {
    if (t < 11.5 || t > 18.0) return null;

    if (t >= 11.5 && t < 13.5) {
      const prog = Math.min(1, (t - 11.5) / 1.0);
      const ease = 1 - Math.pow(1 - prog, 3);
      const curX = 280 - (280 - 240) * ease;
      const curY = 320 - (320 - 196) * ease;
      const isPressing = t >= 12.75 && t <= 13.0;
      return { x: curX, y: curY, scale: isPressing ? 0.82 : 1, ripple: isPressing };
    }

    if (t >= 13.5 && t < 16.5) {
      const prog = Math.min(1, (t - 13.8) / 1.1);
      const ease = 1 - Math.pow(1 - prog, 3);
      const curX = 240 - (240 - 145) * ease;
      const curY = 196 + (278 - 196) * ease;
      const isPressing = t >= 15.15 && t <= 15.4;
      return { x: curX, y: curY, scale: isPressing ? 0.82 : 1, ripple: isPressing };
    }

    if (t >= 16.5 && t <= 18.0) {
      const prog = (t - 16.5) / 1.5;
      return { x: 145 + prog * 100, y: 278 + prog * 80, scale: 1, ripple: false };
    }

    return null;
  }, [t]);

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[#0d0f12] text-slate-100 flex flex-col items-center justify-between p-3 md:p-6 select-none font-sans"
    >
      {/* 90-Second Audio Soundtrack */}
      <audio
        ref={audioRef}
        src="/promo_soundtrack_90s.mp3"
        preload="auto"
      />

      {/* Google Web Fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Silkscreen&family=JetBrains+Mono:wght@400;600;700&display=swap"
        rel="stylesheet"
      />

      <style>{`
        .font-nothing-serif { font-family: 'Instrument Serif', Georgia, serif; }
        .font-ndot { font-family: 'Silkscreen', 'JetBrains Mono', monospace; letter-spacing: -0.04em; }
        
        .perspective-canvas {
          perspective: 1400px;
          transform-style: preserve-3d;
        }
      `}</style>

      {/* Top Header Bar */}
      <header className="w-full max-w-6xl flex items-center justify-between mb-3 px-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white flex items-center gap-2">
              AttendX Cinematic Launch Film
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                Modern Ecosystem
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                v4.3.0
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              90s 4K Product Film • 9 Acts • Sound Design Synced • Nothing OS Aesthetic
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 9 Acts Jump Pills */}
          <div className="hidden xl:flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-full p-1">
            {SCENES.map((scene) => (
              <button
                key={scene.id}
                onClick={() => jumpToScene(scene.start)}
                className={`text-[10px] px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                  activeScene.id === scene.id
                    ? "bg-white text-black font-semibold shadow"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                {scene.label}
              </button>
            ))}
          </div>

          {/* Sound Mute / Unmute Button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
            title={isMuted ? "Unmute Soundtrack" : "Mute Soundtrack"}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse hidden sm:inline-block" />
              </>
            )}
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 16:9 Cinematic Video Viewport */}
      <main className="w-full max-w-6xl flex-1 flex items-center justify-center relative">
        <div
          ref={videoViewportRef}
          className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-slate-800/80 relative perspective-canvas flex items-center justify-center select-none"
          style={{
            background:
              t >= 51.0 && t < 61.0
                ? t >= 57.0
                  ? "radial-gradient(circle at center, #4c0519 0%, #1c0209 100%)"
                  : t >= 53.5
                  ? "radial-gradient(circle at center, #022c22 0%, #061512 100%)"
                  : "linear-gradient(135deg, #dbe4f0 0%, #ecdfe3 50%, #f6d8d9 100%)"
                : "linear-gradient(135deg, #dbe4f0 0%, #ecdfe3 50%, #f6d8d9 100%)",
            transition: "background 0.6s ease",
          }}
        >
          {/* Subtle Ambient Vignette & Texture */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_65%,rgba(0,0,0,0.08)_100%)] z-10" />

          {/* ======================================================== */}
          {/* ACT I: ENTER THE ECOSYSTEM (0.0s – 10.0s)                */}
          {/* ======================================================== */}
          {t >= 0.0 && t < 10.3 && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-20"
              style={{
                opacity: t < 9.2 ? Math.min(1, t * 1.5) : Math.max(0, (10.0 - t) * 1.6),
                transform: `scale(${1 + t * 0.008})`,
              }}
            >
              <div className="w-20 h-20 rounded-3xl bg-[#121418] p-3 shadow-2xl border border-white/20 flex items-center justify-center mb-6">
                <img src="/attendx_app_icon.png" alt="AttendX" className="w-full h-full object-contain" />
              </div>
              <h1 className="font-nothing-serif text-5xl md:text-7xl lg:text-8xl text-neutral-900 font-normal tracking-tight leading-none max-w-4xl">
                Your entire academic life. One ecosystem.
              </h1>
              <div className="mt-6 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="font-ndot text-xs md:text-sm tracking-wider text-neutral-700 uppercase font-semibold">
                    AttendX • Connected Academic Suite for IIIT Una
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-neutral-800">
                  <span className="px-3 py-1 rounded-full bg-neutral-900/10">75% Ordinance Engine</span>
                  <span className="px-3 py-1 rounded-full bg-neutral-900/10">0ms AI Copilot</span>
                  <span className="px-3 py-1 rounded-full bg-neutral-900/10">100% Offline Resilience</span>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ACT II: PLAN YOUR ACADEMIC LIFE (10.0s – 20.0s)          */}
          {/* ======================================================== */}
          {t >= 9.8 && t < 20.3 && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center z-20"
              style={{
                opacity: t < 10.6 ? (t - 9.8) * 1.5 : t > 19.2 ? (20.0 - t) * 1.4 : 1,
              }}
            >
              <div className="absolute top-6 text-center">
                <h2 className="font-nothing-serif text-4xl md:text-5xl text-neutral-900 font-normal">
                  Plan every class.
                </h2>
                <div className="font-ndot text-xs tracking-widest text-neutral-600 uppercase mt-1">
                  AUTHENTIC TIMETABLE • 1-TAP ATTENDANCE • OCR IMPORT
                </div>
              </div>

              {/* Smartphone Chassis */}
              <div className="w-[330px] md:w-[360px] h-[580px] bg-[#0c0e12] rounded-[48px] p-2.5 shadow-2xl border-4 border-[#202227] relative overflow-hidden flex flex-col mt-12">
                <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-amber-600/15 to-transparent pointer-events-none" />

                <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between text-xs relative z-10">
                  <span className="font-bold text-white">NAMAN RAI</span>
                  <span className="text-emerald-400 font-mono font-semibold px-2 py-0.5 rounded bg-neutral-900">
                    {t > 15.2 ? "87.14% | 75%" : "85.28% | 75%"}
                  </span>
                </div>

                <div className="flex-1 px-3 py-2 overflow-hidden flex flex-col gap-2 relative z-10">
                  <div className="text-center">
                    <div className="text-xs font-bold text-white">Today's Schedule</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">&lt; Friday, November 6 &gt;</div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center gap-1 text-[9px] py-1">
                    <span className="px-2 py-0.5 rounded border border-purple-500/30 text-purple-400 bg-purple-500/10">Assignments</span>
                    <span className="px-2 py-0.5 rounded border border-rose-500/30 text-rose-400 bg-rose-500/10">+ Extra</span>
                    <span className="px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-bold">✓ Full Day</span>
                  </div>

                  {/* Slot 1: Professional Ethics */}
                  <div className="bg-[#14161b] rounded-xl p-2 border border-white/5">
                    <div className="text-xs font-bold text-white">Professional Ethics</div>
                    <div className="text-[9px] text-neutral-400 mt-0.5 font-mono">11:00 - 11:50 • LECTURE • Room 133</div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <button className="flex-1 py-1 rounded text-[10px] border border-emerald-500/20 text-emerald-500/60">Attended</button>
                      <button className="flex-1 py-1 rounded text-[10px] border border-rose-500/20 text-rose-500/60">Missed</button>
                      <button
                        className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${
                          t > 12.8 ? "bg-amber-500 text-black shadow-md scale-102" : "border border-amber-500/30 text-amber-400"
                        }`}
                      >
                        Off
                      </button>
                    </div>
                  </div>

                  {/* Slot 2: Artificial Intelligence */}
                  <div className="bg-[#14161b] rounded-xl p-2 border border-white/5">
                    <div className="text-xs font-bold text-white">Artificial Intelligence</div>
                    <div className="text-[9px] text-neutral-400 mt-0.5 font-mono">14:00 - 14:50 • LECTURE • Room 228</div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${
                          t > 15.2 ? "bg-emerald-500 text-white shadow-md scale-102" : "border border-emerald-500/20 text-emerald-500/60"
                        }`}
                      >
                        ✓ Attended
                      </button>
                      <button className="flex-1 py-1 rounded text-[10px] border border-rose-500/20 text-rose-500/60">Missed</button>
                      <button className="flex-1 py-1 rounded text-[10px] border border-amber-500/20 text-amber-500/60">Off</button>
                    </div>
                  </div>
                </div>

                {/* Touch Pointer in Act 2 */}
                {cursorState && (
                  <div
                    className="absolute pointer-events-none z-50 transition-transform duration-75"
                    style={{
                      left: `${cursorState.x}px`,
                      top: `${cursorState.y}px`,
                      transform: `scale(${cursorState.scale}) translate(-50%, -50%)`,
                    }}
                  >
                    <div className="w-7 h-7 rounded-full bg-white/70 border-2 border-white shadow-xl backdrop-blur-xs flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-neutral-900" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ACT III: ATTENDANCE INTELLIGENCE (20.0s – 31.0s)         */}
          {/* ======================================================== */}
          {t >= 19.8 && t < 31.3 && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none"
              style={{
                opacity: t < 20.6 ? (t - 19.8) * 1.5 : t > 30.2 ? (31.0 - t) * 1.4 : 1,
              }}
            >
              <div className="absolute top-6 text-center">
                <h2 className="font-nothing-serif text-4xl md:text-5xl text-neutral-900 font-normal">
                  Know where you stand.
                </h2>
                <div className="font-ndot text-xs tracking-widest text-neutral-600 uppercase mt-1">
                  75% ORDINANCE ENGINE • SAFE BUNK CALCULATOR • WHAT-IF SIMULATOR
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-4 mt-12 max-w-5xl px-4">
                {/* Left Card: 4 Safe Bunks */}
                <div className="bg-[#12141a] text-white rounded-3xl p-5 border border-white/10 shadow-2xl w-72">
                  <div className="text-xs text-neutral-400">Artificial Intelligence</div>
                  <div className="text-3xl font-extrabold text-emerald-400 mt-2">88.2%</div>
                  <div className="text-xs text-neutral-300 mt-1 font-semibold">
                    ✓ 4 Safe Bunks Remaining
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-2 bg-neutral-900 p-2 rounded-lg">
                    Rule 6.1 Debarment Shield: Active
                  </div>
                </div>

                {/* Center Spotlight: Digital Communication */}
                <div className="bg-[#14161f] text-white rounded-3xl p-6 border border-white/20 shadow-2xl w-84 z-30">
                  <div className="flex justify-between items-center text-xs text-neutral-400">
                    <span>Digital Communication</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">Safe</span>
                  </div>
                  <div className="flex justify-between items-baseline mt-3">
                    <div className="text-4xl font-extrabold text-emerald-400">84.6%</div>
                    <div className="text-xs font-mono text-neutral-300 bg-neutral-800 px-2 py-1 rounded">33 / 39 Classes</div>
                  </div>
                  <div className="w-full bg-neutral-800 h-2 rounded-full mt-3 overflow-hidden">
                    <div className="bg-emerald-400 h-full rounded-full" style={{ width: "84.6%" }} />
                  </div>
                  <div className="mt-4 border-t border-white/10 pt-3">
                    <div className="text-[11px] text-neutral-400 flex justify-between">
                      <span>What-If Simulator (5 classes):</span>
                      <span className="text-emerald-400 font-bold">Projected 86.4%</span>
                    </div>
                  </div>
                </div>

                {/* Right Card: Recovery Alert */}
                <div className="bg-[#12141a] text-white rounded-3xl p-5 border border-white/10 shadow-2xl w-72">
                  <div className="text-xs text-neutral-400">Fiber Optic Communication</div>
                  <div className="text-3xl font-extrabold text-rose-400 mt-2">74.1%</div>
                  <div className="text-xs text-rose-300 mt-1 font-semibold">
                    ⚠️ Attend next 1 class to cross 75%
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-2 bg-neutral-900 p-2 rounded-lg">
                    Recovery Trajectory: 1 Needed
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ACT IV: YOUR ACADEMIC WORLD (31.0s – 41.0s)              */}
          {/* ======================================================== */}
          {t >= 30.8 && t < 41.3 && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none"
              style={{
                opacity: t < 31.6 ? (t - 30.8) * 1.5 : t > 40.2 ? (41.0 - t) * 1.4 : 1,
              }}
            >
              <div className="absolute top-6 text-center">
                <h2 className="font-nothing-serif text-4xl md:text-5xl text-neutral-900 font-normal">
                  Your academic world, connected.
                </h2>
                <div className="font-ndot text-xs tracking-widest text-neutral-600 uppercase mt-1">
                  INSTITUTE CALENDAR • CLASSROOM HUB • PDF DOCUMENT BROADCASTS
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-6 mt-12 max-w-5xl px-4">
                {/* Academic Calendar Grid */}
                <div className="bg-[#12141a] text-white rounded-3xl p-6 border border-white/10 shadow-2xl w-80">
                  <div className="flex justify-between text-sm font-bold border-b border-white/10 pb-2">
                    <span>November 2026</span>
                    <span className="text-emerald-400 font-mono text-xs">Endsem in 24d</span>
                  </div>
                  <div className="grid grid-cols-7 gap-2 text-center text-[10px] text-neutral-400 mt-3 font-semibold">
                    <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
                  </div>
                  <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold mt-2">
                    <span className="text-neutral-600">28</span><span className="text-neutral-600">29</span><span className="text-neutral-600">30</span><span>1</span><span>2</span><span>3</span><span>4</span>
                    <span className="text-amber-400">5</span><span className="bg-amber-500 text-black rounded p-0.5">6</span><span>7</span><span className="text-rose-500">8</span><span>9</span><span>10</span><span>11</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-4 border-t border-white/10 pt-2">
                    Nov 8: Diwali • Nov 30: End Semester Theory Exam
                  </div>
                </div>

                {/* Classroom Announcement with PDF Attachment */}
                <div className="bg-[#14161f] text-white rounded-3xl p-6 border border-white/20 shadow-2xl w-96">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-purple-400">Classroom Announcement</span>
                    <span className="text-neutral-400">Just now</span>
                  </div>
                  <div className="text-sm font-bold mt-2">Prof. A. Sharma • Fiber Optic</div>
                  <div className="text-xs text-neutral-300 mt-1 leading-snug">
                    "Unit 4 Notes on Optical Amplifiers & DWDM published. Review before lab."
                  </div>
                  {/* PDF Document File Card */}
                  <div className="bg-[#1c1e28] rounded-xl p-3 border border-white/10 mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xs">PDF</div>
                      <div>
                        <div className="text-xs font-bold">Unit_4_Lecture_Notes.pdf</div>
                        <div className="text-[10px] text-neutral-400">2.4 MB • 42 Pages</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-semibold">✓ Saved</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ACT V: INTELLIGENCE IN YOUR POCKET (41.0s – 51.0s)       */}
          {/* ======================================================== */}
          {t >= 40.8 && t < 51.3 && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none"
              style={{
                opacity: t < 41.6 ? (t - 40.8) * 1.5 : t > 50.2 ? (51.0 - t) * 1.4 : 1,
              }}
            >
              <div className="absolute top-6 text-center">
                <h2 className="font-nothing-serif text-4xl md:text-5xl text-neutral-900 font-normal">
                  Intelligence that understands your semester.
                </h2>
                <div className="font-ndot text-xs tracking-widest text-neutral-600 uppercase mt-1">
                  0ms LOCAL DETERMINISTIC FAST-PATH • ZERO TOKEN OVERHEAD
                </div>
              </div>

              {/* Copilot Chat Dialogue Card */}
              <div className="bg-[#111318] text-white rounded-3xl p-6 border border-white/15 shadow-2xl w-full max-w-xl mt-12">
                <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-400 text-black flex items-center justify-center font-bold">✨</div>
                  <div>
                    <div className="text-sm font-bold">AttendX AI Copilot</div>
                    <div className="text-[10px] text-emerald-400 font-mono">0ms Fast-Path Deterministic Active</div>
                  </div>
                </div>

                <div className="flex justify-end mt-4">
                  <div className="bg-[#222530] px-4 py-2 rounded-2xl text-xs font-semibold">
                    Can I bunk DBMS tomorrow?
                  </div>
                </div>

                <div className="flex justify-start mt-3">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl text-xs text-neutral-200 leading-relaxed max-w-md">
                    <div className="text-emerald-400 font-bold mb-1">✓ Safe to bunk DBMS tomorrow.</div>
                    You have <strong>3 safe bunks remaining</strong>. Missing tomorrow's class will adjust attendance to <strong>82.4%</strong>, safely above the 75% threshold.
                    <div className="text-[10px] text-neutral-400 mt-2 border-t border-white/10 pt-1">
                      ⏱️ MSE concluded 46d ago • Endsem Theory starts in 24 days.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ACT VI: PERSONALIZATION SHOWSTOPPER (51.0s – 61.0s)      */}
          {/* ======================================================== */}
          {t >= 50.8 && t < 61.3 && (() => {
            const isNova = t >= 53.5 && t < 57.0;
            const isBurgundy = t >= 57.0;
            const accent = isBurgundy ? "#fb7185" : isNova ? "#34D399" : "#FFD814";
            const bgClass = isBurgundy ? "bg-[#4c0519]" : isNova ? "bg-[#022c22]" : "bg-[#0c0e12]";

            return (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none"
                style={{
                  opacity: t < 51.6 ? (t - 50.8) * 1.5 : t > 60.2 ? (61.0 - t) * 1.4 : 1,
                }}
              >
                <div className="absolute top-6 text-center">
                  <h2 className="font-nothing-serif text-4xl md:text-5xl font-normal transition-colors" style={{ color: isNova || isBurgundy ? "#fff" : "#111" }}>
                    Your experience. Your aesthetic.
                  </h2>
                  <div className="font-ndot text-xs tracking-widest uppercase mt-1" style={{ color: isNova || isBurgundy ? "#ccc" : "#555" }}>
                    DYNAMIC SYSTEM-WIDE THEMING • ISOLATED PAGE ARCHITECTURE
                  </div>
                </div>

                <div className={`w-[320px] md:w-[350px] h-[520px] ${bgClass} rounded-[44px] p-4 border-4 shadow-2xl flex flex-col mt-12 transition-all duration-500`} style={{ borderColor: accent }}>
                  <div className="flex justify-between items-center text-xs font-bold border-b border-white/10 pb-2">
                    <span>Appearance</span>
                    <span style={{ color: accent }}>{isBurgundy ? "Burgundy Royal" : isNova ? "Nova Green" : "Obsidian Dark"}</span>
                  </div>

                  {/* Theme Swatches */}
                  <div className="flex justify-between px-2 mt-4">
                    {["#0c0e12", "#10B981", "#E11D48", "#F59E0B", "#8B5CF6"].map((c, i) => (
                      <div key={i} className="w-7 h-7 rounded-full border-2 border-white/50 shadow" style={{ backgroundColor: c }} />
                    ))}
                  </div>

                  <div className="mt-6 p-4 rounded-2xl bg-black/40 border border-white/10">
                    <div className="text-[10px] font-bold" style={{ color: accent }}>TODAY'S SCHEDULE</div>
                    <div className="text-sm font-bold text-white mt-1">Artificial Intelligence</div>
                    <div className="text-xs text-neutral-400">14:00 - 14:50 • Room 228</div>
                    <div className="flex gap-2 mt-3">
                      <span className="px-3 py-1 rounded text-xs font-bold text-black" style={{ backgroundColor: accent }}>Attended</span>
                      <span className="px-3 py-1 rounded text-xs bg-neutral-800 text-white">Off</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ======================================================== */}
          {/* ACT VII: CONNECTED ANDROID EXPERIENCE (61.0s – 71.0s)    */}
          {/* ======================================================== */}
          {t >= 60.8 && t < 71.3 && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none"
              style={{
                opacity: t < 61.6 ? (t - 60.8) * 1.5 : t > 70.2 ? (71.0 - t) * 1.4 : 1,
              }}
            >
              <div className="absolute top-6 text-center">
                <h2 className="font-nothing-serif text-4xl md:text-5xl text-neutral-900 font-normal">
                  Hardware-level Android integration.
                </h2>
                <div className="font-ndot text-xs tracking-widest text-neutral-600 uppercase mt-1">
                  DYNAMIC HUD • 4x2 INTERACTIVE WIDGET • FOREGROUND LECTURE DND
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-6 mt-12 max-w-5xl px-4">
                {/* Dynamic HUD & FCM Phone */}
                <div className="w-72 h-[460px] bg-[#0c0e12] rounded-[40px] p-3 border-4 border-neutral-800 shadow-2xl flex flex-col">
                  {/* Dynamic HUD Pill */}
                  <div className="bg-black rounded-full px-4 py-2 border border-white/20 flex justify-between items-center text-xs">
                    <span className="font-bold text-emerald-400">AI • Room 228</span>
                    <span className="font-mono text-[10px] text-neutral-400">24m left</span>
                  </div>

                  {/* FCM Notification */}
                  <div className="bg-slate-900/95 rounded-2xl p-3 border border-white/10 mt-3 text-xs">
                    <div className="text-[10px] text-neutral-400 font-bold">FCM BROADCAST</div>
                    <div className="font-bold text-white mt-0.5">Unit 4 Notes Published</div>
                    <div className="text-[10px] text-neutral-300">New PDF available in Classroom Hub</div>
                  </div>

                  {/* Automated Lecture DND Banner */}
                  <div className="mt-auto bg-amber-500/15 border border-amber-500/30 rounded-2xl p-3 text-xs">
                    <div className="text-amber-400 font-bold">🔕 Foreground DND Active</div>
                    <div className="text-[10px] text-neutral-300 mt-0.5">Mutes phone during lecture; auto-restores on dismissal.</div>
                  </div>
                </div>

                {/* 4x2 Interactive Android Home Widget */}
                <div className="bg-[#14161f] text-white rounded-3xl p-6 border border-white/20 shadow-2xl w-96">
                  <div className="flex justify-between items-center text-xs border-b border-white/10 pb-2">
                    <span className="font-bold">4x2 Android Home Widget</span>
                    <span className="text-emerald-400 font-mono font-bold">85.28% Safe</span>
                  </div>
                  <div className="mt-3">
                    <div className="text-[10px] text-emerald-400 font-bold">🟢 NEXT LECTURE IN 15 MINS</div>
                    <div className="text-lg font-bold mt-0.5">Fiber Optic Communication</div>
                    <div className="text-xs text-neutral-400">14:50 - 15:40 • Room 326</div>
                  </div>
                  <div className="flex gap-2 mt-4 text-xs font-bold">
                    <span className="flex-1 py-2 text-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">✓ Attended</span>
                    <span className="flex-1 py-2 text-center rounded-xl bg-neutral-800 text-neutral-400">✗ Missed</span>
                    <span className="flex-1 py-2 text-center rounded-xl bg-neutral-800 text-amber-400">Off</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ACT VIII: PEER SYNC, OFFLINE & EVOLUTION (71.0s – 81.0s) */}
          {/* ======================================================== */}
          {t >= 70.8 && t < 81.3 && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none"
              style={{
                opacity: t < 71.6 ? (t - 70.8) * 1.5 : t > 80.2 ? (81.0 - t) * 1.4 : 1,
              }}
            >
              <div className="absolute top-6 text-center">
                <h2 className="font-nothing-serif text-4xl md:text-5xl text-neutral-900 font-normal">
                  Built with students. Improved by students.
                </h2>
                <div className="font-ndot text-xs tracking-widest text-neutral-600 uppercase mt-1">
                  100% OFFLINE-FIRST • INSTANT PEER SYNC • SEAMLESS OTA EVOLUTION
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-6 mt-12 max-w-5xl px-4">
                <div className="bg-[#12141a] text-white rounded-3xl p-6 border border-white/10 shadow-2xl w-84">
                  <div className="text-xs font-bold border-b border-white/10 pb-2 flex justify-between">
                    <span>Peer Sync & Offline Queue</span>
                    <span className="text-emerald-400 font-mono">✓ In Sync</span>
                  </div>
                  <div className="text-xs text-neutral-400 mt-3">Share Timetable Code:</div>
                  <div className="font-mono text-center text-sm font-bold bg-neutral-900 text-amber-400 p-2.5 rounded-xl mt-1 tracking-widest">
                    SYNC-IIITU-2026
                  </div>
                  <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-neutral-300">
                    📶 100% Offline-First: All changes buffer into local queue and auto-reconcile on reconnection.
                  </div>
                </div>

                <div className="bg-[#14161f] text-white rounded-3xl p-6 border border-white/20 shadow-2xl w-84">
                  <div className="text-xs font-bold border-b border-white/10 pb-2 flex justify-between">
                    <span>Student Feedback & OTA</span>
                    <span className="text-rose-400 font-mono">v4.3.0 Final</span>
                  </div>
                  <div className="mt-3 p-3 rounded-xl bg-neutral-900 text-xs">
                    <div className="font-bold text-white">💬 Feedback Delivered</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">"Added PDF document attachments for classroom notes!"</div>
                  </div>
                  <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs">
                    <div className="font-bold text-rose-400">⚡ Live OTA Update Applied</div>
                    <div className="text-[10px] text-neutral-300 mt-0.5">Hot-patch synchronized seamlessly without Play Store friction.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ACT IX: MODERN ECOSYSTEM FINALE (81.0s – 90.0s)          */}
          {/* ======================================================== */}
          {t >= 80.8 && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-30"
              style={{
                opacity: Math.min(1, (t - 80.8) * 1.5),
              }}
            >
              {/* Rotating 3D Constellation (81s - 86s) */}
              {t < 86.5 && (
                <div
                  className="relative w-80 h-80 flex items-center justify-center"
                  style={{ transform: `rotate(${-(t - 81.0) * 18}deg)` }}
                >
                  {[
                    "🎓 75% Rule", "📅 Timetable", "📊 Analytics", "🏛️ Hub",
                    "📄 PDFs", "🤖 0ms Copilot", "🎛️ 4x2 Widget", "🔕 DND",
                  ].map((label, idx) => {
                    const angle = (idx * 45 * Math.PI) / 180;
                    const r = 140 + (t - 81.0) * 10;
                    return (
                      <div
                        key={idx}
                        className="absolute px-3 py-1.5 rounded-xl bg-[#121418] border border-white/20 shadow-xl text-white text-xs font-bold"
                        style={{
                          transform: `translate3d(${Math.cos(angle) * r}px, ${Math.sin(angle) * r}px, 0) rotate(${(t - 81.0) * 20}deg)`,
                        }}
                      >
                        {label}
                      </div>
                    );
                  })}
                  <div className="font-ndot text-lg text-neutral-900 uppercase font-black tracking-widest">
                    Modern Ecosystem
                  </div>
                </div>
              )}

              {/* Grand Reveal Outro (86.5s - 90s) */}
              {t >= 86.2 && (
                <div
                  className="flex flex-col items-center"
                  style={{
                    transform: `scale(${0.96 + (t - 86.2) * 0.012})`,
                    opacity: Math.min(1, (t - 86.2) * 2),
                  }}
                >
                  <div className="w-20 h-20 rounded-3xl bg-[#121418] p-3 shadow-2xl border border-white/20 flex items-center justify-center mb-5">
                    <img src="/attendx_app_icon.png" alt="AttendX" className="w-full h-full object-contain" />
                  </div>
                  <h1 className="font-nothing-serif text-6xl md:text-8xl text-neutral-900 font-normal tracking-tight">
                    AttendX
                  </h1>
                  <p className="font-ndot text-sm md:text-base text-neutral-800 tracking-tight mt-2 font-semibold">
                    Smart Attendance. Simplified.
                  </p>
                  <div className="mt-6 flex flex-col items-center gap-2">
                    <span className="text-xs uppercase tracking-widest text-neutral-600 font-semibold">
                      Built for students, by students.
                    </span>
                    <span className="font-serif italic text-sm text-neutral-800">
                      Indian Institute of Information Technology, Una
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded bg-neutral-900 text-white font-bold">
                        v4.3.0 Final
                      </span>
                      <button
                        onClick={handleDownloadMp4}
                        className="text-[10px] font-mono px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1 shadow cursor-pointer transition"
                      >
                        <Download className="w-3 h-3" /> Download MP4 (1080p 60FPS)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Floating Control Bar */}
      <footer className="w-full max-w-6xl mt-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-xl flex flex-col gap-2">
        {/* Timeline Scrubber */}
        <div className="w-full flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 w-12 text-right">
            {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, "0")}
          </span>

          <div
            className="flex-1 h-3 bg-slate-800 rounded-full relative cursor-pointer overflow-hidden group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              handleSeek(pos * TOTAL_DURATION);
            }}
          >
            {/* Progress Fill */}
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-rose-500 to-indigo-500 rounded-full relative"
              style={{ width: `${(currentTime / TOTAL_DURATION) * 100}%` }}
            />

            {/* Scene Separation Markers */}
            {SCENES.map((scene) => (
              <div
                key={scene.id}
                className="absolute top-0 bottom-0 w-0.5 bg-slate-950/60"
                style={{ left: `${(scene.start / TOTAL_DURATION) * 100}%` }}
                title={scene.label}
              />
            ))}
          </div>

          <span className="text-xs font-mono text-slate-400 w-12">1:30</span>
        </div>

        {/* Playback Controls Row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (currentTime >= TOTAL_DURATION) handleSeek(0);
                setIsPlaying(!isPlaying);
                playTactileSound("click");
              }}
              className="p-2.5 rounded-xl bg-white text-black hover:bg-slate-200 transition font-medium flex items-center gap-1.5 shadow cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black" />}
              <span className="text-xs font-semibold">{isPlaying ? "Pause" : "Play"}</span>
            </button>

            <button
              onClick={() => {
                handleSeek(0);
                setIsPlaying(true);
                playTactileSound("click");
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Replay from start"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Audio Indicator */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition cursor-pointer"
              title="Toggle Audio"
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-slate-400">Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Soundtrack Synced</span>
                  {isPlaying && (
                    <div className="flex items-center gap-0.5 ml-1">
                      {[6, 12, 8, 14, 10].map((h, i) => (
                        <div
                          key={i}
                          className="w-0.5 bg-emerald-400 rounded-full animate-pulse"
                          style={{ height: `${h}px`, animationDelay: `${i * 120}ms` }}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </button>

            {/* Speed Pill */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 text-xs font-mono text-slate-300 ml-1">
              {[0.5, 1.0, 1.5, 2.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setPlaybackRate(rate)}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    playbackRate === rate ? "bg-slate-700 text-white font-bold" : "hover:text-white"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* Active Scene Indicator */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>Act:</span>
            <span className="text-white font-bold bg-slate-800 px-2.5 py-1 rounded-md">
              {activeScene.label}
            </span>
          </div>

          {/* Download & Record Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadMp4}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
              title="Direct Download MP4 Video (1080p 60FPS)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download MP4 Film</span>
            </button>

            {!isRecording ? (
              <button
                onClick={startRecording}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Record Canvas Stream"
              >
                <span>Live Record</span>
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="px-3 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs flex items-center gap-1.5 animate-pulse shadow-lg cursor-pointer"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                <span>Stop (.webm)</span>
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
