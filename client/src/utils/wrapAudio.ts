import { Capacitor } from "@capacitor/core";

const CDN_MEDIA_ORIGIN = Capacitor.isNativePlatform() ? "https://www.attendx.tech" : "";
const REPLAY_AUDIO_URL = `${CDN_MEDIA_ORIGIN}/audio/the_year_in_vivid_color.mp3`;
const AUDIO_CACHE_NAME = "attendx-replay-audio-v1";
const TARGET_VOLUME = 0.76;

class ReplayAudioEngine {
  private audioEl: HTMLAudioElement | null = null;
  private cachedBlobUrl: string | null = null;
  private cachingStarted = false;
  private sfxCtx: AudioContext | null = null;
  private fadeTimer: number | null = null;
  private muted = false;
  private playing = false;
  private unlockAttached = false;

  private clearFade() {
    if (this.fadeTimer !== null && typeof window !== "undefined") {
      window.clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  private warmCacheInBackground() {
    if (this.cachingStarted || typeof window === "undefined" || !("caches" in window)) return;
    this.cachingStarted = true;
    (async () => {
      try {
        const cache = await window.caches.open(AUDIO_CACHE_NAME);
        let resp = await cache.match(REPLAY_AUDIO_URL);
        if (!resp) {
          const net = await fetch(REPLAY_AUDIO_URL, { mode: "cors" });
          if (net.ok) {
            await cache.put(REPLAY_AUDIO_URL, net.clone());
            resp = net;
          }
        }
        if (resp) {
          const blob = await resp.blob();
          if (blob.size > 0) {
            this.cachedBlobUrl = URL.createObjectURL(blob);
          }
        }
      } catch {
        // Streaming directly via HTMLAudioElement continues unaffected
      }
    })();
  }

  private ensureAudioElement(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (!this.audioEl) {
      const el = new Audio(this.cachedBlobUrl || REPLAY_AUDIO_URL);
      el.loop = true;
      el.preload = "auto";
      el.volume = TARGET_VOLUME;
      (el as any).playsInline = true;
      this.audioEl = el;
      this.warmCacheInBackground();
    }
    return this.audioEl;
  }

  private attachUnlockRetry() {
    if (this.unlockAttached || typeof window === "undefined") return;
    this.unlockAttached = true;
    const retry = () => {
      if (!this.playing || this.muted || !this.audioEl) {
        cleanup();
        return;
      }
      this.audioEl
        .play()
        .then(() => {
          this.fadeInAudio(this.audioEl!);
          cleanup();
        })
        .catch(() => {});
    };
    const cleanup = () => {
      this.unlockAttached = false;
      window.removeEventListener("pointerdown", retry, true);
      window.removeEventListener("touchstart", retry, true);
      window.removeEventListener("keydown", retry, true);
    };
    window.addEventListener("pointerdown", retry, true);
    window.addEventListener("touchstart", retry, true);
    window.addEventListener("keydown", retry, true);
  }

  private fadeInAudio(el: HTMLAudioElement) {
    this.clearFade();
    el.volume = Math.max(0.12, Math.min(TARGET_VOLUME, el.volume || 0.12));
    let step = 0;
    const steps = 10;
    const startVol = el.volume;
    this.fadeTimer = window.setInterval(() => {
      step++;
      if (!this.playing || this.muted) {
        this.clearFade();
        return;
      }
      el.volume = Math.min(TARGET_VOLUME, startVol + ((TARGET_VOLUME - startVol) * step) / steps);
      if (step >= steps) {
        this.clearFade();
      }
    }, 35);
  }

  /**
   * Starts playing `the_year_in_vivid_color` if not already playing.
   * Never restarts from 0:00 if already actively playing on the Replay page!
   */
  start() {
    const el = this.ensureAudioElement();
    if (!el) return;
    this.playing = true;
    if (this.muted) return;
    el.muted = false;
    el.loop = true;

    if (el.paused) {
      el.volume = 0.12;
      el.play()
        .then(() => {
          this.fadeInAudio(el);
        })
        .catch(() => {
          this.attachUnlockRetry();
        });
    } else {
      el.volume = TARGET_VOLUME;
    }
  }

  /**
   * Stops and resets playback strictly when leaving / pressing back off the Replay page.
   */
  stop() {
    this.playing = false;
    this.clearFade();
    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
      } catch {}
    }
  }

  pause() {
    this.clearFade();
    if (this.audioEl) {
      try {
        this.audioEl.pause();
      } catch {}
    }
  }

  isPlaying(): boolean {
    return Boolean(this.playing && !this.muted && this.audioEl && !this.audioEl.paused);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    const el = this.ensureAudioElement();
    if (el) {
      if (this.muted) {
        this.clearFade();
        el.muted = true;
        try {
          el.pause();
        } catch {}
      } else {
        this.playing = true;
        el.muted = false;
        el.play()
          .then(() => {
            this.fadeInAudio(el);
          })
          .catch(() => {
            this.attachUnlockRetry();
          });
      }
    }
    return !this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Subtle harmonic shimmer on interactive card switches */
  playCardSweep(slideIndex = 0) {
    if (this.muted || typeof window === "undefined") return;
    try {
      if (!this.sfxCtx) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        this.sfxCtx = new AC();
      }
      const ctx = this.sfxCtx;
      const fire = () => {
        if (!this.sfxCtx || this.muted || this.sfxCtx.state === "suspended") return;
        try {
          const scale = [392.0, 440.0, 523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 523.25];
          const base = scale[Math.abs(slideIndex) % scale.length];
          const now = this.sfxCtx.currentTime;
          const osc = this.sfxCtx.createOscillator();
          const gain = this.sfxCtx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(base, now);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.03, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
          osc.connect(gain);
          gain.connect(this.sfxCtx.destination);
          osc.start(now);
          osc.stop(now + 0.3);
        } catch {}
      };
      if (ctx.state === "suspended") {
        ctx.resume().then(fire).catch(() => {});
      } else {
        fire();
      }
    } catch {}
  }
}

export const wrapAudio = new ReplayAudioEngine();
