import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { X, Download, Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { useBackHandlerStore } from "../../stores/backHandlerStore";
import { useScrollLock } from "../../hooks/useScrollLock";
import { WrapSnapshot, WrapCopyPayload, buildLocalRemarkQuip } from "../../utils/wrapEngine";
import { ensureLocalAvatarDataUrl, getCachedLocalAvatar, normalizeRawAvatarUrl } from "../../utils/avatarCache";

function resolveAvatarUrl(url?: string | null): string | null {
  return normalizeRawAvatarUrl(url);
}

export type PosterTheme = "native" | "obsidian" | "moss" | "burgundy";

interface WrapShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: WrapSnapshot;
  copy: WrapCopyPayload;
  slideIndex?: number; // -1 = full overview poster, 0..8 = tailored story card poster
  storyPosition?: number;
  totalSlides?: number;
  selectedRemark?: string;
  selectedMonthIdx?: number;
}

const SLIDE_NAMES = [
  "Semester Opener",
  "Forecast Runway",
  "Upcoming Horizon",
  "Top Subjects",
  "Monthly Arc",
  "Streak Signature",
  "Missing Pattern",
  "Remarks & Mazaa",
  "AttendX Persona",
];

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fitCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
): string {
  const raw = String(text || "").trim();
  if (!raw) return "";
  if (ctx.measureText(raw).width <= maxW) return raw;
  let end = raw.length;
  while (end > 2 && ctx.measureText(`${raw.slice(0, end)}…`).width > maxW) {
    end--;
  }
  return `${raw.slice(0, Math.max(1, end))}…`;
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineHeight: number,
  maxLines = 4,
): number {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  let line = "";
  let cy = y;
  let lineCount = 0;

  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      if (lineCount >= maxLines - 1) {
        const remaining = [line, ...words.slice(i)].join(" ");
        ctx.fillText(fitCanvasText(ctx, remaining, maxW), x, cy);
        return cy + lineHeight;
      }
      ctx.fillText(fitCanvasText(ctx, line, maxW), x, cy);
      cy += lineHeight;
      line = words[i];
      lineCount++;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(fitCanvasText(ctx, line, maxW), x, cy);
    cy += lineHeight;
  }
  return cy;
}

