export type SoundCue =
  | "ui"
  | "confirm"
  | "start"
  | "shoot"
  | "hit"
  | "kill"
  | "eliteKill"
  | "drop"
  | "levelUp"
  | "upgrade"
  | "skill"
  | "win"
  | "lose";

export type MusicMode = "menu" | "battle" | null;

const SOUND_KEY = "game-marbles-sound-enabled-v1";
const SFX_VOLUME_KEY = "game-marbles-sfx-volume-v1";
const MUSIC_KEY = "game-marbles-music-enabled-v1";
const MUSIC_VOLUME_KEY = "game-marbles-music-volume-v1";
const MUSIC_INTERVAL_MS = 520;

export class SoundManager {
  private context: AudioContext | null = null;
  private sfxMaster: GainNode | null = null;
  private musicMaster: GainNode | null = null;
  private sfxEnabled = loadEnabled(SOUND_KEY, true);
  private musicEnabled = loadEnabled(MUSIC_KEY, true);
  private sfxVolume = loadVolume(SFX_VOLUME_KEY, 0.9);
  private musicVolume = loadVolume(MUSIC_VOLUME_KEY, 0.5);
  private musicMode: MusicMode = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicGeneration = 0;
  private readonly lastPlayed = new Map<string, number>();

  get isEnabled() {
    return this.sfxEnabled;
  }

  get isMusicEnabled() {
    return this.musicEnabled;
  }

  get sfxVolumePercent() {
    return Math.round(this.sfxVolume * 100);
  }

  get musicVolumePercent() {
    return Math.round(this.musicVolume * 100);
  }

  toggle() {
    this.setEnabled(!this.sfxEnabled);
    if (this.sfxEnabled) this.play("confirm");
  }

  toggleMusic() {
    this.setMusicEnabled(!this.musicEnabled);
    if (this.musicEnabled) this.play("confirm");
  }

  setEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
    localStorage.setItem(SOUND_KEY, enabled ? "1" : "0");
    this.applySfxGain();
  }

  setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    localStorage.setItem(MUSIC_KEY, enabled ? "1" : "0");
    this.applyMusicGain();
    if (enabled) this.startMusic();
    else this.stopMusic(false);
  }

  setSfxVolume(value: number) {
    this.sfxVolume = clampVolume(value);
    localStorage.setItem(SFX_VOLUME_KEY, String(this.sfxVolume));
    this.applySfxGain();
  }

  setMusicVolume(value: number) {
    this.musicVolume = clampVolume(value);
    localStorage.setItem(MUSIC_VOLUME_KEY, String(this.musicVolume));
    this.applyMusicGain();
    if (this.musicEnabled && this.musicMode && this.musicTimer === null) this.startMusic();
  }

  setMusicMode(mode: MusicMode) {
    if (this.musicMode === mode && this.musicTimer !== null) return;
    this.musicMode = mode;
    if (!mode || !this.musicEnabled) {
      this.stopMusic(false);
      return;
    }
    this.startMusic();
  }

  play(cue: SoundCue, throttleMs = 0, variant = 0) {
    const audio = this.ensureContext();
    if (!audio) return;
    if (audio.state === "suspended") void audio.resume().catch(() => undefined);
    if (this.musicEnabled && this.musicMode && this.musicTimer === null) this.startMusic();
    if (!this.sfxEnabled) return;

    const nowMs = performance.now();
    const throttleKey = `${cue}:${Math.floor(variant)}`;
    const last = this.lastPlayed.get(throttleKey) || 0;
    if (throttleMs > 0 && nowMs - last < throttleMs) return;
    this.lastPlayed.set(throttleKey, nowMs);

    switch (cue) {
      case "ui":
        this.tone(560, 0.035, "triangle", 0.04, 850);
        break;
      case "confirm":
        this.tone(520, 0.045, "sine", 0.05, 720);
        this.tone(920, 0.055, "triangle", 0.034, 1180, 0.035);
        break;
      case "start":
        this.tone(160, 0.12, "sawtooth", 0.054, 240);
        this.tone(360, 0.16, "triangle", 0.048, 540, 0.045);
        this.tone(720, 0.12, "sine", 0.032, 1040, 0.1);
        break;
      case "shoot":
        this.tone(420 + variant * 58, 0.035, "square", 0.024, 680 + variant * 44);
        break;
      case "hit":
        this.noise(0.035, 0.036, 1200);
        this.tone(220, 0.035, "triangle", 0.024, 120);
        break;
      case "kill":
        this.noise(0.055, 0.044, 760);
        this.tone(260, 0.08, "sawtooth", 0.034, 90);
        break;
      case "eliteKill":
        this.noise(0.12, 0.056, 520);
        this.tone(180, 0.14, "sawtooth", 0.058, 70);
        this.tone(620, 0.18, "triangle", 0.044, 880, 0.05);
        break;
      case "drop":
        this.tone(780, 0.045, "sine", 0.04, 1120);
        this.tone(1320, 0.06, "triangle", 0.03, 1560, 0.03);
        break;
      case "levelUp":
        this.tone(480, 0.075, "triangle", 0.052, 690);
        this.tone(720, 0.075, "triangle", 0.046, 980, 0.06);
        this.tone(1080, 0.1, "sine", 0.038, 1380, 0.12);
        break;
      case "upgrade":
        this.tone(620, 0.07, "triangle", 0.044, 920);
        this.tone(980, 0.08, "sine", 0.034, 1260, 0.055);
        break;
      case "skill":
        this.tone(240, 0.12, "sawtooth", 0.048, 420);
        this.tone(900, 0.12, "triangle", 0.036, 560, 0.04);
        this.noise(0.08, 0.034, 1800);
        break;
      case "win":
        this.tone(420, 0.11, "triangle", 0.05, 620);
        this.tone(620, 0.11, "triangle", 0.046, 840, 0.08);
        this.tone(920, 0.18, "sine", 0.044, 1240, 0.17);
        break;
      case "lose":
        this.tone(220, 0.18, "sawtooth", 0.052, 120);
        this.tone(140, 0.28, "triangle", 0.044, 70, 0.12);
        break;
    }
  }

  private ensureContext() {
    if (this.context) return this.context;
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    const context = new AudioCtor();
    const sfxMaster = context.createGain();
    const musicMaster = context.createGain();
    sfxMaster.connect(context.destination);
    musicMaster.connect(context.destination);
    this.context = context;
    this.sfxMaster = sfxMaster;
    this.musicMaster = musicMaster;
    this.applySfxGain();
    this.applyMusicGain();
    return context;
  }

  private applySfxGain() {
    const gain = this.sfxMaster;
    if (!gain) return;
    this.setGain(gain, this.sfxEnabled ? this.sfxVolume * 0.92 : 0);
  }

  private applyMusicGain() {
    const gain = this.musicMaster;
    if (!gain) return;
    this.setGain(gain, this.musicEnabled ? this.musicVolume * 0.46 : 0);
  }

  private setGain(gain: GainNode, value: number) {
    const context = this.context;
    if (!context) {
      gain.gain.value = value;
      return;
    }
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(value, now, 0.03);
  }

  private startMusic() {
    if (!this.musicMode || !this.musicEnabled) return;
    const audio = this.ensureContext();
    if (!audio) return;
    if (audio.state === "suspended") void audio.resume().catch(() => undefined);

    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }

    this.musicGeneration += 1;
    this.musicStep = 0;
    const generation = this.musicGeneration;
    this.scheduleMusicStep(generation);
    this.musicTimer = window.setInterval(() => this.scheduleMusicStep(generation), MUSIC_INTERVAL_MS);
  }

  private stopMusic(clearMode: boolean) {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicGeneration += 1;
    if (clearMode) this.musicMode = null;
  }

  private scheduleMusicStep(generation: number) {
    if (generation !== this.musicGeneration || !this.musicMode || !this.musicEnabled) return;
    if (this.musicMode === "battle") this.scheduleBattleMusic(this.musicStep);
    else this.scheduleMenuMusic(this.musicStep);
    this.musicStep += 1;
  }

  private scheduleMenuMusic(step: number) {
    const padChords = [
      [196, 246.94, 293.66],
      [174.61, 220, 261.63],
      [146.83, 196, 246.94],
      [164.81, 207.65, 261.63],
    ];
    const arpeggio = [392, 329.63, 293.66, 329.63, 440, 392, 329.63, 293.66];

    if (step % 4 === 0) {
      const chord = padChords[Math.floor(step / 4) % padChords.length];
      chord.forEach((frequency, index) => {
        this.musicTone(frequency, 1.72, "sine", 0.026, frequency * 1.005, index * 0.03);
      });
    }

    const note = arpeggio[step % arpeggio.length];
    this.musicTone(note, 0.2, "triangle", 0.026, note * 1.01, 0.06);
    if (step % 8 === 6) this.musicTone(note * 1.5, 0.32, "sine", 0.018, note * 1.52, 0.18);
  }

  private scheduleBattleMusic(step: number) {
    const bass = [82.41, 98, 110, 98, 73.42, 87.31, 98, 110];
    const lead = [392, 392, 466.16, 523.25, 466.16, 392, 349.23, 392];
    const pulse = bass[step % bass.length];
    const note = lead[(step + Math.floor(step / 8)) % lead.length];

    this.musicTone(pulse, 0.28, "sawtooth", 0.034, pulse * 0.72);
    this.musicTone(pulse * 2, 0.12, "square", 0.012, pulse * 1.5, 0.02);
    if (step % 2 === 0) this.musicTone(note, 0.18, "triangle", 0.03, note * 1.02, 0.05);
    if (step % 4 === 3) this.musicTone(196, 0.08, "square", 0.016, 148, 0.1);
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFrequency = frequency,
    delay = 0,
  ) {
    const context = this.context;
    const master = this.sfxMaster;
    if (!context || !master) return;
    this.createTone(master, frequency, duration, type, volume, endFrequency, delay);
  }

  private musicTone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFrequency = frequency,
    delay = 0,
  ) {
    const master = this.musicMaster;
    if (!master) return;
    this.createTone(master, frequency, duration, type, volume, endFrequency, delay);
  }

  private createTone(
    master: GainNode,
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFrequency = frequency,
    delay = 0,
  ) {
    const context = this.context;
    if (!context) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
  }

  private noise(duration: number, volume: number, filterFrequency: number) {
    const context = this.context;
    const master = this.sfxMaster;
    if (!context || !master) return;

    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const start = context.currentTime;
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFrequency, start);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
    source.stop(start + duration + 0.02);
  }
}

function loadEnabled(key: string, fallback: boolean) {
  const saved = localStorage.getItem(key);
  if (saved === null) return fallback;
  return saved !== "0";
}

function loadVolume(key: string, fallback: number) {
  const value = localStorage.getItem(key);
  if (value === null) return fallback;
  const saved = Number(value);
  return Number.isFinite(saved) ? clampVolume(saved) : fallback;
}

function clampVolume(value: number) {
  return Math.max(0, Math.min(1, value));
}
