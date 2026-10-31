import { NativeVoiceService } from "../services/NativeVoiceService";

/**
 * AttendX Micro-Physics Sound Effects Engine (Synchronized 4.0s – 5.0s Suite)
 * Pure Web Audio API synthesizers — zero external asset dependencies, 0ms latency,
 * perfectly synchronized with visual motion, parabolic flight paths, and UI transitions
 * across desktop web and mobile Android WebViews.
 */

class SoundEffectsEngine {
  private ctx: AudioContext | null = null;
  private keepAliveOsc: OscillatorNode | null = null;
  private keepAliveGain: GainNode | null = null;
  private lastMajorSoundTime = 0;

  constructor() {
    if (typeof window !== "undefined") {
      const warmUpHandler = () => {
        this.warmUp();
      };
      ["pointerdown", "touchstart", "mousedown", "keydown", "scroll", "focus"].forEach((evt) => {
        window.addEventListener(evt, warmUpHandler, { passive: true, capture: true });
      });
    }
  }

  /**
   * Animation sounds are OFF by default.
   * Returns true only when explicitly enabled by user preference.
   */
  isEnabled(): boolean {
    try {
      if (typeof window === "undefined" || !window.localStorage) return false;
      return localStorage.getItem("attendx_sound_effects_enabled") === "true";
    } catch {
      return false;
    }
  }