export const WrapShareSheet: React.FC<WrapShareSheetProps> = ({
  isOpen,
  onClose,
  snapshot,
  copy,
  slideIndex = -1,
  storyPosition,
  totalSlides,
  selectedRemark = "",
  selectedMonthIdx = -1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const avatarImgRef = useRef<HTMLImageElement | null>(null);
  const [posterTheme, setPosterTheme] = useState<PosterTheme>(
    slideIndex >= 0 ? "native" : "obsidian",
  );
  const [posterMode, setPosterMode] = useState<"card" | "summary">(
    slideIndex >= 0 ? "card" : "summary",
  );
  const [statusLabel, setStatusLabel] = useState<string>("");
  const [renderTick, setRenderTick] = useState(0);

  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    setPosterMode(slideIndex >= 0 ? "card" : "summary");
    setPosterTheme(slideIndex >= 0 ? "native" : "obsidian");
    setStatusLabel("");
    document.fonts?.ready?.then(() => setRenderTick((t) => t + 1)).catch(() => {});
  }, [slideIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const unregister = useBackHandlerStore.getState().register(() => {
      onClose();
      return true;
    });
    return () => unregister();
  }, [isOpen, onClose]);

  // Decode avatar image via local cache / CORS-safe data URL so Canvas never gets tainted or falls back to initials
  useEffect(() => {
    avatarImgRef.current = null;
    if (!isOpen) return;
    const rawUrl = resolveAvatarUrl(snapshot.user.avatarUrl);
    if (!rawUrl) return;

    let cancelled = false;
    const loadSrc = (src: string) => {
      const img = new Image();
      if (!src.startsWith("data:") && !src.startsWith("blob:")) {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => {
        if (!cancelled) {
          avatarImgRef.current = img;
          setRenderTick((t) => t + 1);
        }
      };
      img.src = src;
    };

    const cachedLocal = getCachedLocalAvatar(snapshot.user.id, rawUrl);
    if (cachedLocal) {
      loadSrc(cachedLocal);
    } else {
      ensureLocalAvatarDataUrl(snapshot.user.id, rawUrl).then((dataUrl) => {
        if (!cancelled) {
          loadSrc(dataUrl || rawUrl);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [snapshot.user.id, snapshot.user.avatarUrl, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const activeIdx = posterMode === "card" && slideIndex >= 0 ? slideIndex : -1;

    type CardPalette = {
      c1: string;
      c2: string;
      c3: string;
      accent: string;
      sub: string;
      tintFill: string;
      tintBorder: string;
    };

    const SLIDE_NATIVE_PALETTES: Record<number, CardPalette> = {
      0: { c1: "#2c302c", c2: "#171917", c3: "#101110", accent: "#b7f357", sub: "#b8beb8", tintFill: "rgba(183,243,87,0.12)", tintBorder: "rgba(183,243,87,0.28)" },
      1: { c1: "#556f12", c2: "#314209", c3: "#161d06", accent: "#b7f357", sub: "#d9f99d", tintFill: "rgba(183,243,87,0.14)", tintBorder: "rgba(183,243,87,0.32)" },
      2: { c1: "#272321", c2: "#181514", c3: "#110f0f", accent: "#fcd34d", sub: "#d6d3d1", tintFill: "rgba(244,63,94,0.12)", tintBorder: "rgba(251,113,133,0.28)" },
      3: { c1: "#2e2926", c2: "#181514", c3: "#110f0f", accent: "#b7f357", sub: "#d6d3d1", tintFill: "rgba(255,255,255,0.08)", tintBorder: "rgba(255,255,255,0.16)" },
      4: { c1: "#523422", c2: "#2b1b13", c3: "#150e0a", accent: "#fbbf24", sub: "#fde68a", tintFill: "rgba(251,191,36,0.14)", tintBorder: "rgba(251,191,36,0.32)" },
      5: { c1: "#37233f", c2: "#1e1323", c3: "#100b13", accent: "#c084fc", sub: "#d8b4fe", tintFill: "rgba(192,132,252,0.14)", tintBorder: "rgba(192,132,252,0.35)" },
      6: { c1: "#415822", c2: "#243312", c3: "#111909", accent: "#b7f357", sub: "#d9f99d", tintFill: "rgba(183,243,87,0.12)", tintBorder: "rgba(183,243,87,0.28)" },
      7: { c1: "#3d242e", c2: "#22141a", c3: "#130b0e", accent: "#fda4af", sub: "#fecdd3", tintFill: "rgba(251,113,133,0.16)", tintBorder: "rgba(253,164,175,0.38)" },
      8: { c1: "#5b1826", c2: "#2f0e15", c3: "#14080b", accent: "#b7f357", sub: "#fda4af", tintFill: "rgba(0,0,0,0.40)", tintBorder: "rgba(255,255,255,0.18)" },
    };

    const THEME_PALETTES: Record<Exclude<PosterTheme, "native">, CardPalette> = {
      obsidian: { c1: "#262a26", c2: "#151715", c3: "#0e0f0e", accent: "#b7f357", sub: "#a7ada7", tintFill: "rgba(255,255,255,0.08)", tintBorder: "rgba(255,255,255,0.16)" },
      moss: { c1: "#495f10", c2: "#273508", c3: "#121904", accent: "#d9f99d", sub: "#cbd5b8", tintFill: "rgba(217,249,157,0.14)", tintBorder: "rgba(217,249,157,0.30)" },
      burgundy: { c1: "#5e1828", c2: "#310c14", c3: "#15070a", accent: "#fda4af", sub: "#fecdd3", tintFill: "rgba(253,164,175,0.14)", tintBorder: "rgba(253,164,175,0.30)" },
    };

    const pal: CardPalette =
      posterTheme === "native"
        ? SLIDE_NATIVE_PALETTES[activeIdx] || THEME_PALETTES.obsidian
        : THEME_PALETTES[posterTheme];

    ctx.clearRect(0, 0, W, H);

    // 1. Background Radial Gradient matching selected card/theme
    const grad = ctx.createRadialGradient(
      W * 0.5,
      H * 0.24,
      60,
      W * 0.5,
      H * 0.58,
      H * 0.78,
    );
    grad.addColorStop(0, pal.c1);
    grad.addColorStop(0.55, pal.c2);
    grad.addColorStop(1, pal.c3);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Outer subtle card border
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 3;
    drawRoundRect(ctx, 40, 40, W - 80, H - 80, 68);
    ctx.stroke();

    const buildCanvasFont = (spec: string, size: number): string => {
      const trimmed = String(spec || "").trim();
      const m = trimmed.match(/^(italic(?:\s+(?:\d{3}|bold|normal))?|\d{3}|bold|normal)\s+(.+)$/i);
      if (m) return `${m[1].trim()} ${size}px ${m[2].trim()}`;
      return `${size}px ${trimmed}`;
    };

    const drawFittedText = (
      text: string,
      x: number,
      y: number,
      maxW: number,
      maxPx: number,
      minPx: number,
      weightAndFamily: string,
      align: CanvasTextAlign = "left",
    ) => {
      let size = maxPx;
      const raw = String(text || "").trim();
      while (size > minPx) {
        ctx.font = buildCanvasFont(weightAndFamily, size);
        if (ctx.measureText(raw).width <= maxW) break;
        size -= 2;
      }
      ctx.font = buildCanvasFont(weightAndFamily, size);
      ctx.textAlign = align;
      ctx.fillText(fitCanvasText(ctx, raw, maxW), x, y);
      ctx.textAlign = "left";
    };

    const drawAvatar = (cx: number, cy: number, r: number, ringColor: string) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fill();
      const img = avatarImgRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        try {
          ctx.clip();
          ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
        } catch {}
      } else {
        ctx.fillStyle = ringColor;
        ctx.font = `800 ${Math.round(r * 0.78)}px Geist, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((snapshot.user.name || "S").slice(0, 1).toUpperCase(), cx, cy + 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
      ctx.restore();

      ctx.strokeStyle = ringColor;
      ctx.lineWidth = Math.max(3, Math.round(r * 0.08));
      ctx.beginPath();
      ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
      ctx.stroke();
    };

    // 2. Minimal Top Brand & Replay Strip (leaves the full card space clean!)
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    const topTag =
      activeIdx >= 0
        ? `${snapshot.semester.isPastTeachingDay ? "WRAP" : "REPLAY"} · ${snapshot.semester.name.toUpperCase()}`
        : `${snapshot.semester.name.toUpperCase()} · ${snapshot.semester.isPastTeachingDay ? "WRAP" : "OVERALL"}`;
    drawFittedText(topTag, 84, 128, W - 400, 26, 18, "600 'JetBrains Mono', ui-monospace, monospace");

    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 44px Geist, -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("AttendX", W - 84, 132);
    ctx.textAlign = "left";

    const drawStatTile = (x: number, y: number, w: number, h: number, label: string, val: string, subVal?: string) => {
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 2;
      drawRoundRect(ctx, x, y, w, h, 36);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.58)";
      drawFittedText(label, x + 32, y + 54, w - 64, 22, 16, "600 'JetBrains Mono', ui-monospace, monospace");

      ctx.fillStyle = pal.accent;
      drawFittedText(val, x + 32, y + Math.round(h * 0.60), w - 64, 42, 24, "800 Geist, -apple-system, sans-serif");

      if (subVal) {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        drawFittedText(subVal, x + 32, y + h - 32, w - 64, 24, 16, "500 Geist, sans-serif");
      }
    };

    // =========================================================================
    // 3. EXACT ACTUAL CARD RENDERER PER SCREEN SLIDE (0..8) OR OVERALL WRAP (-1)
    // =========================================================================
    if (activeIdx === 0) {
      // SLIDE 0: INTRO COLLAGE — Exact 5 Floating Collage Tiles
      const perfectLabsCount = snapshot.subjectsRanked.filter((s) => s.pct === 100).length;
      const topMonth = [...snapshot.months].sort((a, b) => b.pct - a.pct)[0];
      const bestWeekday = [...snapshot.missingPatterns.weekdays].sort((a, b) => b.attendPct - a.attendPct)[0];

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 68px Geist, sans-serif";
      const headEnd = wrapTextLines(
        ctx,
        `Your ${snapshot.semester.name} ${snapshot.semester.isPastTeachingDay ? "Wrap" : "Replay"} is ready.`,
        84,
        276,
        W - 168,
        82,
        2,
      );
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "500 32px Geist, sans-serif";
      wrapTextLines(ctx, copy.introSubtitle, 84, headEnd + 14, W - 168, 44, 2);

      // Center Tilted Square Photo Card (-2deg)
      ctx.save();
      ctx.translate(540, 950);
      ctx.rotate(-0.035);
      drawRoundRect(ctx, -230, -230, 460, 460, 56);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = "#202220";
      ctx.fillRect(-230, -230, 460, 460);
      const img = avatarImgRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        try {
          ctx.drawImage(img, -230, -230, 460, 460);
        } catch {}
      } else {
        ctx.fillStyle = pal.accent;
        ctx.font = "800 140px Geist, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((snapshot.user.name || "S").slice(0, 1).toUpperCase(), 0, -20);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
      const overlayGrad = ctx.createLinearGradient(0, -100, 0, 230);
      overlayGrad.addColorStop(0, "rgba(0,0,0,0)");
      overlayGrad.addColorStop(0.55, "rgba(0,0,0,0.28)");
      overlayGrad.addColorStop(1, "rgba(0,0,0,0.88)");
      ctx.fillStyle = overlayGrad;
      ctx.fillRect(-230, -230, 460, 460);

      ctx.fillStyle = pal.accent;
      drawFittedText(`${snapshot.forecast.timelineProgressPct}% SEMESTER DONE`, -196, 134, 392, 22, 16, "700 'JetBrains Mono', monospace");
      ctx.fillStyle = "#ffffff";
      drawFittedText(`${snapshot.totals.percentage}%`, -196, 200, 392, 66, 44, "800 'JetBrains Mono', monospace");
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 3;
      drawRoundRect(ctx, -230, -230, 460, 460, 56);
      ctx.stroke();
      ctx.restore();

      // Top-Left Tilted Card (-8deg)
      ctx.save();
      ctx.translate(226, 672);
      ctx.rotate(-0.14);
      ctx.fillStyle = posterTheme === "native" ? "#314209" : pal.c1;
      ctx.strokeStyle = "rgba(217,249,157,0.30)";
      ctx.lineWidth = 2.5;
      drawRoundRect(ctx, -128, -96, 256, 192, 36);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(217,249,157,0.85)";
      drawFittedText(perfectLabsCount > 0 ? `${perfectLabsCount} LABS` : "REMAINING", -100, -26, 200, 22, 16, "700 'JetBrains Mono', monospace");
      ctx.fillStyle = "#ffffff";
      drawFittedText(perfectLabsCount > 0 ? "100%" : `${snapshot.forecast.remainingClasses} left`, -100, 42, 200, 48, 28, "800 'JetBrains Mono', monospace");
      ctx.restore();

      // Top-Right Tilted Peak Month Card (+7deg)
      if (topMonth) {
        ctx.save();
        ctx.translate(854, 720);
        ctx.rotate(0.12);
        ctx.fillStyle = posterTheme === "native" ? "#523422" : pal.c1;
        ctx.strokeStyle = "rgba(253,230,138,0.28)";
        ctx.lineWidth = 2.5;
        drawRoundRect(ctx, -128, -88, 256, 176, 36);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(253,230,138,0.88)";
        drawFittedText(`${topMonth.label.toUpperCase()} PEAK`, -100, -22, 200, 22, 16, "700 'JetBrains Mono', monospace");
        ctx.fillStyle = "#ffffff";
        drawFittedText(`${topMonth.pct}%`, -100, 38, 200, 42, 26, "800 'JetBrains Mono', monospace");
        ctx.restore();
      }

      // Bottom-Left Circular Streak Chip (+4deg)
      ctx.save();
      ctx.translate(238, 1218);
      ctx.rotate(0.07);
      ctx.fillStyle = "#242824";
      ctx.strokeStyle = "rgba(255,255,255,0.24)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 102, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillStyle = pal.accent;
      ctx.font = "800 44px 'JetBrains Mono', monospace";
      ctx.fillText(`${snapshot.calendarPatterns.bestGreenStreak.length}d`, 0, 6);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "600 20px Geist, sans-serif";
      ctx.fillText("STREAK", 0, 42);
      ctx.textAlign = "left";
      ctx.restore();

      // Bottom-Right Best Day Pill (-5deg)
      if (bestWeekday) {
        ctx.save();
        ctx.translate(816, 1210);
        ctx.rotate(-0.09);
        ctx.fillStyle = "#1a1c1a";
        ctx.strokeStyle = "rgba(255,255,255,0.24)";
        ctx.lineWidth = 2.5;
        drawRoundRect(ctx, -162, -64, 324, 128, 64);
        ctx.fill();
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "500 22px Geist, sans-serif";
        ctx.fillText("Best Day", 0, -14);
        ctx.fillStyle = "#ffffff";
        drawFittedText(`${bestWeekday.day} · ${bestWeekday.attendPct}%`, 0, 28, 280, 30, 20, "700 Geist, sans-serif", "center");
        ctx.restore();
      }

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "500 28px Geist, sans-serif";
      wrapTextLines(ctx, copy.phaseRoast, 84, 1525, W - 168, 40, 3);
    } else if (activeIdx === 1) {
      // SLIDE 1: TIMELINE SO FAR & FORECAST — Exact SVG Ring + Progress Box + 3-Col Strip
      ctx.fillStyle = pal.sub;
      drawFittedText(
        `CONDUCTED SO FAR: ${snapshot.totals.conducted} / ~${snapshot.forecast.totalForecastedClasses}`,
        84,
        240,
        W - 168,
        26,
        18,
        "600 'JetBrains Mono', monospace",
      );

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 66px Geist, sans-serif";
      const h1End = wrapTextLines(
        ctx,
        `You showed up to ${snapshot.totals.present} classes.`,
        84,
        324,
        W - 168,
        80,
        2,
      );
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = "500 29px Geist, sans-serif";
      wrapTextLines(ctx, copy.phaseRoast, 84, h1End + 12, W - 168, 40, 2);

      // Center Ring (Matches SVG circle exactly)
      const cx = W / 2;
      const cy = 790;
      const ringR = 200;
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.arc(cx, cy, ringR + 30, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.lineWidth = 24;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.stroke();

      const pctClamped = Math.min(100, Math.max(0, snapshot.totals.percentage));
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 24;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pctClamped) / 100);
      ctx.stroke();
      ctx.lineCap = "butt";

      ctx.fillStyle = "#ffffff";
      drawFittedText(
        `${snapshot.totals.percentage}%`,
        cx,
        cy + 14,
        ringR * 2 - 84,
        82,
        48,
        "800 'JetBrains Mono', monospace",
        "center",
      );
      ctx.textAlign = "center";
      ctx.fillStyle = pal.sub;
      ctx.font = "600 28px 'JetBrains Mono', monospace";
      ctx.fillText(`Target ${snapshot.totals.targetPercentage}%`, cx, cy + 72);
      ctx.textAlign = "left";

      // Progress Track & 3-Column Metrics Box
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 2;
      drawRoundRect(ctx, 84, 1110, W - 168, 360, 44);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 28px 'JetBrains Mono', monospace";
      ctx.fillText("Semester Progress", 128, 1178);
      ctx.textAlign = "right";
      ctx.fillStyle = pal.accent;
      ctx.fillText(`${snapshot.forecast.timelineProgressPct}%`, W - 128, 1178);
      ctx.textAlign = "left";

      ctx.fillStyle = "rgba(255,255,255,0.12)";
      drawRoundRect(ctx, 128, 1206, W - 256, 22, 11);
      ctx.fill();
      ctx.fillStyle = pal.accent;
      drawRoundRect(
        ctx,
        128,
        1206,
        Math.max(36, ((W - 256) * Math.min(100, snapshot.forecast.timelineProgressPct)) / 100),
        22,
        11,
      );
      ctx.fill();

      const miniCols = [
        { v: `${snapshot.forecast.remainingClasses}`, l: "Classes Left", col: "#ffffff" },
        { v: `${snapshot.forecast.maxSafeBunksAcrossRemaining}`, l: "Safe Bunks", col: pal.accent },
        { v: `${snapshot.forecast.projectedIfAttendAll}%`, l: "Max Ceiling", col: "#ffffff" },
      ];
      miniCols.forEach((mc, i) => {
        const bx = 128 + i * 282;
        const bw = 260;
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        drawRoundRect(ctx, bx, 1266, bw, 156, 28);
        ctx.fill();
        ctx.textAlign = "center";
        ctx.fillStyle = mc.col;
        drawFittedText(mc.v, bx + bw / 2, 1344, bw - 32, 42, 24, "800 'JetBrains Mono', monospace", "center");
        ctx.fillStyle = "rgba(255,255,255,0.58)";
        drawFittedText(mc.l, bx + bw / 2, 1392, bw - 28, 22, 16, "500 Geist, sans-serif", "center");
        ctx.textAlign = "left";
      });

      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = "500 30px Geist, sans-serif";
      wrapTextLines(ctx, copy.totalHeadline, 84, 1555, W - 168, 42, 3);
    } else if (activeIdx === 2) {
      // SLIDE 2: UPCOMING FESTS, BREAKS & EXAMINATIONS — Exact 2 Stacked Screen Boxes
      ctx.fillStyle = pal.sub;
      ctx.font = "600 26px 'JetBrains Mono', monospace";
      ctx.fillText("WHAT MORE IS LEFT", 84, 240);

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 68px Geist, sans-serif";
      wrapTextLines(ctx, "Fests, breaks & exams ahead.", 84, 326, W - 168, 82, 2);

      // Card 1: Fests & Breaks Coming In
      const fests = snapshot.upcomingHorizon.festsAndBreaks.slice(0, 3);
      const festCardH = Math.max(210, 120 + fests.length * 116);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      drawRoundRect(ctx, 84, 480, W - 168, festCardH, 42);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#b7f357";
      ctx.font = "700 24px 'JetBrains Mono', monospace";
      ctx.fillText("FESTS & BREAKS COMING IN", 128, 548);

      if (fests.length > 0) {
        fests.forEach((ev, idx) => {
          const ry = 602 + idx * 116;
          if (idx > 0) {
            ctx.fillStyle = "rgba(255,255,255,0.07)";
            ctx.fillRect(128, ry - 28, W - 256, 2);
          }
          ctx.fillStyle = "#ffffff";
          drawFittedText(ev.title, 128, ry + 32, W - 400, 32, 20, "600 Geist, sans-serif");
          ctx.textAlign = "right";
          ctx.fillStyle = pal.accent;
          ctx.font = "700 28px 'JetBrains Mono', monospace";
          ctx.fillText(ev.daysLeft === 0 ? "In 0d" : `In ${ev.daysLeft}d`, W - 128, ry + 32);
          ctx.textAlign = "left";
        });
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "500 28px Geist, sans-serif";
        ctx.fillText("No upcoming breaks left — sprint straight to exams.", 128, 622);
      }

      // Card 2: Incoming Examinations
      const examsY = 480 + festCardH + 44;
      const exams = snapshot.upcomingHorizon.exams.slice(0, 3);
      const examCardH = Math.max(210, 120 + Math.max(1, exams.length) * 116);
      ctx.fillStyle = pal.tintFill;
      ctx.strokeStyle = pal.tintBorder;
      ctx.lineWidth = 2;
      drawRoundRect(ctx, 84, examsY, W - 168, examCardH, 42);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#fda4af";
      ctx.font = "700 24px 'JetBrains Mono', monospace";
      ctx.fillText("INCOMING EXAMINATIONS", 128, examsY + 68);

      if (exams.length > 0) {
        exams.forEach((ev, idx) => {
          const ry = examsY + 122 + idx * 116;
          if (idx > 0) {
            ctx.fillStyle = "rgba(255,255,255,0.1)";
            ctx.fillRect(128, ry - 28, W - 256, 2);
          }
          ctx.fillStyle = "#ffffff";
          drawFittedText(ev.title, 128, ry + 32, W - 400, 32, 20, "600 Geist, sans-serif");
          ctx.textAlign = "right";
          ctx.fillStyle = "#fecdd3";
          ctx.font = "700 28px 'JetBrains Mono', monospace";
          ctx.fillText(ev.daysLeft === 0 ? "In 0d" : `In ${ev.daysLeft}d`, W - 128, ry + 32);
          ctx.textAlign = "left";
        });
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "500 28px Geist, sans-serif";
        ctx.fillText("No exam events scheduled yet on Calendar.", 128, examsY + 146);
      }

      ctx.fillStyle = "rgba(255,255,255,0.68)";
      ctx.font = "500 28px Geist, sans-serif";
      wrapTextLines(
        ctx,
        "Post-Last Teaching Day alerts automatically mute timetable reminders and switch strictly to exam briefings.",
        84,
        1535,
        W - 168,
        40,
        3,
      );
    } else if (activeIdx === 3 && snapshot.subjectsRanked.length > 0) {
      // SLIDE 3: TOP SUBJECTS — Featured #1 Hero Card + ALL Ranked Courses (#2..#N)
      const heroSub = snapshot.subjectsRanked[0];
      const restSubs = snapshot.subjectsRanked.slice(1);
      const isDense = restSubs.length > 5;

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 56px Geist, sans-serif";
      const s3End = wrapTextLines(ctx, "Subjects ranked by showing up.", 84, 248, W - 168, 68, 2);
      ctx.fillStyle = "rgba(255,255,255,0.68)";
      ctx.font = "500 27px Geist, sans-serif";
      wrapTextLines(ctx, copy.topSubjectCaption, 84, s3End + 6, W - 168, 38, 2);

      // Featured #1 Hero Box
      const heroY = 420;
      const heroH = isDense ? 190 : 216;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.lineWidth = 2;
      drawRoundRect(ctx, 84, heroY, W - 168, heroH, 38);
      ctx.fill();
      ctx.stroke();

      const badgeSize = isDense ? 124 : 140;
      const badgeY = heroY + Math.floor((heroH - badgeSize) / 2);
      ctx.fillStyle = posterTheme === "native" ? "#314209" : pal.c1;
      ctx.strokeStyle = "rgba(183,243,87,0.38)";
      ctx.lineWidth = 2;
      drawRoundRect(ctx, 120, badgeY, badgeSize, badgeSize, 30);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillStyle = pal.accent;
      drawFittedText(`${heroSub.pct}%`, 120 + badgeSize / 2, badgeY + badgeSize * 0.46, badgeSize - 18, 30, 20, "800 'JetBrains Mono', monospace", "center");
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      drawFittedText(`${heroSub.present}/${heroSub.total}`, 120 + badgeSize / 2, badgeY + badgeSize * 0.76, badgeSize - 18, 22, 16, "600 'JetBrains Mono', monospace", "center");
      ctx.textAlign = "left";

      const heroTextX = 120 + badgeSize + 34;
      ctx.fillStyle = pal.accent;
      drawFittedText(
        `RANK #1${heroSub.faculty ? ` · ${heroSub.faculty}` : ""}`,
        heroTextX,
        heroY + (isDense ? 58 : 68),
        W - heroTextX - 110,
        22,
        16,
        "700 'JetBrains Mono', monospace",
      );
      ctx.fillStyle = "#ffffff";
      drawFittedText(heroSub.name, heroTextX, heroY + (isDense ? 108 : 122), W - heroTextX - 110, isDense ? 34 : 38, 22, "800 Geist, sans-serif");
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      drawFittedText(
        `${heroSub.absent === 0 ? "0 misses all semester" : `${heroSub.absent} missed`} · ${heroSub.off} off`,
        heroTextX,
        heroY + (isDense ? 150 : 168),
        W - heroTextX - 110,
        24,
        18,
        "500 Geist, sans-serif",
      );

      // Rank #2..#N Rows dynamically scaled to fit all active subjects cleanly
      const listStartY = heroY + heroH + 34;
      const availableH = 1546 - listStartY;
      const rowStep = restSubs.length > 0 ? Math.min(156, Math.floor(availableH / restSubs.length)) : 140;
      const circleR = Math.max(24, Math.min(42, Math.floor(rowStep * 0.34)));

      restSubs.forEach((s, idx) => {
        const ry = listStartY + idx * rowStep;
        const midY = ry + Math.floor(rowStep * 0.5);
        if (idx > 0) {
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(84, ry, W - 168, 2);
        }
        ctx.fillStyle = "rgba(255,255,255,0.46)";
        ctx.font = `700 ${rowStep < 105 ? 23 : 26}px 'JetBrains Mono', monospace`;
        ctx.fillText(`#${s.rank}`, 88, midY + 9);

        const circleX = 186;
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.arc(circleX, midY, circleR, 0, Math.PI * 2);
        ctx.fill();
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = `700 ${rowStep < 105 ? 18 : 21}px 'JetBrains Mono', monospace`;
        ctx.fillText((s.code || s.name).replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase(), circleX, midY + 7);
        ctx.textAlign = "left";

        const rowTextX = circleX + circleR + 26;
        ctx.fillStyle = "#ffffff";
        drawFittedText(s.name, rowTextX, midY - (rowStep < 105 ? 4 : 6), W - rowTextX - 220, rowStep < 105 ? 27 : 32, 19, "700 Geist, sans-serif");
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        drawFittedText(
          `${s.present}/${s.total} classes${s.faculty ? ` · ${s.faculty}` : ""}`,
          rowTextX,
          midY + (rowStep < 105 ? 24 : 28),
          W - rowTextX - 220,
          rowStep < 105 ? 20 : 23,
          15,
          "500 'JetBrains Mono', monospace",
        );

        ctx.textAlign = "right";
        ctx.fillStyle = pal.accent;
        ctx.font = `800 ${rowStep < 105 ? 26 : 30}px 'JetBrains Mono', monospace`;
        ctx.fillText(`${s.pct}%`, W - 88, midY + 9);
        ctx.textAlign = "left";
      });

      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.font = "500 26px Geist, sans-serif";
      ctx.fillText(`All ${snapshot.subjectsRanked.length} active courses ranked this semester.`, 84, 1600);
    } else if (activeIdx === 4 && snapshot.months.length > 0) {
      // SLIDE 4: PROGRESSING MONTHLY TIMELINE — Line Chart + Month Chips + Active Month Remarks Card
      const monthsList = snapshot.months;
      const focusIdx = selectedMonthIdx >= 0 && selectedMonthIdx < monthsList.length ? selectedMonthIdx : monthsList.length - 1;
      const activeMonth = monthsList[focusIdx];

      ctx.fillStyle = pal.sub;
      ctx.font = "600 24px 'JetBrains Mono', monospace";
      ctx.fillText("PROGRESSING TIMELINE · MONTH BY MONTH", 84, 226);

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 52px Geist, sans-serif";
      wrapTextLines(ctx, copy.monthlyArcCaption, 84, 296, W - 360, 66, 2);

      // Top-right month step pill
      ctx.fillStyle = pal.tintFill;
      ctx.strokeStyle = pal.tintBorder;
      ctx.lineWidth = 2;
      drawRoundRect(ctx, W - 260, 232, 176, 62, 31);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillStyle = pal.sub;
      ctx.font = "700 24px 'JetBrains Mono', monospace";
      ctx.fillText(`${activeMonth.label} · ${focusIdx + 1}/${monthsList.length}`, W - 172, 272);
      ctx.textAlign = "left";

      // Chart Box
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      drawRoundRect(ctx, 84, 466, W - 168, 430, 40);
      ctx.fill();
      ctx.stroke();

      const minPct = Math.min(...monthsList.map((m) => m.pct), 60);
      const scaleFloor = Math.max(0, minPct - 10);
      const pts = monthsList.map((m, i) => {
        const px = monthsList.length === 1 ? W / 2 : 170 + (i / (monthsList.length - 1)) * (W - 340);
        const norm = (m.pct - scaleFloor) / Math.max(15, 100 - scaleFloor);
        const py = 768 - Math.min(1, Math.max(0, norm)) * 185;
        return { m, i, px, py };
      });

      // Full dim baseline polyline
      ctx.strokeStyle = "rgba(255,255,255,0.20)";
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py)));
      ctx.stroke();

      // Active bright progressive path up to focusIdx
      if (focusIdx > 0) {
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 7;
        ctx.beginPath();
        pts.slice(0, focusIdx + 1).forEach((p, i) => (i === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py)));
        ctx.stroke();
      }

      pts.forEach(({ m, i, px, py }) => {
        const isActive = i === focusIdx;
        const isVisited = i <= focusIdx;
        if (isActive) {
          ctx.fillStyle = pal.tintFill;
          ctx.strokeStyle = pal.accent;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(px, py, 28, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = isActive ? pal.accent : isVisited ? pal.sub : "#1c1410";
        ctx.strokeStyle = isVisited ? pal.accent : "rgba(255,255,255,0.35)";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(px, py, isActive ? 14 : 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.fillStyle = isActive ? "#ffffff" : isVisited ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)";
        ctx.font = `${isActive ? "800 28px" : "600 24px"} 'JetBrains Mono', monospace`;
        ctx.fillText(`${m.pct}%`, px, py - 32);

        ctx.fillStyle = isActive ? pal.accent : isVisited ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.45)";
        ctx.font = `${isActive ? "700" : "500"} 26px Geist, sans-serif`;
        ctx.fillText(m.label, px, 854);
        ctx.textAlign = "left";
      });

      // Month Chips Row
      const chipGap = 16;
      const chipW = Math.floor((W - 168 - chipGap * Math.max(0, monthsList.length - 1)) / Math.max(1, monthsList.length));
      monthsList.forEach((m, i) => {
        const cx = 84 + i * (chipW + chipGap);
        const isActive = i === focusIdx;
        const passed = i < focusIdx;
        ctx.fillStyle = isActive ? pal.accent : passed ? pal.tintFill : "rgba(0,0,0,0.28)";
        ctx.strokeStyle = isActive ? pal.accent : passed ? pal.tintBorder : "rgba(255,255,255,0.12)";
        ctx.lineWidth = 2;
        drawRoundRect(ctx, cx, 932, chipW, 74, 24);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.fillStyle = isActive ? "#111211" : passed ? pal.sub : "rgba(255,255,255,0.65)";
        ctx.font = "700 26px 'JetBrains Mono', monospace";
        ctx.fillText(m.label, cx + chipW / 2, 978);
        ctx.textAlign = "left";
      });

      // Active Month Breakdown & Remarks Card
      if (activeMonth) {
        ctx.fillStyle = "rgba(0,0,0,0.36)";
        ctx.strokeStyle = pal.tintBorder;
        ctx.lineWidth = 2.5;
        drawRoundRect(ctx, 84, 1044, W - 168, 430, 40);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        drawFittedText(
          `${activeMonth.key}${activeMonth.isPerfectMonth ? " ★ 100% Month" : ""}`,
          128,
          1120,
          W - 560,
          36,
          24,
          "800 Geist, sans-serif",
        );
        ctx.textAlign = "right";
        ctx.fillStyle = pal.accent;
        drawFittedText(
          `${activeMonth.present}p · ${activeMonth.absent}a · ${activeMonth.off} off`,
          W - 128,
          1120,
          340,
          28,
          20,
          "700 'JetBrains Mono', monospace",
          "right",
        );
        ctx.textAlign = "left";

        // Wrap month remark pills cleanly inside box
        let px = 128;
        let py = 1176;
        if (activeMonth.remarks.length > 0) {
          activeMonth.remarks.slice(0, 6).forEach((r) => {
            const label = `${r.text} ×${r.count}`;
            ctx.font = "600 24px 'JetBrains Mono', monospace";
            const pw = Math.min(W - 256, ctx.measureText(label).width + 44);
            if (px + pw > W - 128) {
              px = 128;
              py += 68;
            }
            if (py < 1410) {
              ctx.fillStyle = "rgba(255,255,255,0.1)";
              drawRoundRect(ctx, px, py, pw, 52, 26);
              ctx.fill();
              ctx.fillStyle = "#ffffff";
              ctx.fillText(fitCanvasText(ctx, label, pw - 36), px + 22, py + 34);
              px += pw + 14;
            }
          });
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.6)";
          ctx.font = "500 28px Geist, sans-serif";
          ctx.fillText("Clean attendance month — no remarks logged.", 128, 1216);
        }
      }
    } else if (activeIdx === 5) {
      // SLIDE 5: CALENDAR DOT SIGNATURE — Matches Screenshot 1 Exactly (3 Glowing Dot Rows + 2 Tiles + Bottom Line)!
      ctx.fillStyle = pal.sub;
      ctx.font = "600 26px 'JetBrains Mono', monospace";
      ctx.fillText("CALENDAR DOT SIGNATURE", 84, 240);

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 64px Geist, sans-serif";
      wrapTextLines(ctx, "Green streaks, purple mixed dots & free days.", 84, 326, W - 168, 78, 2);

      const dotRows = [
        {
          dotColor: "#34d399",
          borderColor: "rgba(52,211,153,0.34)",
          title: "100% Green Days & Streak",
          sub:
            snapshot.calendarPatterns.perfectMonths.length > 0
              ? `100% Months: ${snapshot.calendarPatterns.perfectMonths.join(", ")}`
              : `${snapshot.calendarPatterns.perfectDaysCount} full attendance days`,
          val: `${snapshot.calendarPatterns.bestGreenStreak.length}d`,
        },
        {
          dotColor: "#c084fc",
          borderColor: "rgba(192,132,252,0.40)",
          title: "Mixed Purple-Dot Days",
          sub: `Attended half the schedule, skipped the rest · streak of ${snapshot.calendarPatterns.bestMixedPurpleStreak.length}d`,
          val: `${snapshot.calendarPatterns.mixedPurpleDaysCount}`,
        },
        {
          dotColor: "#fbbf24",
          borderColor: "rgba(251,191,36,0.36)",
          title: "Full-Day Cancelled",
          sub:
            snapshot.calendarPatterns.fullCancelledDaysCount > 0
              ? "Maze hi maze — every single class off!"
              : "Not a single full-day cancellation yet.",
          val: `${snapshot.calendarPatterns.fullCancelledDaysCount}`,
        },
      ];

      dotRows.forEach((row, idx) => {
        const ry = 524 + idx * 196;
        ctx.fillStyle = "rgba(0,0,0,0.32)";
        ctx.strokeStyle = posterTheme === "native" ? row.borderColor : pal.tintBorder;
        ctx.lineWidth = 2.5;
        drawRoundRect(ctx, 84, ry, W - 168, 168, 38);
        ctx.fill();
        ctx.stroke();

        // Colored glowing dot
        ctx.fillStyle = posterTheme === "native" ? row.dotColor : pal.accent;
        ctx.beginPath();
        ctx.arc(140, ry + 84, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        drawFittedText(row.title, 186, ry + 68, W - 440, 34, 22, "800 Geist, sans-serif");
        ctx.fillStyle = "rgba(255,255,255,0.62)";
        drawFittedText(row.sub, 186, ry + 114, W - 440, 25, 18, "500 Geist, sans-serif");

        ctx.textAlign = "right";
        ctx.fillStyle = posterTheme === "native" ? row.dotColor : pal.accent;
        ctx.font = "800 50px 'JetBrains Mono', monospace";
        ctx.fillText(row.val, W - 128, ry + 100);
        ctx.textAlign = "left";
      });

      // Two side-by-side bottom cards (Unmarked Days | Extra Class)
      drawStatTile(
        84,
        1120,
        440,
        214,
        "UNMARKED DAYS",
        `${snapshot.unmarked?.daysCount ?? 0}d`,
        snapshot.unmarked?.daysCount ? `${snapshot.unmarked.slotsCount} unlogged slots` : "Clean 100% logging",
      );
      drawStatTile(
        556,
        1120,
        440,
        214,
        "EXTRA CLASS",
        snapshot.extraClasses?.missed ? `${snapshot.extraClasses.missed} Missed` : `${snapshot.extraClasses?.total ?? 0} Logged`,
        snapshot.extraClasses?.missed
          ? snapshot.extraClasses.missedSamples[0]?.subjectName || "Missed bonus slot"
          : "No extra class missed",
      );

      ctx.fillStyle = "rgba(255,255,255,0.74)";
      ctx.font = "500 29px Geist, sans-serif";
      wrapTextLines(ctx, copy.cancelledDayLine, 84, 1445, W - 168, 42, 3);
    } else if (activeIdx === 6) {
      // SLIDE 6: CLASS MISSING PATTERN — Weekday Progress Bars + BEST/PEAK MISS Badges + 2x2 Risk Grid
      const bestDay = [...snapshot.missingPatterns.weekdays].sort((a, b) => b.attendPct - a.attendPct)[0]?.day;
      const worstDay = [...snapshot.missingPatterns.weekdays].sort((a, b) => b.missPct - a.missPct)[0]?.day;

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 52px Geist, sans-serif";
      wrapTextLines(ctx, copy.missingPatternHeadline, 84, 268, W - 168, 66, 3);

      snapshot.missingPatterns.weekdays.slice(0, 5).forEach((w, idx) => {
        const y = 480 + idx * 108;
        const isBest = w.day === bestDay;
        const isPeakMiss = w.day === worstDay && w.missPct > 0;

        ctx.fillStyle = "#ffffff";
        ctx.font = "700 28px 'JetBrains Mono', monospace";
        ctx.fillText(w.day, 84, y + 32);

        if (isBest || isPeakMiss) {
          const tag = isBest ? "BEST" : "PEAK MISS";
          const tw = ctx.measureText(tag).width + 26;
          ctx.fillStyle = isBest ? "rgba(183,243,87,0.22)" : "rgba(251,191,36,0.22)";
          drawRoundRect(ctx, 168, y + 4, tw, 36, 10);
          ctx.fill();
          ctx.fillStyle = isBest ? pal.accent : "#fde68a";
          ctx.font = "700 20px 'JetBrains Mono', monospace";
          ctx.fillText(tag, 181, y + 29);
        }

        ctx.textAlign = "right";
        ctx.fillStyle = "#ffffff";
        ctx.font = "600 26px 'JetBrains Mono', monospace";
        ctx.fillText(`${w.attendPct}% (${w.missPct}% miss)`, W - 84, y + 32);
        ctx.textAlign = "left";

        ctx.fillStyle = "rgba(0,0,0,0.35)";
        drawRoundRect(ctx, 84, y + 50, W - 168, 22, 11);
        ctx.fill();
        ctx.fillStyle = isPeakMiss && !isBest ? "#fbbf24" : pal.accent;
        drawRoundRect(ctx, 84, y + 50, Math.max(40, ((W - 168) * w.attendPct) / 100), 22, 11);
        ctx.fill();
      });

      // Highest-Risk Time Slots Card
      const slots = snapshot.missingPatterns.timeSlots.slice(0, 4);
      if (slots.length > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.32)";
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 2;
        drawRoundRect(ctx, 84, 1060, W - 168, 370, 40);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.font = "700 24px 'JetBrains Mono', monospace";
        ctx.fillText("HIGHEST-RISK TIME SLOTS", 124, 1126);

        slots.forEach((t, i) => {
          const sx = 124 + (i % 2) * 424;
          const sy = 1164 + Math.floor(i / 2) * 116;
          ctx.fillStyle = "rgba(255,255,255,0.07)";
          drawRoundRect(ctx, sx, sy, 404, 94, 24);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          drawFittedText(t.slot, sx + 24, sy + 57, 210, 28, 20, "700 'JetBrains Mono', monospace");
          ctx.textAlign = "right";
          ctx.fillStyle = "#fcd34d";
          ctx.font = "800 26px 'JetBrains Mono', monospace";
          ctx.fillText(`${t.missPct}% miss`, sx + 380, sy + 57);
          ctx.textAlign = "left";
        });
      }
    } else if (activeIdx === 7) {
      // SLIDE 7: REMARKS ARCHIVE — Full Remark Deck + Active Roast Box
      const allRemarks = snapshot.remarksTape;
      const displayRemarks = allRemarks.slice(0, 12);
      const focusedRem =
        selectedRemark ||
        displayRemarks[0]?.text ||
        "Logged with clean discipline";
      const focusPos = Math.max(
        0,
        allRemarks.findIndex((r) => r.text === focusedRem),
      );
      const quip = copy?.remarkQuips?.[focusedRem] || buildLocalRemarkQuip(focusedRem, snapshot.totals.percentage);

      ctx.fillStyle = pal.sub;
      ctx.font = "600 24px 'JetBrains Mono', monospace";
      ctx.fillText("REMARKS ARCHIVE", 84, 226);

      ctx.fillStyle = "#ffffff";
      drawFittedText("Every excuse you logged, roasted.", 84, 304, W - 320, 52, 34, "800 Geist, sans-serif");

      if (allRemarks.length > 0) {
        ctx.fillStyle = pal.tintFill;
        ctx.strokeStyle = pal.tintBorder;
        ctx.lineWidth = 2;
        drawRoundRect(ctx, W - 224, 204, 140, 54, 27);
        ctx.fill();
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillStyle = pal.accent;
        ctx.font = "700 24px 'JetBrains Mono', monospace";
        ctx.fillText(`${String(focusPos + 1).padStart(2, "0")} / ${String(allRemarks.length).padStart(2, "0")}`, W - 154, 240);
        ctx.textAlign = "left";
      }

      const listTopY = 368;
      const maxListH = 850;
      const rowStep = displayRemarks.length > 0 ? Math.min(104, Math.floor(maxListH / displayRemarks.length)) : 96;
      const rowH = Math.max(52, rowStep - 12);

      if (displayRemarks.length > 0) {
        displayRemarks.forEach((r, i) => {
          const ry = listTopY + i * rowStep;
          const midY = ry + Math.floor(rowH * 0.58);
          const isActive = r.text === focusedRem;
          ctx.fillStyle = isActive ? pal.tintFill : "rgba(0,0,0,0.30)";
          ctx.strokeStyle = isActive ? pal.accent : "rgba(255,255,255,0.12)";
          ctx.lineWidth = isActive ? 3 : 2;
          drawRoundRect(ctx, 84, ry, W - 168, rowH, Math.min(26, Math.floor(rowH / 2)));
          ctx.fill();
          ctx.stroke();

          const fontPx = rowH < 72 ? 21 : 25;
          ctx.fillStyle = isActive ? pal.accent : "rgba(255,255,255,0.5)";
          ctx.font = `700 ${fontPx - 2}px 'JetBrains Mono', monospace`;
          ctx.fillText(String(i + 1).padStart(2, "0"), 118, midY);

          ctx.fillStyle = "#ffffff";
          drawFittedText(`"${r.text}"`, 176, midY, W - 460, fontPx + 2, 18, "600 'JetBrains Mono', monospace");

          const pillH = Math.min(48, rowH - 16);
          const pillY = ry + Math.floor((rowH - pillH) / 2);
          ctx.fillStyle = isActive ? pal.accent : "rgba(255,255,255,0.14)";
          drawRoundRect(ctx, W - 200, pillY, 88, pillH, Math.floor(pillH / 2));
          ctx.fill();
          ctx.textAlign = "center";
          ctx.fillStyle = isActive ? "#111211" : "#ffffff";
          ctx.font = `800 ${fontPx - 2}px 'JetBrains Mono', monospace`;
          ctx.fillText(`${r.count}×`, W - 156, midY);
          ctx.textAlign = "left";
        });
      }

      // Active Roast Box at bottom
      const roastY = Math.max(460, listTopY + displayRemarks.length * rowStep + 22);
      ctx.fillStyle = "rgba(0,0,0,0.46)";
      ctx.strokeStyle = pal.tintBorder;
      ctx.lineWidth = 2.5;
      drawRoundRect(ctx, 84, roastY, W - 168, Math.min(360, 1620 - roastY), 38);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = pal.accent;
      drawFittedText(`ROASTING: "${focusedRem}"`, 124, roastY + 56, W - 460, 22, 16, "700 'JetBrains Mono', monospace");
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      drawFittedText(
        allRemarks[focusPos]?.sampleDate || "Semester Log",
        W - 124,
        roastY + 56,
        220,
        22,
        16,
        "600 'JetBrains Mono', monospace",
        "right",
      );
      ctx.textAlign = "left";

      ctx.fillStyle = "#ffffff";
      ctx.font = "500 31px Geist, sans-serif";
      wrapTextLines(ctx, quip, 124, roastY + 112, W - 248, 44, 4);
    } else if (activeIdx === 8) {
      // SLIDE 8: PERSONA FINALE POSTER — Exact Screen Card Layout (Badge + Title + Avatar Top-Right + Frosted Summary Card)
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      drawFittedText(copy.archetypeBadge.toUpperCase(), 84, 240, W - 320, 24, 17, "600 'JetBrains Mono', monospace");

      ctx.fillStyle = "#ffffff";
      drawFittedText(copy.archetypeTitle, 84, 314, W - 310, 56, 34, "800 Geist, sans-serif");

      drawAvatar(W - 148, 282, 62, "rgba(255,255,255,0.32)");

      // Center Persona Poster Glass Card (Matches Screen Screenshot 3 cleanly!)
      ctx.fillStyle = "rgba(0,0,0,0.42)";
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 2.5;
      drawRoundRect(ctx, 84, 460, W - 168, 920, 56);
      ctx.fill();
      ctx.stroke();

      // Top 2 Metrics Row
      ctx.fillStyle = "rgba(255,255,255,0.58)";
      ctx.font = "600 22px 'JetBrains Mono', monospace";
      ctx.fillText("SO FAR", 136, 548);
      ctx.fillText("REMAINING", 548, 548);

      ctx.fillStyle = pal.accent;
      ctx.font = "800 84px 'JetBrains Mono', monospace";
      ctx.fillText(`${snapshot.totals.percentage}%`, 132, 646);

      ctx.fillStyle = "#ffffff";
      ctx.fillText(`${snapshot.forecast.remainingClasses}`, 544, 646);

      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "500 26px 'JetBrains Mono', monospace";
      ctx.fillText(`${snapshot.totals.present}/${snapshot.totals.conducted} classes`, 136, 696);
      ctx.fillText(`${snapshot.forecast.maxSafeBunksAcrossRemaining} safe bunks`, 548, 696);

      // Divider 1
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(136, 744, W - 272, 2);

      // Italic Instrument Serif Quote
      ctx.fillStyle = "#ffffff";
      ctx.font = "italic 46px 'Instrument Serif', Georgia, serif";
      wrapTextLines(ctx, `"${copy.oneLiner}"`, 136, 854, W - 272, 64, 4);

      // Divider 2
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(136, 1184, W - 272, 2);

      // Footer inside Persona Card: AttendX left + cleanly wrapped finaleLine right (ZERO collision!)
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 38px Geist, sans-serif";
      ctx.fillText("AttendX", 136, 1266);

      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.font = "500 24px 'JetBrains Mono', monospace";
      wrapTextLines(ctx, copy.finaleLine, 360, 1258, W - 496, 34, 2);
    } else {
      // OVERALL WRAP SUMMARY POSTER (posterMode === "summary" or activeIdx === -1)
      drawAvatar(176, 300, 88, pal.accent);

      ctx.fillStyle = "#ffffff";
      drawFittedText(snapshot.user.name || "Student", 300, 290, W - 384, 52, 32, "700 Geist, -apple-system, sans-serif");
      ctx.fillStyle = pal.accent;
      drawFittedText(copy.archetypeTitle, 300, 346, W - 384, 30, 20, "600 'JetBrains Mono', monospace");

      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "600 28px 'JetBrains Mono', monospace";
      ctx.fillText(
        snapshot.semester.isPastTeachingDay ? "FINAL ATTENDANCE RECORD" : "OVERALL SEMESTER WRAP",
        84,
        490,
      );

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 174px Geist, -apple-system, sans-serif";
      ctx.fillText(`${snapshot.totals.percentage}%`, 78, 668);

      ctx.fillStyle = pal.sub;
      drawFittedText(
        `${snapshot.totals.present} of ${snapshot.totals.conducted} conducted · ${snapshot.forecast.remainingClasses} left`,
        84,
        736,
        W - 168,
        34,
        22,
        "500 Geist, sans-serif",
      );

      const worstSlot = snapshot.missingPatterns.timeSlots[0];
      const topMonth = [...snapshot.months].sort((a, b) => b.pct - a.pct)[0];
      const perfectSub = snapshot.subjectsRanked.find((s) => s.pct === 100);
      const summaryTiles = [
        { k: "BEST MONTH", v: topMonth ? `${topMonth.label} ${topMonth.pct}%` : "Tracked" },
        { k: "TOP SUBJECT", v: perfectSub ? `100% ${perfectSub.name}` : snapshot.subjectsRanked[0]?.name || "Active" },
        { k: "BEST STREAK", v: `${snapshot.calendarPatterns.bestGreenStreak.length} days 100%` },
        {
          k: snapshot.extraClasses?.missed ? "EXTRA MISSED" : "PEAK MISS",
          v: snapshot.extraClasses?.missed
            ? `${snapshot.extraClasses.missed} (${snapshot.extraClasses.missedSamples[0]?.subjectName || "Extra"})`
            : worstSlot
              ? worstSlot.slot
              : "Locked in",
        },
      ];
      summaryTiles.forEach((t, i) => {
        const bx = 84 + (i % 2) * 468;
        const by = 824 + Math.floor(i / 2) * 232;
        drawStatTile(bx, by, 444, 204, t.k, t.v);
      });

      ctx.fillStyle = "rgba(0,0,0,0.34)";
      drawRoundRect(ctx, 84, 1344, W - 168, 250, 42);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "italic 42px 'Instrument Serif', Georgia, serif";
      wrapTextLines(ctx, `"${copy.oneLiner}"`, 132, 1424, W - 264, 54, 3);
    }

    // 4. Discreet Bottom Identity Stamp across all shared cards
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(84, 1732, W - 168, 2);

    if (activeIdx >= 0) {
      drawAvatar(112, 1796, 26, pal.accent);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      drawFittedText(
        `${snapshot.user.name} · ${copy.archetypeTitle}`,
        156,
        1806,
        W - 420,
        24,
        18,
        "600 Geist, sans-serif",
      );
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.52)";
      ctx.font = "600 24px 'JetBrains Mono', monospace";
      const posStr = String(storyPosition || activeIdx + 1).padStart(2, "0");
      const totStr = String(totalSlides || 9).padStart(2, "0");
      ctx.fillText(`${posStr}/${totStr} · attendx`, W - 84, 1806);
      ctx.textAlign = "left";
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.52)";
      drawFittedText(
        `UNMARKED ${snapshot.unmarked?.daysCount ?? 0}D · EXTRA MISSED ${snapshot.extraClasses?.missed ?? 0}`,
        84,
        1806,
        W - 420,
        24,
        18,
        "600 'JetBrains Mono', monospace",
      );
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 38px Geist, sans-serif";
      ctx.fillText("AttendX", W - 84, 1808);
      ctx.textAlign = "left";
    }
  }, [isOpen, posterTheme, posterMode, slideIndex, storyPosition, totalSlides, selectedRemark, selectedMonthIdx, snapshot, copy, renderTick]);

  const exportPngBase64 = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    try {
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  };

  const handleSave = async () => {
    const dataUrl = exportPngBase64();
    if (!dataUrl) {
      toast.error("Unable to render poster image.");
      return;
    }
    const safeName = `AttendX_${snapshot.semester.name.replace(/[^a-z0-9]/gi, "_")}_${posterMode === "card" && slideIndex >= 0 ? `Card${slideIndex + 1}` : "Wrap"}.png`;
    if (Capacitor.isNativePlatform()) {
      try {
        const base64 = dataUrl.split(",")[1];
        const saved = await Filesystem.writeFile({
          path: safeName,
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: `My ${snapshot.semester.name} AttendX Replay`,
          text: `${copy.archetypeTitle} — ${snapshot.totals.percentage}% on AttendX`,
          url: saved.uri,
        });
        setStatusLabel("Card ready to share");
      } catch (err: any) {
        const msg = String(err?.message || "").toLowerCase();
        if (!msg.includes("cancel") && !msg.includes("dismiss")) {
          toast.error("Could not open share dialog");
        }
      }
      return;
    }

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = safeName;
    link.click();
    setStatusLabel("PNG downloaded");
    toast.success("Share card downloaded");
  };

  const handleShare = async () => {
    const dataUrl = exportPngBase64();
    if (!dataUrl) return;
    const shareText = `${snapshot.semester.name} Replay: ${snapshot.totals.percentage}% attended — ${copy.oneLiner}`;

    if (Capacitor.isNativePlatform()) {
      try {
        const base64 = dataUrl.split(",")[1];
        const saved = await Filesystem.writeFile({
          path: `AttendX_Share_${Date.now()}.png`,
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: `${snapshot.semester.name} AttendX Wrap`,
          text: shareText,
          url: saved.uri,
        });
      } catch (err: any) {
        const msg = String(err?.message || "").toLowerCase();
        if (!msg.includes("cancel") && !msg.includes("dismiss")) {
          toast.error("Share failed");
        }
      }
      return;
    }

    if (navigator.share) {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "attendx-wrap.png", { type: "image/png" });
        await navigator.share({
          title: `${snapshot.semester.name} AttendX Wrap`,
          text: shareText,
          files: [file],
        });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Summary copied to clipboard");
    } catch {
      handleSave();
    }
  };

  if (!isOpen) return null;

  const activeCardLabel =
    posterMode === "card" && slideIndex >= 0
      ? SLIDE_NAMES[slideIndex] || "Current Card"
      : "Full Semester Summary";

  return createPortal(
    <div
      className="fixed inset-0 z-[10060] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="preserve-dark w-full sm:max-w-md bg-[#181918] text-white border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5 shadow-2xl">
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto sm:hidden" />

        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-bold tracking-tight truncate">Share {activeCardLabel}</h3>
            <p className="text-[11px] text-white/55 truncate">
              Generated privately on your device with AttendX mark
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close share sheet"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {slideIndex >= 0 && (
          <div className="grid grid-cols-2 gap-1.5 bg-white/[0.06] p-1 rounded-xl text-[11px]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPosterMode("card");
                if (slideIndex >= 0) setPosterTheme("native");
              }}
              className={`py-1.5 rounded-lg font-semibold cursor-pointer transition ${
                posterMode === "card"
                  ? "bg-white text-black shadow-sm"
                  : "text-white/70 hover:text-white"
              }`}
            >
              This Card Only
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPosterMode("summary");
                setPosterTheme((prev) => (prev === "native" ? "obsidian" : prev));
              }}
              className={`py-1.5 rounded-lg font-semibold cursor-pointer transition ${
                posterMode === "summary"
                  ? "bg-white text-black shadow-sm"
                  : "text-white/70 hover:text-white"
              }`}
            >
              Overall Wrap
            </button>
          </div>
        )}

        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={1080}
            height={1920}
            className="w-[186px] h-[330px] rounded-2xl border border-white/15 shadow-2xl"
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          {(posterMode === "card" && slideIndex >= 0
            ? (["native", "obsidian", "moss", "burgundy"] as PosterTheme[])
            : (["obsidian", "moss", "burgundy"] as PosterTheme[])
          ).map((t) => (
            <button
              type="button"
              key={t}
              onClick={(e) => {
                e.stopPropagation();
                setPosterTheme(t);
              }}
              className={`px-3 py-1 rounded-full border cursor-pointer transition ${
                posterTheme === t
                  ? "bg-white text-black border-white font-semibold"
                  : "bg-white/10 text-white/75 border-white/15 hover:bg-white/15"
              }`}
            >
              {t === "native" ? "Card Theme" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSave();
            }}
            className="py-3 px-4 rounded-2xl bg-white text-black font-bold text-xs flex items-center justify-center gap-2 cursor-pointer hover:bg-white/90 transition"
          >
            <Download className="w-4 h-4" /> Save Card
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleShare();
            }}
            className="py-3 px-4 rounded-2xl bg-white/12 border border-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer hover:bg-white/20 transition"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>

        {statusLabel && (
          <p className="text-center text-xs text-[#b7f357] flex items-center justify-center gap-1">
            <Check className="w-3.5 h-3.5" /> {statusLabel}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
};
