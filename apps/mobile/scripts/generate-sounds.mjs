// Generates Wake's bundled alarm sounds as 16-bit PCM WAV files.
// Everything here is synthesised (no samples, no copyrighted material).
// Run: node scripts/generate-sounds.mjs  → assets/sounds/*.wav, then `npm run sync:sounds`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'assets', 'sounds');
mkdirSync(outDir, { recursive: true });

const SR = 22050;

function wav(samples) {
  const pcm = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const seconds = (s) => Math.floor(s * SR);
const buf = (s) => new Float64Array(seconds(s));

function tone(out, { start, dur, freq, gain = 0.5, attack = 0.01, release = 0.1, harmonics = [1], wave = 'sine', sweepTo }) {
  const s0 = seconds(start);
  const n = seconds(dur);
  for (let i = 0; i < n && s0 + i < out.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / attack) * Math.min(1, (dur - t) / release);
    const f = sweepTo ? freq + (sweepTo - freq) * (t / dur) : freq;
    let v = 0;
    harmonics.forEach((h, k) => {
      const ph = 2 * Math.PI * f * h * t;
      const w = wave === 'square' ? Math.sign(Math.sin(ph)) : Math.sin(ph);
      v += w / (k + 1);
    });
    out[s0 + i] += v * env * gain;
  }
}

function pluck(out, { start, freq, gain = 0.5, decay = 1.2 }) {
  const s0 = seconds(start);
  const n = seconds(decay * 1.5);
  for (let i = 0; i < n && s0 + i < out.length; i++) {
    const t = i / SR;
    const env = Math.exp(-t / (decay / 3)) * Math.min(1, t / 0.004);
    const v =
      Math.sin(2 * Math.PI * freq * t) +
      0.5 * Math.sin(2 * Math.PI * freq * 2 * t) * Math.exp(-t * 2) +
      0.25 * Math.sin(2 * Math.PI * freq * 3 * t) * Math.exp(-t * 4);
    out[s0 + i] += v * env * gain;
  }
}

function normalize(out, peak = 0.9) {
  let max = 0;
  for (const v of out) max = Math.max(max, Math.abs(v));
  if (max === 0) return out;
  for (let i = 0; i < out.length; i++) out[i] = (out[i] / max) * peak;
  return out;
}

// Deterministic pseudo-random so the files are reproducible.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

// 1. Classic — insistent double beeps, 4 s loop.
{
  const out = buf(4);
  for (let rep = 0; rep < 2; rep++) {
    for (let k = 0; k < 4; k++) {
      tone(out, { start: rep * 2 + k * 0.18, dur: 0.12, freq: 1046.5, gain: 0.6, attack: 0.004, release: 0.02, harmonics: [1, 2] });
    }
  }
  writeFileSync(join(outDir, 'wake_classic.wav'), wav(normalize(out)));
}

// 2. Soft — slow sine pad chords, 8 s.
{
  const out = buf(8);
  const chords = [
    [261.63, 329.63, 392.0],
    [293.66, 369.99, 440.0],
    [329.63, 415.3, 493.88],
    [261.63, 329.63, 392.0],
  ];
  chords.forEach((chord, i) => {
    chord.forEach((f) => tone(out, { start: i * 2, dur: 2.2, freq: f, gain: 0.18, attack: 0.8, release: 0.9, harmonics: [1, 0.5] }));
  });
  writeFileSync(join(outDir, 'wake_soft.wav'), wav(normalize(out, 0.7)));
}

// 3. Sunrise — rising arpeggio with shimmer, 8 s.
{
  const out = buf(8);
  const scale = [392.0, 440.0, 493.88, 587.33, 659.25, 783.99, 880.0, 987.77];
  for (let i = 0; i < 16; i++) {
    const f = scale[i % scale.length] * (i >= 8 ? 2 : 1);
    tone(out, { start: i * 0.45, dur: 1.4, freq: f, gain: 0.25, attack: 0.05, release: 0.8, harmonics: [1, 0.3] });
  }
  tone(out, { start: 0, dur: 8, freq: 196.0, gain: 0.08, attack: 2, release: 2, harmonics: [1] });
  writeFileSync(join(outDir, 'wake_sunrise.wav'), wav(normalize(out, 0.8)));
}

// 4. Piano — plucked melody, 8 s.
{
  const out = buf(8);
  const melody = [523.25, 659.25, 783.99, 659.25, 523.25, 587.33, 698.46, 587.33, 523.25, 659.25, 880.0, 783.99, 659.25, 587.33, 523.25];
  melody.forEach((f, i) => pluck(out, { start: i * 0.5, freq: f, gain: 0.45, decay: 1.4 }));
  melody.forEach((f, i) => (i % 2 === 0 ? pluck(out, { start: i * 0.5, freq: f / 2, gain: 0.25, decay: 1.8 }) : null));
  writeFileSync(join(outDir, 'wake_piano.wav'), wav(normalize(out, 0.85)));
}

// 5. Birds — chirp sweeps, 8 s.
{
  const out = buf(8);
  let t = 0.2;
  while (t < 7.4) {
    const chirps = 2 + Math.floor(rand() * 4);
    const base = 2200 + rand() * 1500;
    for (let c = 0; c < chirps; c++) {
      tone(out, { start: t + c * 0.11, dur: 0.08, freq: base, sweepTo: base + 600 + rand() * 800, gain: 0.35, attack: 0.01, release: 0.03 });
    }
    t += 0.7 + rand() * 0.9;
  }
  writeFileSync(join(outDir, 'wake_birds.wav'), wav(normalize(out, 0.75)));
}

console.log('Generated sounds in', outDir);