  /**
   * Sets the animation sounds preference, dispatches update event,
   * and cleanly manages the underlying AudioContext.
   */
  setEnabled(enabled: boolean): void {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      localStorage.setItem("attendx_sound_effects_enabled", enabled ? "true" : "false");
      localStorage.setItem("onboarding_sound_effects", "true");
      localStorage.setItem("attendx_sound_effects_configured", "true");

      if (!enabled && this.ctx) {
        try {
          if (this.keepAliveOsc) {
            try { this.keepAliveOsc.stop(); } catch {}
            this.keepAliveOsc = null;
          }
          this.ctx.suspend().catch(() => {});
        } catch {}
      } else if (enabled) {
        this.warmUp();
      }

      window.dispatchEvent(
        new CustomEvent("sound-effects-toggled", { detail: { enabled } })
      );
    } catch {}
  }

  private ensureKeepAlive(): void {
    if (!this.ctx || this.keepAliveOsc || !this.isEnabled() || this.isVoiceModeActive()) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      // Continuous inaudible sub-audible dither signal (2Hz at 0.00002 / -94dBFS).
      // This mathematically guarantees Chromium / Android AAudio silence detectors NEVER trigger,
      // preventing the hardware audio pipe from entering power-save sleep when idle.
      gain.gain.setValueAtTime(0.00002, this.ctx.currentTime);
      osc.frequency.setValueAtTime(2, this.ctx.currentTime); // 2Hz infrasonic wave
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      this.keepAliveOsc = osc;
      this.keepAliveGain = gain;
    } catch {}
  }

  /**
   * Pre-warms the AudioContext on user interaction (pointerdown / touchstart / click)
   * to eliminate any hardware audio engine spin-up latency (guaranteeing exact 0ms sync).
   */
  warmUp(): void {
    if (!this.isEnabled() || this.isVoiceModeActive()) return;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state !== "running") {
        this.ctx.resume().catch(() => {});
      }
      this.ensureKeepAlive();
    } catch {}
  }

  /**
   * Guard condition: Ensures animation sounds NEVER play if AI voice mode
   * or hands-free speech recognition is active.
   * Completely prevents audio bleed into the microphone, TTS ducking, or voice interference.
   */
  isVoiceModeActive(): boolean {
    try {
      if (typeof window !== "undefined") {
        if ((window as any).__attendx_voice_mode_active) return true;
        if ((window as any).__attendx_ai_speaking) return true;
        if ((window as any).__attendx_ai_listening) return true;
      }
      if (typeof NativeVoiceService !== "undefined" && typeof NativeVoiceService.isVoiceModeActive === "function") {
        if (NativeVoiceService.isVoiceModeActive()) return true;
      }
    } catch {
      // Fallback safe
    }
    return false;
  }

  private getContext(): AudioContext | null {
    // 1. Silent by default; only synthesize if explicitly enabled
    if (!this.isEnabled()) return null;

    // 2. Foolproof guard: Strictly mute if Voice Mode / hands-free / AI speech is active
    if (this.isVoiceModeActive()) return null;

    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state !== "running") {
        this.ctx.resume().catch(() => {});
      }
      this.ensureKeepAlive();
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Aeroplane Flight (Synchronized with 4.2s Flight Animation in AssignmentsPage):
   * • 0.0s – 0.8s: Paper dart folding & lift-off preparation whoosh.
   * • 0.8s – 3.2s: High-altitude soaring wind rush & twin-frequency harmonic glider whistle.
   * • 3.2s – 4.2s: Gentle touchdown bell chime and soft settling flutter.
   */
  playPaperAirplaneSound() {
    if (!this.isEnabled() || this.isVoiceModeActive()) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Initial paper folding rustle (0.0s – 0.8s)
    const foldLen = Math.floor(ctx.sampleRate * 0.75);
    const foldBuffer = ctx.createBuffer(1, foldLen, ctx.sampleRate);
    const foldData = foldBuffer.getChannelData(0);
    for (let i = 0; i < foldLen; i++) {
      foldData[i] = (Math.random() * 2 - 1) * Math.sin((i / foldLen) * Math.PI) * 0.4;
    }
    const foldSource = ctx.createBufferSource();
    foldSource.buffer = foldBuffer;
    const foldFilter = ctx.createBiquadFilter();
    foldFilter.type = "bandpass";
    foldFilter.frequency.setValueAtTime(450, now);
    foldFilter.frequency.exponentialRampToValueAtTime(1250, now + 0.65);
    foldFilter.Q.setValueAtTime(3.0, now);
    const foldGain = ctx.createGain();
    foldGain.gain.setValueAtTime(0.01, now);
    foldGain.gain.linearRampToValueAtTime(0.16, now + 0.35);
    foldGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    foldSource.connect(foldFilter);
    foldFilter.connect(foldGain);
    foldGain.connect(ctx.destination);
    foldSource.start(now);

    // 2. Continuous high-altitude aerodynamic wind rush (0.8s – 3.2s)
    const airLen = Math.floor(ctx.sampleRate * 2.5);
    const airBuffer = ctx.createBuffer(1, airLen, ctx.sampleRate);
    const airData = airBuffer.getChannelData(0);
    for (let i = 0; i < airLen; i++) {
      airData[i] = (Math.random() * 2 - 1) * Math.sin((i / airLen) * Math.PI);
    }
    const airSource = ctx.createBufferSource();
    airSource.buffer = airBuffer;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = "bandpass";
    airFilter.frequency.setValueAtTime(750, now + 0.7);
    airFilter.frequency.exponentialRampToValueAtTime(2200, now + 1.9); // Peak soaring height
    airFilter.frequency.exponentialRampToValueAtTime(850, now + 3.1);
    airFilter.Q.setValueAtTime(2.2, now + 0.7);
    const airGain = ctx.createGain();
    airGain.gain.setValueAtTime(0.001, now + 0.7);
    airGain.gain.linearRampToValueAtTime(0.18, now + 1.9);
    airGain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);
    airSource.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(ctx.destination);
    airSource.start(now + 0.7);

    // 3. Glider Harmonic Whistle (twin-sine E5 = 659.25Hz, B5 = 987.77Hz soaring from 1.0s to 3.2s)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gliderGain = ctx.createGain();
    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now + 0.9);
    osc1.frequency.exponentialRampToValueAtTime(880.0, now + 2.0);
    osc1.frequency.exponentialRampToValueAtTime(740.0, now + 3.1);
    osc2.frequency.setValueAtTime(987.77, now + 0.9);
    osc2.frequency.exponentialRampToValueAtTime(1318.5, now + 2.0);
    osc2.frequency.exponentialRampToValueAtTime(1108.7, now + 3.1);

    gliderGain.gain.setValueAtTime(0.001, now + 0.9);
    gliderGain.gain.linearRampToValueAtTime(0.09, now + 1.9);
    gliderGain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);
    osc1.connect(gliderGain);
    osc2.connect(gliderGain);
    gliderGain.connect(ctx.destination);
    osc1.start(now + 0.9);
    osc2.start(now + 0.9);
    osc1.stop(now + 3.25);
    osc2.stop(now + 3.25);

    // 4. Soft touchdown settling bell (3.2s – 4.2s)
    const landOsc = ctx.createOscillator();
    const landGain = ctx.createGain();
    landOsc.type = "sine";
    landOsc.frequency.setValueAtTime(1318.5, now + 3.2); // E6
    landOsc.frequency.exponentialRampToValueAtTime(659.25, now + 4.15);
    landGain.gain.setValueAtTime(0.12, now + 3.2);
    landGain.gain.exponentialRampToValueAtTime(0.0005, now + 4.2);
    landOsc.connect(landGain);
    landGain.connect(ctx.destination);
    landOsc.start(now + 3.2);
    landOsc.stop(now + 4.22);
  }

  /**
   * Origami Paper Crumble (Synchronized with 4.0s Crumple Animation in TimetableSlot):
   * • 0.0s – 0.6s: Crisp diagonal origami crease snap & initial paper fold rustle at 0ms.
   * • 0.6s – 2.8s: Multi-phase paper scrunching, fiber crinkling, and progressive compression bursts.
   * • 2.8s – 4.0s: Final tight paper ball compression click and soft rolling drop thud.
   */
  playPaperCrumpleSound() {
    if (!this.isEnabled() || this.isVoiceModeActive()) return;
    this.lastMajorSoundTime = Date.now();
    const ctx = this.getContext();
    if (!ctx) return;

    const execute = () => {
      const now = ctx.currentTime;

      // 1. Initial Crease Snap & Paper Fold Rustle (0.0s – 0.6s)
      const creaseOsc = ctx.createOscillator();
      const creaseGain = ctx.createGain();
      creaseOsc.type = "triangle";
      creaseOsc.frequency.setValueAtTime(540, now);
      creaseOsc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
      creaseGain.gain.setValueAtTime(0.22, now);
      creaseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      creaseOsc.connect(creaseGain);
      creaseGain.connect(ctx.destination);
      creaseOsc.start(now);
      creaseOsc.stop(now + 0.25);

      // Fold noise burst
      const rustleLen = Math.floor(ctx.sampleRate * 0.55);
      const rustleBuf = ctx.createBuffer(1, rustleLen, ctx.sampleRate);
      const rData = rustleBuf.getChannelData(0);
      for (let i = 0; i < rustleLen; i++) {
        rData[i] = (Math.random() * 2 - 1) * Math.sin((i / rustleLen) * Math.PI) * 0.35;
      }
      const rustleSrc = ctx.createBufferSource();
      rustleSrc.buffer = rustleBuf;
      const rustleFilt = ctx.createBiquadFilter();
      rustleFilt.type = "bandpass";
      rustleFilt.frequency.setValueAtTime(1600, now);
      rustleFilt.frequency.exponentialRampToValueAtTime(2800, now + 0.45);
      rustleFilt.Q.setValueAtTime(2.2, now);
      const rustleGain = ctx.createGain();
      rustleGain.gain.setValueAtTime(0.18, now);
      rustleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      rustleSrc.connect(rustleFilt);
      rustleFilt.connect(rustleGain);
      rustleGain.connect(ctx.destination);
      rustleSrc.start(now);

      // 2. 14 Staggered Paper Crunch & Fiber Scrunch Bursts (0.6s – 2.8s)
      for (let i = 0; i < 14; i++) {
        const crunchTime = now + 0.6 + i * 0.155;
        const crunchLen = Math.floor(ctx.sampleRate * 0.09);
        const crunchBuf = ctx.createBuffer(1, crunchLen, ctx.sampleRate);
        const cData = crunchBuf.getChannelData(0);
        for (let j = 0; j < crunchLen; j++) {
          cData[j] = (Math.random() * 2 - 1) * Math.exp(-j / (crunchLen * 0.35));
        }
        const cSrc = ctx.createBufferSource();
        cSrc.buffer = crunchBuf;
        const cFilt = ctx.createBiquadFilter();
        cFilt.type = (i % 2 === 0) ? "highpass" : "bandpass";
        cFilt.frequency.setValueAtTime(1800 + (i % 5) * 450, crunchTime);
        cFilt.Q.setValueAtTime(2.5, crunchTime);
        const cGain = ctx.createGain();
        const amp = 0.14 * (1 - (i / 18));
        cGain.gain.setValueAtTime(amp, crunchTime);
        cGain.gain.exponentialRampToValueAtTime(0.001, crunchTime + 0.085);
        cSrc.connect(cFilt);
        cFilt.connect(cGain);
        cGain.connect(ctx.destination);
        cSrc.start(crunchTime);
      }

      // 3. Tight Paper Ball Compression Click (2.85s)
      const snapOsc = ctx.createOscillator();
      const snapGain = ctx.createGain();
      snapOsc.type = "sine";
      snapOsc.frequency.setValueAtTime(880, now + 2.85);
      snapOsc.frequency.exponentialRampToValueAtTime(320, now + 3.05);
      snapGain.gain.setValueAtTime(0.20, now + 2.85);
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 3.10);
      snapOsc.connect(snapGain);
      snapGain.connect(ctx.destination);
      snapOsc.start(now + 2.85);
      snapOsc.stop(now + 3.12);

      // 4. Soft Rolling Drop Thud (3.2s – 4.0s)
      const rollOsc = ctx.createOscillator();
      const rollGain = ctx.createGain();
      rollOsc.type = "sine";
      rollOsc.frequency.setValueAtTime(140, now + 3.2);
      rollOsc.frequency.exponentialRampToValueAtTime(42, now + 3.75);
      rollGain.gain.setValueAtTime(0.12, now + 3.2);
      rollGain.gain.exponentialRampToValueAtTime(0.001, now + 3.95);
      rollOsc.connect(rollGain);
      rollGain.connect(ctx.destination);
      rollOsc.start(now + 3.2);
      rollOsc.stop(now + 4.0);
    };

    if (ctx.state === "suspended") {
      ctx.resume().then(execute).catch(execute);
    } else {
      execute();
    }
  }

  /**
   * Butterfly Metamorphosis & Flight (Synchronized with 4.0s Animation in SubjectsPage):
   * • 0.0s – 0.25s: Instant crystal fracture snap & glass shard ping (0ms frame-0 latency).
   * • 0.15s – 0.9s: Metamorphosis sparkle chimes as butterfly emerges from fracture epicenter.
   * • 0.4s – 3.2s: Aerodynamic wing flap flight whoosh with smooth 5.5Hz flap wave modulation.
   * • 1.8s – 3.8s: Stardust ascension glockenspiel trail soaring high into distance.
   */
  playButterflyFlutterSound() {
    if (!this.isEnabled() || this.isVoiceModeActive()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // 1. Crystal Card Shatter Snap (0.0s – 0.25s): Immediate high-frequency crystalline glass crack
    const fractureOsc = ctx.createOscillator();
    const fractureGain = ctx.createGain();
    fractureOsc.type = "sine";
    fractureOsc.frequency.setValueAtTime(3520, now);
    fractureOsc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    fractureGain.gain.setValueAtTime(0.22, now);
    fractureGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    fractureOsc.connect(fractureGain);
    fractureGain.connect(ctx.destination);
    fractureOsc.start(now);
    fractureOsc.stop(now + 0.15);

    // Light crystal shard ping
    const pingOsc = ctx.createOscillator();
    const pingGain = ctx.createGain();
    pingOsc.type = "triangle";
    pingOsc.frequency.setValueAtTime(2637, now + 0.02);
    pingGain.gain.setValueAtTime(0.12, now + 0.02);
    pingGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.28);
    pingOsc.connect(pingGain);
    pingGain.connect(ctx.destination);
    pingOsc.start(now + 0.02);
    pingOsc.stop(now + 0.30);

    // 2. Metamorphosis Sparkle Unfold (0.15s – 0.9s): Ascending fairy wind-chimes
    const chimePitches = [1046.5, 1318.5, 1567.98, 2093.0, 2637.0, 3135.96];
    chimePitches.forEach((freq, idx) => {
      const t = now + 0.14 + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.0003, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.38);
    });

    // 3. Fluid Aerodynamic Wing Flap Whoosh & Flight Sweep (0.4s – 3.2s)
    const whooshLen = Math.floor(ctx.sampleRate * 2.8);
    const whooshBuf = ctx.createBuffer(1, whooshLen, ctx.sampleRate);
    const wData = whooshBuf.getChannelData(0);
    for (let i = 0; i < whooshLen; i++) {
      const progress = i / whooshLen;
      const mod = 0.5 + 0.5 * Math.sin(progress * 2.8 * Math.PI * 5.5);
      const envelope = Math.sin(progress * Math.PI);
      wData[i] = (Math.random() * 2 - 1) * envelope * (0.6 + 0.4 * mod);
    }
    const whooshSrc = ctx.createBufferSource();
    whooshSrc.buffer = whooshBuf;
    const whooshFilter = ctx.createBiquadFilter();
    whooshFilter.type = "bandpass";
    whooshFilter.frequency.setValueAtTime(600, now + 0.35);
    whooshFilter.frequency.exponentialRampToValueAtTime(1400, now + 1.8);
    whooshFilter.frequency.exponentialRampToValueAtTime(2400, now + 3.0);
    whooshFilter.Q.setValueAtTime(2.0, now + 0.35);
    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0.001, now + 0.35);
    whooshGain.gain.linearRampToValueAtTime(0.12, now + 1.4);
    whooshGain.gain.exponentialRampToValueAtTime(0.0005, now + 3.15);
    whooshSrc.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(ctx.destination);
    whooshSrc.start(now + 0.35);

    // 4. Stardust Ascension Trail (1.8s – 3.8s): Shimmering high-octave bells trailing away
    const trailPitches = [1567.98, 2093.0, 2637.0, 3135.96, 3951.07];
    trailPitches.forEach((freq, idx) => {
      const t = now + 1.8 + idx * 0.28;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.045, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.60);
    });
  }

  /**
   * Parabolic Trash Can Gulp (Instant Zero-Latency Synchronized with 1.5s Staged Experience):
   * • 0.0s – 0.32s: Instant crisp launch whoosh + tactile pitch sweep starting at tap (0ms latency).
   * • 0.30s – 0.68s: Parabolic aerodynamic descent swoosh into trash can.
   * • 0.68s – 0.95s: Deep metallic suction gulp thud & sparkling rim firework crackles.
   * • 0.85s – 1.35s: Warm bin settle chime.
   */
  /**
   * Trash Ingestion & Parabolic Flight (Synchronized with 4.5s Cinematic Sequence in SemesterHubPage):
   * • 0.0s – 0.6s: Instant tactile launch whoosh + paper crumple rustle at 0ms.
   * • 0.6s – 2.4s: Graceful parabolic flight wind rush & whistling air resistance sweep.
   * • 2.4s – 3.2s: Resonant metallic trash can suction gulp thud & rim firework chimes.
   * • 3.2s – 4.2s: Harmonic metallic seal tie chime resolving as bin sinks.
   */
  playTrashGulpSound() {
    if (!this.isEnabled() || this.isVoiceModeActive()) return;
    this.lastMajorSoundTime = Date.now();
    const ctx = this.getContext();
    if (!ctx) return;

    const execute = () => {
      const now = ctx.currentTime;

      // 1. Instant Launch Whoosh + Paper Rustle (0.0s – 0.60s) - ZERO LATENCY
      const launchDuration = 0.60;
      const launchBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * launchDuration), ctx.sampleRate);
      const lData = launchBuf.getChannelData(0);
      for (let i = 0; i < lData.length; i++) {
        lData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (lData.length * 0.6));
      }
      const launchSource = ctx.createBufferSource();
      launchSource.buffer = launchBuf;
      const launchFilter = ctx.createBiquadFilter();
      launchFilter.type = "bandpass";
      launchFilter.frequency.setValueAtTime(450, now);
      launchFilter.frequency.exponentialRampToValueAtTime(2600, now + 0.45);
      launchFilter.Q.setValueAtTime(2.0, now);

      const launchGain = ctx.createGain();
      launchGain.gain.setValueAtTime(0.32, now);
      launchGain.gain.exponentialRampToValueAtTime(0.04, now + 0.55);

      launchSource.connect(launchFilter);
      launchFilter.connect(launchGain);
      launchGain.connect(ctx.destination);
      launchSource.start(now);

      // Launch pitch sweep (punchy low-mid sweep giving immediate acoustic feedback on tap)
      const tossPitch = ctx.createOscillator();
      const tossGain = ctx.createGain();
      tossPitch.type = "triangle";
      tossPitch.frequency.setValueAtTime(180, now);
      tossPitch.frequency.exponentialRampToValueAtTime(440, now + 0.40);
      tossGain.gain.setValueAtTime(0.28, now);
      tossGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      tossPitch.connect(tossGain);
      tossGain.connect(ctx.destination);
      tossPitch.start(now);
      tossPitch.stop(now + 0.45);

      // 2. Parabolic Soar & Wind Resistance Sweep (0.60s – 2.40s)
      const soarDuration = 1.85;
      const soarBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * soarDuration), ctx.sampleRate);
      const sData = soarBuf.getChannelData(0);
      for (let i = 0; i < sData.length; i++) {
        sData[i] = (Math.random() * 2 - 1) * Math.sin((i / sData.length) * Math.PI);
      }
      const soarSource = ctx.createBufferSource();
      soarSource.buffer = soarBuf;
      const soarFilter = ctx.createBiquadFilter();
      soarFilter.type = "bandpass";
      soarFilter.frequency.setValueAtTime(900, now + 0.55);
      soarFilter.frequency.exponentialRampToValueAtTime(1800, now + 1.40);
      soarFilter.frequency.exponentialRampToValueAtTime(400, now + 2.38);
      soarFilter.Q.setValueAtTime(2.4, now + 0.55);

      const soarGain = ctx.createGain();
      soarGain.gain.setValueAtTime(0.02, now + 0.55);
      soarGain.gain.linearRampToValueAtTime(0.18, now + 1.45);
      soarGain.gain.exponentialRampToValueAtTime(0.001, now + 2.40);

      soarSource.connect(soarFilter);
      soarFilter.connect(soarGain);
      soarGain.connect(ctx.destination);
      soarSource.start(now + 0.55);

      // Soaring melodic whistle along the arc
      const whistleOsc = ctx.createOscillator();
      const whistleGain = ctx.createGain();
      whistleOsc.type = "sine";
      whistleOsc.frequency.setValueAtTime(440, now + 0.60);
      whistleOsc.frequency.exponentialRampToValueAtTime(720, now + 1.45);
      whistleOsc.frequency.exponentialRampToValueAtTime(320, now + 2.38);
      whistleGain.gain.setValueAtTime(0.01, now + 0.60);
      whistleGain.gain.linearRampToValueAtTime(0.08, now + 1.45);
      whistleGain.gain.exponentialRampToValueAtTime(0.001, now + 2.40);
      whistleOsc.connect(whistleGain);
      whistleGain.connect(ctx.destination);
      whistleOsc.start(now + 0.60);
      whistleOsc.stop(now + 2.40);

      // 3. Deep Suction Gulp & Metallic Bin Catch Thud (Landing in bin at t=2.40s)
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = "triangle";
      thudOsc.frequency.setValueAtTime(190, now + 2.40);
      thudOsc.frequency.exponentialRampToValueAtTime(32, now + 2.85);
      thudGain.gain.setValueAtTime(0.48, now + 2.40);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 2.92);
      thudOsc.connect(thudGain);
      thudGain.connect(ctx.destination);
      thudOsc.start(now + 2.40);
      thudOsc.stop(now + 2.95);

      // Suction air gulp
      const gulpFilter = ctx.createBiquadFilter();
      gulpFilter.type = "lowpass";
      gulpFilter.frequency.setValueAtTime(1400, now + 2.40);
      gulpFilter.frequency.exponentialRampToValueAtTime(180, now + 2.75);
      const gulpGain = ctx.createGain();
      gulpGain.gain.setValueAtTime(0.24, now + 2.40);
      gulpGain.gain.exponentialRampToValueAtTime(0.001, now + 2.80);
      launchSource.connect(gulpFilter);
      gulpFilter.connect(gulpGain);
      gulpGain.connect(ctx.destination);

      // 4. Rim Fireworks Pop & Catch Chimes (2.45s – 2.85s)
      [720, 960, 1280, 1600].forEach((freq, idx) => {
        const popTime = now + 2.44 + idx * 0.065;
        const popOsc = ctx.createOscillator();
        const popGain = ctx.createGain();
        popOsc.type = "sine";
        popOsc.frequency.setValueAtTime(freq, popTime);
        popOsc.frequency.exponentialRampToValueAtTime(freq * 1.35, popTime + 0.08);
        popGain.gain.setValueAtTime(0.14, popTime);
        popGain.gain.exponentialRampToValueAtTime(0.001, popTime + 0.10);
        popOsc.connect(popGain);
        popGain.connect(ctx.destination);
        popOsc.start(popTime);
        popOsc.stop(popTime + 0.12);
      });

      // 5. Metallic Seal Tie & Resolution Chime (2.85s – 4.20s)
      const sealOsc = ctx.createOscillator();
      const sealGain = ctx.createGain();
      sealOsc.type = "sine";
      sealOsc.frequency.setValueAtTime(523.25, now + 2.85); // C5
      sealOsc.frequency.exponentialRampToValueAtTime(783.99, now + 3.35); // G5
      sealGain.gain.setValueAtTime(0.10, now + 2.85);
      sealGain.gain.exponentialRampToValueAtTime(0.0005, now + 4.20);
      sealOsc.connect(sealGain);
      sealGain.connect(ctx.destination);
      sealOsc.start(now + 2.85);
      sealOsc.stop(now + 4.25);
    };

    if (ctx.state === "suspended") {
      ctx.resume().then(execute).catch(execute);
    } else {
      execute();
    }
  }

  /**
   * Domino Cascade Wave (Synchronized with 4.5s Schedule Clear in TimetablePage):
   * • 0.0s – 3.5s: 24 cascading resonant domino tiles falling sequentially.
   * • 3.5s – 4.5s: Warm resolution triad chord settling as calendar settles.
   */
  playDominoCascadeSound(tileCount: number = 24, withChord: boolean = true) {
    if (!this.isEnabled() || this.isVoiceModeActive()) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const tiles = Math.max(1, Math.min(24, Math.round(tileCount)));

    const execute = () => {
      const now = ctx.currentTime;

      // 24 Cascading Domino Tiles: Exact 0ms sync with dominoCascadeFall (starts at 0.15s + i * 0.142s)
      const scale = [
        880.0, 783.99, 698.46, 659.25, 587.33, 523.25, 493.88, 440.0,
        783.99, 698.46, 659.25, 587.33, 523.25, 493.88, 440.0, 392.0,
        659.25, 587.33, 523.25, 493.88, 440.0, 392.0, 349.23, 261.63
      ];

      for (let i = 0; i < tiles; i++) {
        const t = now + 0.15 + i * 0.142; // Locks perfectly with CSS animation-delay
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        const freq = scale[i % scale.length];
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.09);
        gain.gain.setValueAtTime(0.09, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.11);
      }

      // Warm resolution triad chord (3.65s – 4.5s for full 24-tile wave; follows last tile otherwise)
      if (!withChord) return;
      const chordStart = tiles >= 24 ? 3.65 : 0.15 + tiles * 0.142 + 0.2;
      const triad = [261.63, 329.63, 392.0]; // C4, E4, G4
      triad.forEach((note) => {
        const chordOsc = ctx.createOscillator();
        const chordGain = ctx.createGain();
        chordOsc.type = "triangle";
        chordOsc.frequency.setValueAtTime(note, now + chordStart);
        chordGain.gain.setValueAtTime(0.08, now + chordStart);
        chordGain.gain.exponentialRampToValueAtTime(0.0005, now + chordStart + 0.83);
        chordOsc.connect(chordGain);
        chordGain.connect(ctx.destination);
        chordOsc.start(now + chordStart);
        chordOsc.stop(now + chordStart + 0.85);
      });
    };

    if (ctx.state === "suspended") {
      ctx.resume().then(execute).catch(execute);
    } else {
      execute();
    }
  }

  /**
   * Radial Shockwave (Synchronized with 4.5s Semester Transition):
   * • 0.0s – 1.0s: Deep sub-bass pulse & expanding frequency ring sweep.
   * • 1.0s – 4.5s: Celestial harmonic wash and reverberation settling.
   */
  playShockwaveSound() {
    if (!this.isEnabled() || this.isVoiceModeActive()) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Sub-bass thump
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(130, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.85);
    subGain.gain.setValueAtTime(0.38, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 1.15);

    // Expanding shockwave frequency sweep (440Hz -> 1800Hz)
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.type = "triangle";
    sweep.frequency.setValueAtTime(380, now + 0.1);
    sweep.frequency.exponentialRampToValueAtTime(1760, now + 1.4);
    sweepGain.gain.setValueAtTime(0.16, now + 0.1);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    sweep.connect(sweepGain);
    sweepGain.connect(ctx.destination);
    sweep.start(now + 0.1);
    sweep.stop(now + 1.85);

    // Celestial graduation harmonic wash (1.5s – 4.5s)
    const chords = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    chords.forEach((freq, idx) => {
      const hOsc = ctx.createOscillator();
      const hGain = ctx.createGain();
      hOsc.type = "sine";
      hOsc.frequency.setValueAtTime(freq, now + 1.5 + idx * 0.12);
      hGain.gain.setValueAtTime(0.07, now + 1.5 + idx * 0.12);
      hGain.gain.exponentialRampToValueAtTime(0.0005, now + 4.45);
      hOsc.connect(hGain);
      hGain.connect(ctx.destination);
      hOsc.start(now + 1.5 + idx * 0.12);
      hOsc.stop(now + 4.5);
    });
  }

  /**
   * Electric Paper Shredder Sound Suite:
   * Procedural Web Audio API synthesis with 0ms latency:
   *   • 0.0s – 1.88s: High-torque dual-motor humming (114Hz saw + 122Hz square) with 26Hz gear ripple.
   *   • 0.0s – 1.88s: Continuous gritty tearing paper fibers & micro-burst crunch snaps (1.2kHz HP / 2.4kHz BP).
   *   • 0.0s – 1.85s: Paper buckle and roller friction crackle.
   *   • 1.88s: Mechanical blade tooth snap latch click as paper clears teeth.
   *   • 1.88s – 2.4s: Motor pitch deceleration sag (down to 32Hz) and coast to silence.
   */
  playShredderSound(duration = 2.4, volume = 0.32) {
    if (!this.isEnabled() || this.isVoiceModeActive()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime + 0.002; // Immediate start (0ms latency buffer)
      const feedEnd = now + duration * 0.78; // Sheet clears cutting blades
      const totalEnd = now + duration;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(volume, now);
      masterGain.connect(ctx.destination);

      // 1. MOTOR ENGINE: Dual Sawtooth / Square Oscillators + High-Ratio Gear Tremolo
      const oscSaw = ctx.createOscillator();
      const oscSq = ctx.createOscillator();
      oscSaw.type = "sawtooth";
      oscSq.type = "square";

      const baseFreq1 = 114;
      const baseFreq2 = 122;
      oscSaw.frequency.setValueAtTime(baseFreq1, now);
      oscSq.frequency.setValueAtTime(baseFreq2, now);

      // Torque Load: As paper enters, pitch sags by ~8Hz due to mechanical drag
      oscSaw.frequency.linearRampToValueAtTime(baseFreq1 - 8, now + 0.25);
      oscSq.frequency.linearRampToValueAtTime(baseFreq2 - 8, now + 0.25);

      // Sheet clears teeth: surge + deceleration ramp down
      oscSaw.frequency.setValueAtTime(baseFreq1 + 4, feedEnd);
      oscSq.frequency.setValueAtTime(baseFreq2 + 4, feedEnd);
      oscSaw.frequency.exponentialRampToValueAtTime(32, totalEnd);
      oscSq.frequency.exponentialRampToValueAtTime(36, totalEnd);

      // 26Hz high-frequency gear teeth torque modulation LFO
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(26, now);
      lfoGain.gain.setValueAtTime(4.0, now);
      lfo.connect(oscSaw.frequency);
      lfo.connect(oscSq.frequency);

      // Motor casing acoustic lowpass filter
      const motorFilter = ctx.createBiquadFilter();
      motorFilter.type = "lowpass";
      motorFilter.frequency.setValueAtTime(640, now);
      motorFilter.Q.setValueAtTime(2.2, now);

      const motorGain = ctx.createGain();
      motorGain.gain.setValueAtTime(0.01, now);
      motorGain.gain.linearRampToValueAtTime(0.24, now + 0.06); // Fast spin up (60ms)
      motorGain.gain.setValueAtTime(0.24, feedEnd);
      motorGain.gain.exponentialRampToValueAtTime(0.001, totalEnd); // Decelerate to silence

      oscSaw.connect(motorFilter);
      oscSq.connect(motorFilter);
      motorFilter.connect(motorGain);
      motorGain.connect(masterGain);

      // 2. GRITTY TEARING CRUNCH: Filtered White Noise with Rapid Amplitude Bursts
      const shredTime = feedEnd - now;
      const bufferLen = Math.floor(ctx.sampleRate * Math.max(shredTime, 0.5));
      const noiseBuffer = ctx.createBuffer(1, bufferLen, ctx.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferLen; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const hpFilter = ctx.createBiquadFilter();
      hpFilter.type = "highpass";
      hpFilter.frequency.setValueAtTime(1200, now);

      const bpFilter = ctx.createBiquadFilter();
      bpFilter.type = "bandpass";
      bpFilter.frequency.setValueAtTime(2400, now);
      bpFilter.Q.setValueAtTime(3.4, now);

      const crunchGain = ctx.createGain();
      crunchGain.gain.setValueAtTime(0.001, now);
      crunchGain.gain.linearRampToValueAtTime(0.32, now + 0.08);

      // Schedule granular micro-burst envelopes every 30-45ms (fiber shear snaps)
      let burstCursor = now + 0.08;
      while (burstCursor < feedEnd - 0.04) {
        const step = 0.032 + Math.random() * 0.02;
        const peak = 0.24 + Math.random() * 0.20;
        const valley = 0.06 + Math.random() * 0.04;
        crunchGain.gain.setValueAtTime(peak, burstCursor);
        crunchGain.gain.exponentialRampToValueAtTime(valley, burstCursor + step * 0.7);
        burstCursor += step;
      }
      crunchGain.gain.setValueAtTime(0.2, feedEnd - 0.02);
      crunchGain.gain.exponentialRampToValueAtTime(0.0005, feedEnd + 0.03);

      noiseSource.connect(hpFilter);
      hpFilter.connect(bpFilter);
      bpFilter.connect(crunchGain);
      crunchGain.connect(masterGain);

      // 3. PAPER FEED TEXTURE: Sparse Impulse Crackle (Fiber Buckle & Roller Friction)
      const crackleLen = Math.floor(ctx.sampleRate * Math.max(shredTime, 0.5));
      const crackleBuffer = ctx.createBuffer(1, crackleLen, ctx.sampleRate);
      const crackleData = crackleBuffer.getChannelData(0);
      for (let i = 0; i < crackleLen; i++) {
        crackleData[i] = Math.random() > 0.982 ? (Math.random() * 2 - 1) * 0.85 : 0;
      }
      const crackleSource = ctx.createBufferSource();
      crackleSource.buffer = crackleBuffer;

      const crackleFilter = ctx.createBiquadFilter();
      crackleFilter.type = "bandpass";
      crackleFilter.frequency.setValueAtTime(3400, now);
      crackleFilter.Q.setValueAtTime(4.5, now);

      const crackleGain = ctx.createGain();
      crackleGain.gain.setValueAtTime(0.001, now);
      crackleGain.gain.linearRampToValueAtTime(0.14, now + 0.12);
      crackleGain.gain.setValueAtTime(0.14, feedEnd);
      crackleGain.gain.exponentialRampToValueAtTime(0.0005, feedEnd + 0.03);

      crackleSource.connect(crackleFilter);
      crackleFilter.connect(crackleGain);
      crackleGain.connect(masterGain);

      // 4. SHEET CLEAR METALLIC CLICK (Blade Tooth Snap)
      const snapOsc = ctx.createOscillator();
      const snapGain = ctx.createGain();
      snapOsc.type = "sine";
      snapOsc.frequency.setValueAtTime(1750, feedEnd);
      snapOsc.frequency.exponentialRampToValueAtTime(280, feedEnd + 0.025);

      snapGain.gain.setValueAtTime(0.24, feedEnd);
      snapGain.gain.exponentialRampToValueAtTime(0.0005, feedEnd + 0.03);

      snapOsc.connect(snapGain);
      snapGain.connect(masterGain);

      // START ALL NODES
      oscSaw.start(now);
      oscSq.start(now);
      lfo.start(now);
      noiseSource.start(now);
      crackleSource.start(now);
      snapOsc.start(feedEnd);

      oscSaw.stop(totalEnd);
      oscSq.stop(totalEnd);
      lfo.stop(totalEnd);
      noiseSource.stop(feedEnd + 0.05);
      crackleSource.stop(feedEnd + 0.05);
      snapOsc.stop(feedEnd + 0.04);
    } catch (e) {
      // Audio safety fallback
    }
  }

  /**
   * Spark Pop / Extra Lecture Snap (Synchronized with 4.0s Pop in TodayPage):
   * • 0.0s – 0.15s: Crisp tactile snap pop.
   * • 0.15s – 2.5s: Shimmering harmonic sparkle trail.
   * • 2.5s – 4.0s: Deep warm settling resonance.
   */
  playSnapPopSound() {
    if (!this.isEnabled() || this.isVoiceModeActive()) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Initial crisp tactile pop (0.0s – 0.15s)
    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();
    popOsc.type = "sine";
    popOsc.frequency.setValueAtTime(420, now);
    popOsc.frequency.exponentialRampToValueAtTime(1080, now + 0.1);
    popGain.gain.setValueAtTime(0.24, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    popOsc.connect(popGain);
    popGain.connect(ctx.destination);
    popOsc.start(now);
    popOsc.stop(now + 0.15);

    // 2. Harmonic sparkle trail (0.15s – 2.5s)
    const sparkleNotes = [1046.5, 1318.5, 1567.98, 2093.0]; // C6, E6, G6, C7
    sparkleNotes.forEach((freq, idx) => {
      const sTime = now + 0.12 + idx * 0.15;
      const sOsc = ctx.createOscillator();
      const sGain = ctx.createGain();
      sOsc.type = "sine";
      sOsc.frequency.setValueAtTime(freq, sTime);
      sGain.gain.setValueAtTime(0.09, sTime);
      sGain.gain.exponentialRampToValueAtTime(0.0005, now + 2.45);
      sOsc.connect(sGain);
      sGain.connect(ctx.destination);
      sOsc.start(sTime);
      sOsc.stop(now + 2.5);
    });

    // 3. Warm settling resonance (2.0s – 4.0s)
    const warmOsc = ctx.createOscillator();
    const warmGain = ctx.createGain();
    warmOsc.type = "triangle";
    warmOsc.frequency.setValueAtTime(130, now + 2.0);
    warmGain.gain.setValueAtTime(0.06, now + 2.0);
    warmGain.gain.exponentialRampToValueAtTime(0.0005, now + 3.98);
    warmOsc.connect(warmGain);
    warmGain.connect(ctx.destination);
    warmOsc.start(now + 2.0);
    warmOsc.stop(now + 4.0);
  }

  /**
   * Rain Drop Slot Cascade Synthesizer
   * Plays a delicate, crystalline succession of cascading droplet tones as
   * slots rain into their grid positions, scaling dynamically to slot count,
   * concluding with a soft acoustic splash chime.
   * Perfectly synchronized with visual rainDropSlot CSS delay (40ms desktop, 80ms mobile).
   */
  playRainDropCascadeSound(slotCount?: number, isMobile = false) {
    if (!this.isEnabled() || this.isVoiceModeActive()) return;
    this.lastMajorSoundTime = Date.now();
    const ctx = this.getContext();
    if (!ctx) return;

    const play = () => {
      if (ctx.state !== "running") {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      const count = Math.min(Math.max(slotCount || 16, 6), 36);
      // Synchronize exact droplet interval to visual rainDropSlot CSS delay:
      // Desktop: 0.04s (40ms) per slot. Mobile: 0.08s (80ms) per slot.
      const interval = isMobile ? 0.08 : 0.04;
      // Start droplet impact acoustic chime at 0.12s when falling slots touch the grid
      const startOffset = 0.12;
      const dropFreqs = [783.99, 880.0, 987.77, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];
      
      for (let i = 0; i < count; i++) {
        const dropTime = now + startOffset + i * interval;
        const freq = dropFreqs[i % dropFreqs.length] * (1 + (Math.random() * 0.03 - 0.015));
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        
        osc.frequency.setValueAtTime(freq * 1.08, dropTime);
        osc.frequency.exponentialRampToValueAtTime(freq, dropTime + 0.035);
        
        gain.gain.setValueAtTime(0.08, dropTime);
        gain.gain.exponentialRampToValueAtTime(0.0005, dropTime + 0.07);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(dropTime);
        osc.stop(dropTime + 0.075);
      }

      // Resolving crystalline bell chime exactly as the final slot lands into place
      const chimeTime = now + startOffset + count * interval + 0.04;
      const chimeOsc = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      chimeOsc.type = "triangle";
      chimeOsc.frequency.setValueAtTime(523.25, chimeTime); // C5
      chimeGain.gain.setValueAtTime(0.08, chimeTime);
      chimeGain.gain.exponentialRampToValueAtTime(0.0005, chimeTime + 0.35);
      chimeOsc.connect(chimeGain);
      chimeGain.connect(ctx.destination);
      chimeOsc.start(chimeTime);
      chimeOsc.stop(chimeTime + 0.38);
    };

    if (ctx.state === "suspended") {
      ctx.resume().then(play).catch(play);
    } else {
      play();
    }
  }

  /**
   * Dynamic Island HUD Micro-Acoustic Pop (0.08s):
   * Ultra-crisp, elegant acoustic expansion blip synthesized with 0ms latency.
   * Accents HUD notifications without interfering with active full-page synthesizers.
   */
  playDynamicHUDSound(type?: string) {
    if (!this.isEnabled() || this.isVoiceModeActive()) return;
    // If a major animation sound was triggered within the last 350ms, suppress HUD sound to prevent acoustic clash
    if (Date.now() - this.lastMajorSoundTime < 350) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      if (ctx.state !== "running") {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      switch (type) {
        case "trash":
          osc.type = "sine";
          osc.frequency.setValueAtTime(360, now);
          osc.frequency.exponentialRampToValueAtTime(140, now + 0.05);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.055);
          break;
        case "hub":
        case "cap":
        case "success":
          osc.type = "triangle";
          osc.frequency.setValueAtTime(659.25, now);
          osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.08);
          gain.gain.setValueAtTime(0.11, now);
          gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.12);
          break;
        case "plane":
          osc.type = "sine";
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(1320, now + 0.07);
          gain.gain.setValueAtTime(0.10, now);
          gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.075);
          break;
        case "origami":
          osc.type = "triangle";
          osc.frequency.setValueAtTime(580, now);
          osc.frequency.exponentialRampToValueAtTime(220, now + 0.05);
          gain.gain.setValueAtTime(0.14, now);
          gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.055);
          break;
        case "butterfly":
          osc.type = "sine";
          osc.frequency.setValueAtTime(1760, now);
          osc.frequency.exponentialRampToValueAtTime(2637, now + 0.08);
          gain.gain.setValueAtTime(0.09, now);
          gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.09);
          break;
        case "sun":
          osc.type = "sine";
          osc.frequency.setValueAtTime(587.33, now); // D5
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5
          gain.gain.setValueAtTime(0.10, now);
          gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.085);
          break;
        case "moon":
          osc.type = "sine";
          osc.frequency.setValueAtTime(440, now); // A4
          osc.frequency.exponentialRampToValueAtTime(220, now + 0.07); // A3
          gain.gain.setValueAtTime(0.11, now);
          gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.075);
          break;
        case "sparkle":
        default:
          osc.type = "sine";
          osc.frequency.setValueAtTime(1240, now);
          osc.frequency.exponentialRampToValueAtTime(1860, now + 0.065);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.07);
          break;
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {}
  }

  /**
   * Tactile Slot Drop Snap Sound (0.15s)
   * A soft magnetic acoustic snap click when a slot is dropped into position.
   */
  playSlotDropSound() {
    if (!this.isEnabled() || this.isVoiceModeActive()) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.07);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Tactile Alert / Prompt Sound (0.2s)
   * A delicate two-tone acoustic alert chime (twin sine 480Hz -> 620Hz)
   * used when action prompts or confirmation toasts appear.
   */
  playPromptAlertSound() {
    if (!this.isEnabled() || this.isVoiceModeActive()) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";

    osc1.frequency.setValueAtTime(480, now);
    osc1.frequency.exponentialRampToValueAtTime(620, now + 0.08);

    osc2.frequency.setValueAtTime(960, now + 0.04);
    osc2.frequency.exponentialRampToValueAtTime(1240, now + 0.12);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.14);
    osc2.start(now + 0.04);
    osc2.stop(now + 0.2);
  }

  /**
   * Aerodynamic Session Termination Whoosh (0.42s):
   * High-pass wind velocity sweep (220Hz -> 1650Hz -> 380Hz) paired with a whistle glide
   * and acoustic disconnect snap, synchronized with linked device termination.
   */
  playWhooshSound(volume = 0.28) {
    if (!this.isEnabled() || this.isVoiceModeActive()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime + 0.002;
      const duration = 0.42;

      // 1. Wind whoosh filtered noise burst
      const bufLen = Math.floor(ctx.sampleRate * duration);
      const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufLen) * Math.PI);
      }
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;

      const bpFilter = ctx.createBiquadFilter();
      bpFilter.type = "bandpass";
      bpFilter.frequency.setValueAtTime(260, now);
      bpFilter.frequency.exponentialRampToValueAtTime(1650, now + 0.16);
      bpFilter.frequency.exponentialRampToValueAtTime(320, now + duration);
      bpFilter.Q.setValueAtTime(2.6, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.01, now);
      noiseGain.gain.linearRampToValueAtTime(volume * 0.9, now + 0.14);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noiseSrc.connect(bpFilter);
      bpFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      // 2. Tonal aerodynamic whistling swoosh
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(840, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(180, now + duration);

      oscGain.gain.setValueAtTime(0.01, now);
      oscGain.gain.linearRampToValueAtTime(volume * 0.5, now + 0.12);
      oscGain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      // 3. Acoustic disconnect latch snap blip
      const snap = ctx.createOscillator();
      const snapGain = ctx.createGain();
      snap.type = "triangle";
      snap.frequency.setValueAtTime(920, now);
      snap.frequency.exponentialRampToValueAtTime(240, now + 0.04);
      snapGain.gain.setValueAtTime(volume * 0.45, now);
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      snap.connect(snapGain);
      snapGain.connect(ctx.destination);

      noiseSrc.start(now);
      osc.start(now);
      snap.start(now);

      noiseSrc.stop(now + duration);
      osc.stop(now + duration);
      snap.stop(now + 0.05);
    } catch {}
  }

  /**
   * Level-Up / All Checklist Steps Completed Fanfare (0.68s):
   * Pure synthesized celebratory ascending chime arpeggio (C5 -> E5 -> G5 -> C6)
   * with acoustic harmonic shimmer and crystalline ringout.
   */
  playLevelUpCelebrationSound(volume = 0.32) {
    if (!this.isEnabled() || this.isVoiceModeActive()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime + 0.002;
      const notes = [
        { freq: 523.25, time: 0.00, dur: 0.45 }, // C5
        { freq: 659.25, time: 0.10, dur: 0.45 }, // E5
        { freq: 783.99, time: 0.20, dur: 0.48 }, // G5
        { freq: 1046.50, time: 0.32, dur: 0.62 }, // C6
      ];

      notes.forEach(({ freq, time, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + time);

        // Gentle overtone shimmer
        gain.gain.setValueAtTime(0, now + time);
        gain.gain.linearRampToValueAtTime(volume * 0.4, now + time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + time + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + time);
        osc.stop(now + time + dur);
      });
    } catch {}
  }
}

export const SoundFX = new SoundEffectsEngine();
