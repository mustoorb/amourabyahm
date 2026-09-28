// Ambient sound, synthesised with WebAudio — no audio files in the repo.
// A soft, slowly breathing pad plus tiny hover/open ticks. Off by default; the
// SOUND toggle turns it on (which is also the user gesture browsers require).

const KEY = 'amoura:sound';
let ctx = null;
let master = null;
let bed = null;
let on = false;

function store(v) {
  try { localStorage.setItem(KEY, v ? '1' : '0'); } catch {}
}
export function wanted() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  return ctx;
}

function startBed() {
  if (bed) return;
  const out = ctx.createGain();
  out.gain.value = 0.9;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  lp.Q.value = 0.4;
  out.connect(lp).connect(master);

  // A-major-add9 pad, detuned pairs for width.
  const notes = [110, 164.81, 220, 277.18, 329.63, 493.88];
  const nodes = [];
  notes.forEach((f, i) => {
    for (const det of [-5, 5]) {
      const o = ctx.createOscillator();
      o.type = i < 2 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = det + (Math.random() - 0.5) * 3;
      const g = ctx.createGain();
      g.gain.value = (i < 2 ? 0.05 : 0.018) / (1 + i * 0.25);
      // Each voice breathes on its own slow LFO.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.04 + Math.random() * 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = g.gain.value * 0.8;
      lfo.connect(lfoGain).connect(g.gain);
      o.connect(g).connect(out);
      o.start();
      lfo.start();
      nodes.push(o, lfo);
    }
  });

  // Very quiet filtered air.
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const nf = ctx.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = 500;
  nf.Q.value = 0.6;
  const ng = ctx.createGain();
  ng.gain.value = 0.05;
  noise.connect(nf).connect(ng).connect(out);
  noise.start();
  nodes.push(noise);

  bed = { out, nodes };
}

export function isOn() {
  return on;
}

export async function setOn(v) {
  on = !!v;
  store(on);
  if (on) {
    if (!ensureCtx()) return;
    if (ctx.state === 'suspended') await ctx.resume();
    startBed();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.55, ctx.currentTime, 1.2);
  } else if (ctx) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.35);
  }
  document.dispatchEvent(new CustomEvent('amoura:sound', { detail: on }));
}

function blip(freq, dur, gain, type = 'sine') {
  if (!on || !ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

let lastTick = 0;
/** Subtle hover tick. */
export function tick() {
  const now = performance.now();
  if (now - lastTick < 70) return;
  lastTick = now;
  blip(1850, 0.05, 0.035);
}

/** Soft two-tone bell for opening a story. */
export function chime() {
  blip(659.25, 1.3, 0.07);
  setTimeout(() => blip(987.77, 1.1, 0.045), 90);
}
