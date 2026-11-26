import React, { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Play, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuthStore, isUserAuthenticated } from "../../stores/authStore";
import { useBackHandlerStore } from "../../stores/backHandlerStore";
import { buildOfflineWrapSnapshot } from "../../utils/wrapEngine";
import { useLocalAvatar } from "../../utils/avatarCache";
import pkg from "../../../package.json";

export const WhatsNewPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const localAvatarUrl = useLocalAvatar(user?.id, user?.avatarUrl);
  const snap = buildOfflineWrapSnapshot();
  const mountedAtRef = useRef<number>(Date.now());
  const currentVersion = String(localStorage.getItem("app_version") || pkg.version || "4.5.0")
    .replace(/^v/i, "")
    .trim();

  const acknowledgeWhatsNew = useCallback(() => {
    try {
      localStorage.setItem("attendx_seen_whats_new_version", currentVersion);
      localStorage.removeItem("attendx_pending_whats_new");
    } catch {}
  }, [currentVersion]);

  // Never consume pending state at 0ms on mount (prevents transient boot reloads/hydration spinners from eating What's New)
  useEffect(() => {
    mountedAtRef.current = Date.now();
    const seenTimer = window.setTimeout(() => {
      acknowledgeWhatsNew();
    }, 3500);
    return () => {
      window.clearTimeout(seenTimer);
      if (
        Date.now() - mountedAtRef.current >= 1200 &&
        window.location.pathname !== "/" &&
        isUserAuthenticated()
      ) {
        acknowledgeWhatsNew();
      }
    };
  }, [acknowledgeWhatsNew]);

  useEffect(() => {
    const unregister = useBackHandlerStore.getState().register(() => {
      acknowledgeWhatsNew();
      navigate("/today", { replace: true });
      return true;
    });
    return () => unregister();
  }, [navigate, acknowledgeWhatsNew]);

  const highlights = [
    {
      title: "Semester Wrap & Mid-Semester Replay",
      summary: "BitChord-style interactive story cards with forecasted remaining classes, calendar purple-dot streaks, and shareable PNG posters.",
    },
    {
      title: "Post-Teaching Exam Briefings",
      summary: "Stops regular timetable alerts automatically after Last Working Day and highlights upcoming exams.",
    },
    {
      title: "Session & Feedback Accuracy",
      summary: "Fixes iOS Chrome being tagged as macOS in Linked Devices and includes screen & device context on feedback.",
    },
    {
      title: "Offline Cross-Device Fonts & Tablet Cleanliness",
      summary: "Self-hosts core editorial typefaces offline and hides desktop Ctrl+/ shortcut badges on mobile and tablets.",
    },
  ];

  return (
    <div
      className="preserve-dark max-w-lg mx-auto rounded-3xl p-5 sm:p-6 text-white border border-white/12 shadow-2xl space-y-5 font-geist"
      style={{ background: "radial-gradient(circle at 50% 0%, #374714 0%, #161914 48%, #101110 100%)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[#b7f357] font-semibold">
          WHAT'S NEW · v{currentVersion}
        </span>
        <button
          onClick={() => {
            acknowledgeWhatsNew();
            navigate("/today", { replace: true });
          }}
          className="text-xs text-white/65 hover:text-white cursor-pointer"
        >
          Skip → Today
        </button>
      </div>

      <div className="space-y-1.5">
        <span className="font-extrabold tracking-tight text-sm text-white/80">AttendX</span>
        <h1 className="text-3xl font-bold tracking-tight leading-[1.08]">
          Your semester, now playable.
        </h1>
        <p className="text-xs text-white/65">
          Freshly updated on your device. Jump straight into your live Replay or inspect what changed.
        </p>
      </div>

      {/* Primary Spotlight Card */}
      <div className="rounded-3xl p-4 bg-[#1c2116] border border-[#b7f357]/30 space-y-3">
        <div className="flex items-center gap-3">
          {localAvatarUrl ? (
            <img
              src={localAvatarUrl}
              alt={user?.name || "Student"}
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-full object-cover border border-[#b7f357]/40 shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-[#b7f357]/20 text-[#b7f357] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">
              {snap ? `${snap.semester.name} Replay Ready` : "AttendX Semester Replay"}
            </div>
            <div className="text-xs text-lime-200/80">
              {snap
                ? `${snap.totals.percentage}% so far · ${snap.forecast.remainingClasses} classes left · Ready to share`
                : "Play animated cards & export a Share Card poster"}
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            acknowledgeWhatsNew();
            navigate("/wrap");
          }}
          className="w-full py-3 rounded-2xl bg-[#b7f357] text-[#111508] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer hover:brightness-95 transition"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Play my Replay now</span>
        </button>
      </div>

      {/* Concise Bold Release Highlights */}
      <div className="space-y-2.5">
        {highlights.map((h) => (
          <div key={h.title} className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/10 space-y-1">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#b7f357] shrink-0" />
              <span>{h.title}</span>
            </div>
            <p className="text-[11.5px] text-white/65 pl-5">{h.summary}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() => {
          acknowledgeWhatsNew();
          navigate("/today", { replace: true });
        }}
        className="w-full py-3 rounded-2xl bg-white text-black font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:bg-white/90 transition"
      >
        <span>Continue to Today</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

function avatarUrlOrFallback(url?: string | null) {
  return url || "";
}
