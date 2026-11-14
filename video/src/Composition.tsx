import React from "react";
import {
  Composition,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  staticFile,
} from "remotion";

// 90.00 Seconds @ 30 FPS = 2700 Frames
export const TOTAL_DURATION = 90.0;
export const FPS = 30;
export const TOTAL_FRAMES = TOTAL_DURATION * FPS; // 2700

export const MyComposition = () => {
  return (
    <Composition
      id="AttendXPromo"
      component={AttendXPromoComponent}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};

export const AttendXPromoComponent: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps; // Current time in seconds

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: "linear-gradient(135deg, #dbe4f0 0%, #ecdfe3 50%, #f6d8d9 100%)",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Instrument Serif', Georgia, serif",
      }}
    >
      {/* Synchronized 90s Soundtrack */}
      <Audio src={staticFile("promo_soundtrack_90s.mp3")} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Silkscreen&family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700;800;900&display=swap');
        .font-serif { font-family: 'Instrument Serif', Georgia, serif; }
        .font-sans { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        .font-ndot { font-family: 'Silkscreen', monospace; letter-spacing: -0.04em; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
      `}</style>

      {/* Subtle Vignette & Grain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 65%, rgba(0,0,0,0.08) 100%)",
          pointerEvents: "none",
          zIndex: 10,
        }}
      />

      {/* ======================================================== */}
      {/* ACT I: ENTER THE ECOSYSTEM (0.0s – 10.0s | Frames 0-300)  */}
      {/* ======================================================== */}
      {t >= 0 && t < 10.3 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            opacity: t < 9.2 ? Math.min(1, t * 1.5) : Math.max(0, (10.0 - t) * 1.6),
            transform: `scale(${1 + t * 0.008})`,
            zIndex: 20,
          }}
        >
          {/* AttendX Floating Emblem */}
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: 36,
              background: "#121418",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.18)",
              marginBottom: 32,
              transform: `translateY(${Math.max(0, (1.8 - t) * 30)}px)`,
            }}
          >
            <img src={staticFile("attendx_app_icon.png")} alt="AttendX" style={{ width: 72, height: 72 }} />
          </div>

          <h1
            className="font-serif"
            style={{
              fontSize: 104,
              color: "#111111",
              fontWeight: 400,
              maxWidth: 1350,
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            Your entire academic life. One ecosystem.
          </h1>

          <div
            className="font-ndot"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginTop: 36,
              fontSize: 22,
              color: "#333333",
              opacity: t > 1.6 ? Math.min(1, (t - 1.6) * 1.5) : 0,
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#E11D48" }} />
            <span>AttendX • Connected Academic Suite for IIIT Una</span>
          </div>

          <div
            className="font-mono"
            style={{
              display: "flex",
              gap: 16,
              marginTop: 22,
              fontSize: 15,
              color: "#555",
              opacity: t > 2.4 ? Math.min(1, (t - 2.4) * 1.5) : 0,
            }}
          >
            <span style={{ background: "rgba(0,0,0,0.06)", padding: "6px 18px", borderRadius: 20 }}>
              75% Ordinance Engine
            </span>
            <span style={{ background: "rgba(0,0,0,0.06)", padding: "6px 18px", borderRadius: 20 }}>
              0ms AI Copilot
            </span>
            <span style={{ background: "rgba(0,0,0,0.06)", padding: "6px 18px", borderRadius: 20 }}>
              100% Offline-First
            </span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ACT II: PLAN YOUR ACADEMIC LIFE (10.0s – 20.0s | 300-600) */}
      {/* ======================================================== */}
      {t >= 9.8 && t < 20.3 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: t < 10.6 ? (t - 9.8) * 1.5 : t > 19.2 ? (20.0 - t) * 1.4 : 1,
            zIndex: 20,
          }}
        >
          {/* Editorial Headline Top */}
          <div
            style={{
              position: "absolute",
              top: 50,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <h2 className="font-serif" style={{ fontSize: 72, color: "#111", margin: 0 }}>
              Plan every class.
            </h2>
            <div className="font-ndot" style={{ fontSize: 16, color: "#666", marginTop: 8, letterSpacing: 2 }}>
              AUTHENTIC TIMETABLE • 1-TAP ATTENDANCE • OCR IMPORT
            </div>
          </div>

          {/* Smartphone displaying authentic Timetable & Today's Schedule */}
          <div
            style={{
              width: 440,
              height: 840,
              background: "#0c0e12",
              borderRadius: 64,
              padding: 16,
              border: "6px solid #202227",
              boxShadow: "0 40px 120px rgba(0,0,0,0.45)",
              display: "flex",
              flexDirection: "column",
              color: "#fff",
              position: "relative",
              overflow: "hidden",
              marginTop: 60,
              transform: `scale(${t < 11.5 ? 0.95 + (t - 10) * 0.05 : 1})`,
            }}
            className="font-sans"
          >
            {/* Top Amber Glow */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 120,
                background: "linear-gradient(180deg, rgba(245,158,11,0.18) 0%, transparent 100%)",
                pointerEvents: "none",
              }}
            />

            {/* Mobile Status Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 24px", fontSize: 13, color: "#888", position: "relative", zIndex: 10 }}>
              <span>14:00</span>
              <div style={{ width: 14, height: 14, background: "#000", borderRadius: "50%", border: "1px solid #444" }} />
              <span>5G</span>
            </div>

            {/* App Header (NAMAN RAI & 85.28% | 75%) */}
            <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>NAMAN RAI</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="font-mono" style={{ fontSize: 13, color: "#34D399", background: "#111", border: "1px solid #222", padding: "4px 10px", borderRadius: 8 }}>
                  {t > 15.2 ? "87.14% | 75%" : "85.28% | 75%"}
                </span>
                <span style={{ color: "#777", fontSize: 14 }}>🌙</span>
              </div>
            </div>

            {/* Schedule View Content */}
            <div style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", gap: 10, position: "relative", zIndex: 10 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>Today's Schedule</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>&lt; Friday, November 6 &gt;</div>
              </div>

              {/* Action Toolbar Pills */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, padding: "4px 0" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ border: "1px solid rgba(168,85,247,0.3)", color: "#c084fc", background: "rgba(168,85,247,0.1)", padding: "3px 8px", borderRadius: 8 }}>
                    Assignments
                  </span>
                  <span style={{ border: "1px solid rgba(244,63,94,0.3)", color: "#fb7185", background: "rgba(244,63,94,0.1)", padding: "3px 8px", borderRadius: 8 }}>
                    + Extra
                  </span>
                  <span style={{ border: "1px solid rgba(16,185,129,0.3)", color: "#34D399", background: "rgba(16,185,129,0.1)", padding: "3px 8px", borderRadius: 8, fontWeight: 700 }}>
                    ✓ Full Day
                  </span>
                </div>
                <span className="font-mono" style={{ background: "#111", padding: "3px 8px", borderRadius: 6, fontSize: 10, color: "#888" }}>
                  0 PENDING
                </span>
              </div>

              {/* Lecture Slot 1: Professional Ethics */}
              <div style={{ background: "#14161b", borderRadius: 18, padding: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
                  <span>Professional Ethics</span>
                  <span style={{ color: "#666", fontSize: 12 }}>📝</span>
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 4, display: "flex", gap: 6 }}>
                  <span className="font-mono" style={{ background: "#0a0a0c", padding: "2px 6px", borderRadius: 4, color: "#aaa" }}>11:00 - 11:50</span>
                  <span>LECTURE</span>
                  <span>• Room 133</span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <div style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "1px solid rgba(52,211,153,0.2)", color: "rgba(52,211,153,0.6)", fontSize: 11, textAlign: "center" }}>Attended</div>
                  <div style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "1px solid rgba(248,113,113,0.2)", color: "rgba(248,113,113,0.6)", fontSize: 11, textAlign: "center" }}>Missed</div>
                  <div style={{
                    flex: 1,
                    padding: "6px 0",
                    borderRadius: 8,
                    background: t > 12.8 ? "#F59E0B" : "rgba(245,158,11,0.15)",
                    border: t > 12.8 ? "none" : "1px solid rgba(245,158,11,0.3)",
                    color: t > 12.8 ? "#000" : "#F59E0B",
                    fontWeight: 800,
                    fontSize: 11,
                    textAlign: "center",
                  }}>Off</div>
                </div>
              </div>

              {/* Lecture Slot 2: Artificial Intelligence */}
              <div style={{ background: "#14161b", borderRadius: 18, padding: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
                  <span>Artificial Intelligence</span>
                  <span style={{ color: "#666", fontSize: 12 }}>📝</span>
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 4, display: "flex", gap: 6 }}>
                  <span className="font-mono" style={{ background: "#0a0a0c", padding: "2px 6px", borderRadius: 4, color: "#aaa" }}>14:00 - 14:50</span>
                  <span>LECTURE</span>
                  <span>• Room 228</span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <div style={{
                    flex: 1,
                    padding: "6px 0",
                    borderRadius: 8,
                    background: t > 15.2 ? "#10B981" : "rgba(52,211,153,0.1)",
                    border: t > 15.2 ? "none" : "1px solid rgba(52,211,153,0.2)",
                    color: t > 15.2 ? "#fff" : "rgba(52,211,153,0.6)",
                    fontWeight: 800,
                    fontSize: 11,
                    textAlign: "center",
                  }}>✓ Attended</div>
                  <div style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "1px solid rgba(248,113,113,0.2)", color: "rgba(248,113,113,0.6)", fontSize: 11, textAlign: "center" }}>Missed</div>
                  <div style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "1px solid rgba(245,158,11,0.2)", color: "rgba(245,158,11,0.6)", fontSize: 11, textAlign: "center" }}>Off</div>
                </div>
              </div>

              {/* Slot 3: Fiber Optic Communication */}
              <div style={{ background: "#14161b", borderRadius: 18, padding: 12, border: "1px solid rgba(255,255,255,0.06)", opacity: 0.85 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
                  <span>Fiber Optic Communication</span>
                  <span style={{ color: "#666", fontSize: 12 }}>📝</span>
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 4, display: "flex", gap: 6 }}>
                  <span className="font-mono" style={{ background: "#0a0a0c", padding: "2px 6px", borderRadius: 4, color: "#aaa" }}>14:50 - 15:40</span>
                  <span>LECTURE</span>
                  <span>• Room 326</span>
                </div>
              </div>
            </div>

            {/* Single Precision Touch Pointer in Act 2 */}
            {t >= 11.5 && t <= 17.5 && (() => {
              let curX = 350;
              let curY = 400;
              let scale = 1;
              if (t >= 11.5 && t < 13.5) {
                const prog = Math.min(1, (t - 11.5) / 1.0);
                const ease = 1 - Math.pow(1 - prog, 3);
                curX = 380 - (380 - 355) * ease;
                curY = 400 - (400 - 295) * ease;
                if (t >= 12.75 && t <= 13.0) scale = 0.85;
              } else if (t >= 13.5 && t < 16.5) {
                const prog = Math.min(1, (t - 13.8) / 1.1);
                const ease = 1 - Math.pow(1 - prog, 3);
                curX = 355 - (355 - 190) * ease;
                curY = 295 + (415 - 295) * ease;
                if (t >= 15.15 && t <= 15.4) scale = 0.85;
              } else {
                curX = 220;
                curY = 500;
              }
              return (
                <div
                  style={{
                    position: "absolute",
                    left: curX,
                    top: curY,
                    transform: `scale(${scale}) translate(-50%, -50%)`,
                    pointerEvents: "none",
                    zIndex: 60,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.75)",
                      border: "2px solid #fff",
                      boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                    }}
                  />
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ACT III: ATTENDANCE INTELLIGENCE (20.0s – 31.0s | 600-930)*/}
      {/* ======================================================== */}
      {t >= 19.8 && t < 31.3 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            perspective: 1400,
            opacity: t < 20.6 ? (t - 19.8) * 1.5 : t > 30.2 ? (31.0 - t) * 1.4 : 1,
            zIndex: 20,
          }}
        >
          {/* Headline Top */}
          <div
            style={{
              position: "absolute",
              top: 40,
              textAlign: "center",
            }}
          >
            <h2 className="font-serif" style={{ fontSize: 72, color: "#111", margin: 0 }}>
              Know where you stand.
            </h2>
            <div className="font-ndot" style={{ fontSize: 16, color: "#555", marginTop: 6, letterSpacing: 2 }}>
              75% ORDINANCE ENGINE • SAFE BUNK CALCULATOR • WHAT-IF SIMULATOR
            </div>
          </div>

          {/* Left Card: Safe Bunks & Rule 6.1 */}
          <div
            className="font-sans"
            style={{
              position: "absolute",
              transform: `translate3d(-460px, 30px, 80px) rotate(-3deg) translateY(${Math.sin(t * 1.8) * 6}px)`,
              background: "#12141a",
              borderRadius: 36,
              padding: "28px 32px",
              color: "#fff",
              boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
              width: 380,
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#888" }}>
              <span>Artificial Intelligence</span>
              <span style={{ color: "#34D399", background: "rgba(52,211,153,0.15)", padding: "2px 10px", borderRadius: 12, fontWeight: 700 }}>
                Safe Margin
              </span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "#34D399", marginTop: 12 }}>88.2%</div>
            <div style={{ fontSize: 15, color: "#ddd", marginTop: 8 }}>
              ✓ <strong style={{ color: "#fff" }}>4 Safe Bunks Remaining</strong> before reaching 75%
            </div>
            <div style={{ marginTop: 14, background: "#1c1e24", padding: "10px 14px", borderRadius: 14, fontSize: 12, color: "#aaa" }}>
              Rule 6.1 Debarment Protection: Safe
            </div>
          </div>

          {/* Center Card: Spotlight Digital Communication */}
          <div
            className="font-sans"
            style={{
              position: "absolute",
              transform: `translate3d(0px, 40px, 180px) translateY(${Math.sin(t * 1.6 + 1) * 8}px)`,
              background: "#14161f",
              borderRadius: 44,
              padding: "36px 44px",
              color: "#fff",
              boxShadow: "0 40px 100px rgba(0,0,0,0.45)",
              width: 500,
              border: "1px solid rgba(255,255,255,0.18)",
              zIndex: 30,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#888" }}>
              <span>Digital Communication</span>
              <span style={{ color: "#34D399", background: "rgba(52,211,153,0.2)", padding: "4px 14px", borderRadius: 14, fontWeight: 800 }}>
                Safe
              </span>
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, marginTop: 10 }}>Digital Communication</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 20 }}>
              <div style={{ fontSize: 56, fontWeight: 900, color: "#34D399" }}>84.6%</div>
              <div className="font-mono" style={{ background: "#222", padding: "6px 18px", borderRadius: 20, fontSize: 15, color: "#ddd" }}>
                33 / 39 Classes
              </div>
            </div>
            <div style={{ background: "#222", height: 8, borderRadius: 4, marginTop: 16, overflow: "hidden" }}>
              <div style={{ background: "#34D399", height: "100%", width: "84.6%" }} />
            </div>
            {/* What-If Simulation Projection Slider */}
            <div style={{ marginTop: 20, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#aaa" }}>
                <span>What-If Simulator (Next 5 Classes):</span>
                <span style={{ color: "#34D399", fontWeight: 700 }}>Projected: 86.4%</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                {[1, 2, 3, 4, 5].map((idx) => (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      background: idx <= 3 ? "#34D399" : "#F59E0B",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Card: Recovery Alert */}
          <div
            className="font-sans"
            style={{
              position: "absolute",
              transform: `translate3d(460px, 30px, 70px) rotate(3deg) translateY(${Math.sin(t * 1.8 + 2) * 6}px)`,
              background: "#12141a",
              borderRadius: 36,
              padding: "28px 32px",
              color: "#fff",
              boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
              width: 380,
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#888" }}>
              <span>Fiber Optic Communication</span>
              <span style={{ color: "#F87171", background: "rgba(248,113,113,0.15)", padding: "2px 10px", borderRadius: 12, fontWeight: 700 }}>
                Recovery Alert
              </span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "#F87171", marginTop: 12 }}>74.1%</div>
            <div style={{ fontSize: 15, color: "#ddd", marginTop: 8 }}>
              ⚠️ <strong style={{ color: "#fff" }}>Attend next 1 class</strong> to cross 75% ordinance
            </div>
            <div style={{ marginTop: 14, background: "#1c1e24", padding: "10px 14px", borderRadius: 14, fontSize: 12, color: "#aaa" }}>
              Recovery Trajectory: 1 lecture needed
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ACT IV: YOUR ACADEMIC WORLD (31.0s – 41.0s | 930-1230)   */}
      {/* ======================================================== */}
      {t >= 30.8 && t < 41.3 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: t < 31.6 ? (t - 30.8) * 1.5 : t > 40.2 ? (41.0 - t) * 1.4 : 1,
            zIndex: 20,
          }}
        >
          {/* Headline Top */}
          <div
            style={{
              position: "absolute",
              top: 40,
              textAlign: "center",
            }}
          >
            <h2 className="font-serif" style={{ fontSize: 72, color: "#111", margin: 0 }}>
              Your academic world, connected.
            </h2>
            <div className="font-ndot" style={{ fontSize: 16, color: "#555", marginTop: 6, letterSpacing: 2 }}>
              INSTITUTE CALENDAR • CLASSROOM HUB • PDF DOCUMENT BROADCASTS
            </div>
          </div>

          {/* Split Presentation: Calendar on Left, Classroom Broadcast with PDF on Right */}
          <div style={{ display: "flex", gap: 36, alignItems: "center", marginTop: 50 }}>
            {/* Institute Calendar Card */}
            <div
              className="font-sans"
              style={{
                width: 440,
                background: "#12141a",
                borderRadius: 36,
                padding: "28px 32px",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 30px 80px rgba(0,0,0,0.4)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>November 2026</div>
                <div className="font-mono" style={{ fontSize: 12, color: "#34D399", background: "#111", padding: "4px 10px", borderRadius: 8 }}>
                  Endsem in 24d
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginTop: 16, textAlign: "center", fontSize: 12, color: "#888" }}>
                <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginTop: 12, textAlign: "center", fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: "#444" }}>28</span><span style={{ color: "#444" }}>29</span><span style={{ color: "#444" }}>30</span><span>1</span><span>2</span><span>3</span><span>4</span>
                <span style={{ color: "#F59E0B" }}>5</span><span style={{ background: "#F59E0B", color: "#000", borderRadius: 8, padding: "4px 0" }}>6</span><span>7</span><span style={{ color: "#E11D48" }}>8</span><span>9</span><span>10</span><span>11</span>
              </div>
              <div style={{ marginTop: 20, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14, fontSize: 13, color: "#aaa" }}>
                Nov 8: Diwali (Deepavali) • Nov 30: End Semester Theory Exam
              </div>
            </div>

            {/* Classroom Hub & PDF Attachment Card */}
            <div
              className="font-sans"
              style={{
                width: 480,
                background: "#14161f",
                borderRadius: 36,
                padding: "32px 36px",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.16)",
                boxShadow: "0 30px 80px rgba(0,0,0,0.4)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#a855f7" }} />
                  <span style={{ fontSize: 16, fontWeight: 800 }}>Classroom Announcement</span>
                </div>
                <span style={{ fontSize: 12, color: "#888" }}>Just now</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 14 }}>
                Prof. A. Sharma • Fiber Optic Communication
              </div>
              <div style={{ fontSize: 14, color: "#bbb", marginTop: 6, lineHeight: 1.4 }}>
                "Syllabus notes for Unit 4 (Optical Amplifiers & DWDM) have been published. Refer to these before next lab assessment."
              </div>

              {/* PDF Document Attachment Box */}
              <div
                style={{
                  background: "#1c1e28",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 20,
                  padding: "16px 20px",
                  marginTop: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(225,29,72,0.15)", color: "#F43F5E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800 }}>
                    PDF
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Unit_4_Lecture_Notes.pdf</div>
                    <div style={{ fontSize: 12, color: "#888" }}>2.4 MB • 42 Pages</div>
                  </div>
                </div>
                <div style={{ background: "#262934", color: "#34D399", padding: "6px 14px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                  ✓ Downloaded
                </div>
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
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: t < 41.6 ? (t - 40.8) * 1.5 : t > 50.2 ? (51.0 - t) * 1.4 : 1,
            zIndex: 20,
          }}
        >
          {/* Headline Top */}
          <div
            style={{
              position: "absolute",
              top: 40,
              textAlign: "center",
            }}
          >
            <h2 className="font-serif" style={{ fontSize: 72, color: "#111", margin: 0 }}>
              Intelligence that understands your semester.
            </h2>
            <div className="font-ndot" style={{ fontSize: 16, color: "#555", marginTop: 6, letterSpacing: 2 }}>
              0ms LOCAL DETERMINISTIC FAST-PATH • NATURAL LANGUAGE COPILOT
            </div>
          </div>

          {/* Copilot Dialogue Card */}
          <div
            className="font-sans"
            style={{
              width: 680,
              background: "#111318",
              borderRadius: 44,
              padding: "40px 48px",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 40px 100px rgba(0,0,0,0.5)",
              marginTop: 60,
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 18 }}>
              <div style={{ width: 44, height: 44, borderRadius: 16, background: "#6EE7B7", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900 }}>
                ✨
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>AttendX AI Copilot</div>
                <div className="font-mono" style={{ fontSize: 12, color: "#34D399" }}>0ms Fast-Path Active</div>
              </div>
            </div>

            {/* User Message */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <div
                style={{
                  background: "#222530",
                  padding: "14px 22px",
                  borderRadius: "22px 22px 4px 22px",
                  fontSize: 16,
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                Can I bunk DBMS tomorrow?
              </div>
            </div>

            {/* AI Response */}
            <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 18 }}>
              <div
                style={{
                  background: "rgba(52,211,153,0.12)",
                  border: "1px solid rgba(52,211,153,0.3)",
                  padding: "18px 24px",
                  borderRadius: "22px 22px 22px 4px",
                  fontSize: 16,
                  color: "#E2E8F0",
                  lineHeight: 1.5,
                  maxWidth: 540,
                }}
              >
                <div style={{ color: "#34D399", fontWeight: 800, fontSize: 17, marginBottom: 4 }}>
                  ✓ Safe to bunk DBMS tomorrow.
                </div>
                You currently have <strong>3 safe bunks remaining</strong>. Missing tomorrow's lecture will adjust your attendance to <strong>82.4%</strong>, comfortably above IIIT Una's 75% ordinance.
                <div style={{ marginTop: 12, fontSize: 13, color: "#94A3B8", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
                  ⏱️ Timeline: Mid-Semester Exams concluded 46d ago • Endsem in 24 days.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ACT VI: PERSONALIZATION & THEME SHOWSTOPPER (51s – 61s)  */}
      {/* ======================================================== */}
      {t >= 50.8 && t < 61.3 && (() => {
        const isNova = t >= 53.5 && t < 57.0;
        const isBurgundy = t >= 57.0;
        const themeColor = isBurgundy ? "#881337" : isNova ? "#052e16" : "#0c0e12";
        const accentColor = isBurgundy ? "#fb7185" : isNova ? "#34D399" : "#FFD814";
        const envBg = isBurgundy
          ? "radial-gradient(circle at center, #4c0519 0%, #1c0209 100%)"
          : isNova
          ? "radial-gradient(circle at center, #022c22 0%, #061512 100%)"
          : "linear-gradient(135deg, #dbe4f0 0%, #ecdfe3 50%, #f6d8d9 100%)";

        return (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: envBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: t < 51.6 ? (t - 50.8) * 1.5 : t > 60.2 ? (61.0 - t) * 1.4 : 1,
              transition: "background 0.6s ease",
              zIndex: 25,
            }}
          >
            {/* Headline Top */}
            <div
              style={{
                position: "absolute",
                top: 40,
                textAlign: "center",
              }}
            >
              <h2 className="font-serif" style={{ fontSize: 76, color: isNova || isBurgundy ? "#fff" : "#111", margin: 0, transition: "color 0.4s" }}>
                Your experience. Your aesthetic.
              </h2>
              <div className="font-ndot" style={{ fontSize: 16, color: isNova || isBurgundy ? "#ccc" : "#555", marginTop: 6, letterSpacing: 2 }}>
                DYNAMIC SYSTEM-WIDE THEMING • ISOLATED PAGE ARCHITECTURE
              </div>
            </div>

            {/* Smartphone with Dynamic Live Theme Transition */}
            <div
              style={{
                width: 440,
                height: 740,
                background: themeColor,
                borderRadius: 56,
                padding: 20,
                border: `5px solid ${accentColor}`,
                boxShadow: `0 40px 120px rgba(0,0,0,0.6), 0 0 50px ${accentColor}33`,
                display: "flex",
                flexDirection: "column",
                color: "#fff",
                transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
                marginTop: 60,
              }}
              className="font-sans"
            >
              {/* Header inside phone */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 12 }}>
                <span style={{ fontSize: 18, fontWeight: 800 }}>Settings & Appearance</span>
                <span style={{ fontSize: 13, color: accentColor, fontWeight: 700 }}>
                  {isBurgundy ? "Burgundy Royal" : isNova ? "Nova Green" : "Obsidian Dark"}
                </span>
              </div>

              {/* Theme Selector Palette Swatches */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, padding: "0 10px" }}>
                {[
                  { name: "Obsidian", color: "#0c0e12", active: !isNova && !isBurgundy },
                  { name: "Nova", color: "#10B981", active: isNova },
                  { name: "Burgundy", color: "#E11D48", active: isBurgundy },
                  { name: "Cyberpunk", color: "#F59E0B", active: false },
                  { name: "Lavender", color: "#8B5CF6", active: false },
                ].map((th, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        background: th.color,
                        border: th.active ? "3px solid #fff" : "2px solid rgba(255,255,255,0.3)",
                        boxShadow: th.active ? `0 0 20px ${th.color}` : "none",
                        transform: th.active ? "scale(1.2)" : "scale(1)",
                        transition: "all 0.3s ease",
                      }}
                    />
                    <span style={{ fontSize: 11, color: th.active ? "#fff" : "#888", fontWeight: th.active ? 800 : 500 }}>
                      {th.name}
                    </span>
                  </div>
                ))}
              </div>

              {/* Themed Dashboard Preview Card */}
              <div
                style={{
                  background: isBurgundy ? "#4c0519" : isNova ? "#064e3b" : "#161820",
                  borderRadius: 24,
                  padding: 20,
                  marginTop: 28,
                  border: `1px solid ${accentColor}44`,
                  transition: "background 0.4s",
                }}
              >
                <div style={{ fontSize: 12, color: accentColor, fontWeight: 700 }}>TODAY'S SCHEDULE</div>
                <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4 }}>Artificial Intelligence</div>
                <div style={{ fontSize: 13, color: "#ccc", marginTop: 4 }}>14:00 - 14:50 • Room 228</div>
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <div style={{ background: accentColor, color: isBurgundy || isNova ? "#000" : "#000", padding: "8px 18px", borderRadius: 12, fontSize: 12, fontWeight: 800 }}>
                    Attended
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.1)", color: "#fff", padding: "8px 18px", borderRadius: 12, fontSize: 12 }}>
                    Off
                  </div>
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
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: t < 61.6 ? (t - 60.8) * 1.5 : t > 70.2 ? (71.0 - t) * 1.4 : 1,
            zIndex: 20,
          }}
        >
          {/* Headline Top */}
          <div
            style={{
              position: "absolute",
              top: 40,
              textAlign: "center",
            }}
          >
            <h2 className="font-serif" style={{ fontSize: 72, color: "#111", margin: 0 }}>
              Hardware-level Android integration.
            </h2>
            <div className="font-ndot" style={{ fontSize: 16, color: "#555", marginTop: 6, letterSpacing: 2 }}>
              DYNAMIC HUD • 4x2 INTERACTIVE WIDGET • FOREGROUND LECTURE DND
            </div>
          </div>

          {/* Android Phone & 4x2 Interactive Home Widget */}
          <div style={{ display: "flex", gap: 40, alignItems: "center", marginTop: 50 }}>
            {/* Smartphone showing Dynamic HUD & FCM Banner */}
            <div
              style={{
                width: 380,
                height: 680,
                background: "#0c0e12",
                borderRadius: 56,
                padding: 16,
                border: "5px solid #202227",
                boxShadow: "0 35px 90px rgba(0,0,0,0.5)",
                display: "flex",
                flexDirection: "column",
                color: "#fff",
              }}
              className="font-sans"
            >
              {/* Dynamic Island HUD Pill */}
              <div
                style={{
                  background: "#000",
                  borderRadius: 30,
                  padding: "8px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.8)",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#34D399" }} />
                  <span style={{ fontSize: 13, fontWeight: 800 }}>Artificial Intelligence</span>
                </div>
                <span className="font-mono" style={{ fontSize: 12, color: "#34D399" }}>24m left</span>
              </div>

              {/* FCM Push Notification Arrival at 64s */}
              {t > 63.5 && (
                <div
                  style={{
                    background: "rgba(30,33,45,0.95)",
                    backdropFilter: "blur(12px)",
                    borderRadius: 22,
                    padding: "14px 18px",
                    marginTop: 18,
                    border: "1px solid rgba(255,255,255,0.15)",
                    boxShadow: "0 15px 40px rgba(0,0,0,0.5)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#aaa" }}>
                    <span>ATTENDX BROADCAST</span>
                    <span>Now</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>New Announcement: Unit 4 Notes</div>
                  <div style={{ fontSize: 12, color: "#ccc", marginTop: 2 }}>Prof. Sharma posted 1 new PDF attachment</div>
                </div>
              )}

              {/* Automated Lecture DND Banner */}
              <div
                style={{
                  marginTop: "auto",
                  background: "rgba(245,158,11,0.15)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  borderRadius: 20,
                  padding: "14px 18px",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: "#F59E0B" }}>🔕 Lecture DND Active</div>
                <div style={{ fontSize: 12, color: "#ddd", marginTop: 2 }}>
                  Phone muted automatically via Foreground Service. Auto-restores when class ends.
                </div>
              </div>
            </div>

            {/* 4x2 Home Screen Widget Display */}
            <div
              className="font-sans"
              style={{
                width: 480,
                background: "#14161f",
                borderRadius: 36,
                padding: "32px 36px",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.18)",
                boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#34D399" }} />
                  <span style={{ fontSize: 16, fontWeight: 800 }}>4x2 Android Home Widget</span>
                </div>
                <span className="font-mono" style={{ fontSize: 14, color: "#34D399", fontWeight: 800 }}>85.28% Safe</span>
              </div>

              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#888" }}>
                  <span>NEXT LECTURE</span>
                  <span style={{ color: "#34D399", fontWeight: 700 }}>🟢 IN 15 MINS</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>Fiber Optic Communication</div>
                <div style={{ fontSize: 13, color: "#aaa", marginTop: 2 }}>14:50 - 15:40 • Room 326</div>
              </div>

              {/* 1-Tap Attendance Buttons right on the home screen */}
              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                <div style={{ flex: 1, background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", color: "#34D399", padding: "10px 0", borderRadius: 14, fontSize: 13, fontWeight: 800, textAlign: "center" }}>
                  ✓ Attended
                </div>
                <div style={{ flex: 1, background: "#222530", color: "#888", padding: "10px 0", borderRadius: 14, fontSize: 13, textAlign: "center" }}>
                  ✗ Missed
                </div>
                <div style={{ flex: 1, background: "#222530", color: "#F59E0B", padding: "10px 0", borderRadius: 14, fontSize: 13, textAlign: "center" }}>
                  Off
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ACT VIII: PEER SYNC, OFFLINE & EVOLUTION (71s – 81s)     */}
      {/* ======================================================== */}
      {t >= 70.8 && t < 81.3 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: t < 71.6 ? (t - 70.8) * 1.5 : t > 80.2 ? (81.0 - t) * 1.4 : 1,
            zIndex: 20,
          }}
        >
          {/* Headline Top */}
          <div
            style={{
              position: "absolute",
              top: 40,
              textAlign: "center",
            }}
          >
            <h2 className="font-serif" style={{ fontSize: 72, color: "#111", margin: 0 }}>
              Built with students. Improved by students.
            </h2>
            <div className="font-ndot" style={{ fontSize: 16, color: "#555", marginTop: 6, letterSpacing: 2 }}>
              100% OFFLINE-FIRST • INSTANT PEER SYNC • SEAMLESS OTA EVOLUTION
            </div>
          </div>

          <div style={{ display: "flex", gap: 36, alignItems: "center", marginTop: 50 }}>
            {/* Peer Sync & Offline Resilience Card */}
            <div
              className="font-sans"
              style={{
                width: 460,
                background: "#12141a",
                borderRadius: 36,
                padding: "32px 36px",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 30px 80px rgba(0,0,0,0.4)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 14 }}>
                <span style={{ fontSize: 17, fontWeight: 800 }}>Peer Sync & Offline Queue</span>
                <span className="font-mono" style={{ fontSize: 12, color: "#34D399", background: "#111", padding: "4px 10px", borderRadius: 8 }}>
                  ✓ In Sync
                </span>
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 13, color: "#aaa" }}>1-Tap Class Schedule Sharing:</div>
                <div className="font-mono" style={{ background: "#1a1d26", padding: "12px 18px", borderRadius: 14, fontSize: 16, fontWeight: 800, color: "#FFD814", marginTop: 6, textAlign: "center", letterSpacing: 4 }}>
                  SYNC-IIITU-2026
                </div>
              </div>

              <div style={{ marginTop: 20, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 18, padding: "14px 18px" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#34D399" }}>📶 100% Offline-First Architecture</div>
                <div style={{ fontSize: 12, color: "#ccc", marginTop: 2 }}>
                  IndexedDB & native Preferences cache. Attendance marks buffer offline and auto-reconcile on reconnection with zero data loss.
                </div>
              </div>
            </div>

            {/* In-App Feedback & Live OTA Update Card */}
            <div
              className="font-sans"
              style={{
                width: 480,
                background: "#14161f",
                borderRadius: 36,
                padding: "32px 36px",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.16)",
                boxShadow: "0 30px 80px rgba(0,0,0,0.4)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 14 }}>
                <span style={{ fontSize: 17, fontWeight: 800 }}>Student Feedback & OTA</span>
                <span className="font-mono" style={{ fontSize: 12, color: "#F43F5E", background: "#111", padding: "4px 10px", borderRadius: 8 }}>
                  v4.3.0 Final
                </span>
              </div>

              {/* Feedback Confirmation Toast */}
              <div style={{ marginTop: 18, background: "#1c1e28", borderRadius: 18, padding: "14px 18px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>💬 Feedback Delivered</div>
                <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
                  "Added PDF document attachments for classroom notes!"
                </div>
              </div>

              {/* Live OTA Update Notification */}
              <div style={{ marginTop: 18, background: "rgba(225,29,72,0.1)", border: "1px solid rgba(225,29,72,0.3)", borderRadius: 18, padding: "14px 18px" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#F43F5E" }}>⚡ Seamless OTA Update Applied</div>
                <div style={{ fontSize: 12, color: "#ddd", marginTop: 2 }}>
                  Hot-patch bundled and synchronized without requiring full APK re-download from app stores.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ACT IX: MODERN ECOSYSTEM FINALE (81.0s – 90.0s | 2430-2700)*/}
      {/* ======================================================== */}
      {t >= 80.8 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            opacity: Math.min(1, (t - 80.8) * 1.5),
            zIndex: 30,
          }}
        >
          {/* Rotating 3D Orbit Constellation of all components */}
          {t < 86.5 && (
            <div
              style={{
                position: "relative",
                width: 420,
                height: 420,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `rotate(${-(t - 81.0) * 18}deg)`,
              }}
            >
              {[
                { icon: "🎓", label: "75% Ordinance" },
                { icon: "📅", label: "Timetable" },
                { icon: "📊", label: "Analytics" },
                { icon: "🏛️", label: "Institute Calendar" },
                { icon: "📄", label: "Classroom PDFs" },
                { icon: "🤖", label: "0ms Copilot" },
                { icon: "🎛️", label: "4x2 Widget" },
                { icon: "🔕", label: "Lecture DND" },
              ].map((item, idx) => {
                const angle = (idx * 45 * Math.PI) / 180;
                const radius = 160 + (t - 81.0) * 12;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                return (
                  <div
                    key={idx}
                    style={{
                      position: "absolute",
                      width: 64,
                      height: 64,
                      borderRadius: 22,
                      background: "#121418",
                      border: "1px solid rgba(255,255,255,0.18)",
                      boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 28,
                      transform: `translate3d(${x}px, ${y}px, 0) rotate(${(t - 81.0) * 20}deg)`,
                    }}
                  >
                    {item.icon}
                  </div>
                );
              })}

              {/* Center Dot-Matrix Title: MODERN ECOSYSTEM */}
              <div
                className="font-ndot"
                style={{
                  fontSize: 24,
                  color: "#111",
                  textTransform: "uppercase",
                  letterSpacing: 4,
                  fontWeight: 900,
                  textAlign: "center",
                }}
              >
                Modern Ecosystem
              </div>
            </div>
          )}

          {/* Grand Reveal Outro at 86.5s */}
          {t >= 86.2 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                transform: `scale(${0.96 + (t - 86.2) * 0.012})`,
                opacity: Math.min(1, (t - 86.2) * 2),
              }}
            >
              {/* App Icon */}
              <div
                style={{
                  width: 104,
                  height: 104,
                  borderRadius: 36,
                  background: "#121418",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  marginBottom: 24,
                }}
              >
                <img src={staticFile("attendx_app_icon.png")} alt="AttendX" style={{ width: 70, height: 70 }} />
              </div>

              {/* Title */}
              <h1 className="font-serif" style={{ fontSize: 110, color: "#111", margin: 0, lineHeight: 0.95 }}>
                AttendX
              </h1>

              {/* Signature Tagline */}
              <p className="font-ndot" style={{ fontSize: 24, color: "#333", marginTop: 14 }}>
                Smart Attendance. Simplified.
              </p>

              <div className="font-sans" style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 16, textTransform: "uppercase", letterSpacing: 3, color: "#666", fontWeight: 700 }}>
                  Built for students, by students.
                </span>
                <span className="font-serif" style={{ fontStyle: "italic", fontSize: 22, color: "#222" }}>
                  Indian Institute of Information Technology, Una
                </span>
                <div style={{ marginTop: 10, display: "flex", gap: 10, justifyContent: "center" }}>
                  <span className="font-mono" style={{ fontSize: 13, background: "#111", color: "#fff", padding: "4px 14px", borderRadius: 8 }}>
                    v4.3.0 Final
                  </span>
                  <span className="font-mono" style={{ fontSize: 13, background: "rgba(0,0,0,0.08)", color: "#111", padding: "4px 14px", borderRadius: 8 }}>
                    Android & Web
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
