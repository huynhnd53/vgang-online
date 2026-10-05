/**
 * Small synthesised sound set (no audio files): engine hum, horn, blinker tick and bumps.
 * Browsers only allow audio after a user gesture, so call unlock() from an input handler.
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private horn: { oscs: OscillatorNode[]; gain: GainNode } | null = null;
  muted = false;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  /** Starts or stops the idle/engine loop. */
  setEngine(on: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (on && !this.engine) {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc2.type = 'square';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(0.07, ctx.currentTime, 0.15);
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      osc.frequency.value = 34;
      osc2.frequency.value = 17;
      osc.start();
      osc2.start();
      this.engine = { osc, osc2, gain, filter };
      this.burst(0.25, 900, 0.12);
    } else if (!on && this.engine) {
      const e = this.engine;
      e.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
      e.osc.stop(ctx.currentTime + 0.6);
      e.osc2.stop(ctx.currentTime + 0.6);
      this.engine = null;
    }
  }

  /** speed in m/s, throttle 0..1. */
  updateEngine(speed: number, throttle: number): void {
    const ctx = this.ctx;
    const e = this.engine;
    if (!ctx || !e) return;
    const f = 34 + Math.abs(speed) * 4.2 + throttle * 14;
    e.osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
    e.osc2.frequency.setTargetAtTime(f / 2, ctx.currentTime, 0.08);
    e.filter.frequency.setTargetAtTime(380 + throttle * 500 + Math.abs(speed) * 25, ctx.currentTime, 0.1);
    e.gain.gain.setTargetAtTime(0.06 + throttle * 0.04, ctx.currentTime, 0.1);
  }

  hornOn(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.horn) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.09, ctx.currentTime, 0.01);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.8;
    const oscs = [415, 520].map((freq) => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = freq;
      o.connect(filter);
      o.start();
      return o;
    });
    filter.connect(gain);
    gain.connect(this.master);
    this.horn = { oscs, gain };
  }

  hornOff(): void {
    const ctx = this.ctx;
    const h = this.horn;
    if (!ctx || !h) return;
    h.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    for (const o of h.oscs) o.stop(ctx.currentTime + 0.2);
    this.horn = null;
  }

  tick(high: boolean): void {
    this.blip(high ? 2200 : 1700, 0.018, 0.05);
  }

  bump(strength: number): void {
    this.burst(0.18, 220, Math.min(0.3, 0.06 + strength * 0.03));
  }

  private blip(freq: number, dur: number, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  private burst(dur: number, cutoff: number, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
  }
}
