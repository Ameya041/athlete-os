'use client';
import { useEffect, useRef, useState } from 'react';

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-paper text-ink rounded-xl border border-white/8 p-5 mb-4 ${className}`}>
      {children}
    </div>
  );
}
export function Eyebrow({ children }) {
  return <span className="block font-mono text-[10px] uppercase tracking-wider text-seam mb-1.5">{children}</span>;
}
export function Empty({ children }) {
  return <div className="text-inkMuted text-sm italic py-2">{children}</div>;
}
export function H2({ children }) {
  return <h2 className="font-display font-extrabold text-2xl leading-tight tracking-tight">{children}</h2>;
}
export function Sub({ children }) {
  return <p className="text-inkMuted text-sm mb-2 mt-1 leading-relaxed">{children}</p>;
}

export function FlipTile({ value, caption, size = 'text-2xl' }) {
  const [flipping, setFlipping] = useState(false);
  const prevValue = useRef(value);
  useEffect(() => {
    if (prevValue.current !== value) {
      setFlipping(true);
      const t = setTimeout(() => setFlipping(false), 400);
      prevValue.current = value;
      return () => clearTimeout(t);
    }
  }, [value]);
  return (
    <div className={`flip-tile px-2 py-2.5 text-center ${flipping ? 'is-flipping' : ''}`}>
      <div className={`digit ${size}`}>{value}</div>
      <div className="caption text-[8px] mt-0.5">{caption}</div>
    </div>
  );
}

/* tiny dependency-free sparkline for trends */
export function Sparkline({ points, height = 42, stroke = '#22C55E' }) {
  const vals = points.filter((p) => p != null && !isNaN(p));
  if (vals.length < 2) return <div className="text-inkMuted text-xs font-serif italic">Not enough data yet.</div>;
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const w = 100;
  const step = w / (points.length - 1);
  let d = '';
  points.forEach((p, i) => {
    if (p == null || isNaN(p)) return;
    const x = i * step;
    const y = height - 4 - ((p - min) / range) * (height - 8);
    d += (d ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  });
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }}>
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const inputCls = 'w-full bg-paperDim border border-white/10 rounded-lg px-3 py-2.5 text-ink text-base font-body placeholder:text-muted2 focus:outline-none focus:border-seam/50';
export const labelCls = 'block font-mono text-[10px] uppercase tracking-wide text-inkMuted mt-2.5 mb-1';
export const btnCls = 'bg-seam text-bg font-semibold rounded-lg py-3 px-4 text-base transition-transform active:scale-[0.97] hover:bg-seamDim';
export const btnSecondary = 'bg-transparent border border-white/15 text-ink font-semibold rounded-lg py-3 px-4 text-base transition-transform active:scale-[0.97] hover:border-white/30';
export const btnGold = 'bg-willow text-bg font-semibold rounded-lg py-3 px-4 text-base transition-transform active:scale-[0.97]';

/* Free, built-in browser text-to-speech — no API key, no cost. Used for meditation cues and reading the AI coach review aloud. */
export function speak(text, opts = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  window.speechSynthesis.cancel(); // don't let cues overlap
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = opts.rate || 0.95;
  utter.pitch = opts.pitch || 1;
  if (opts.onEnd) utter.onend = opts.onEnd;
  if (opts.onEnd) utter.onerror = opts.onEnd;
  window.speechSynthesis.speak(utter);
  return utter;
}
export function stopSpeaking() {
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
}

/* A read-aloud button that actually toggles to a working Stop control once playback starts — previously
   there was no way to stop a read-aloud once it began. */
export function ReadAloudButton({ text, className = '' }) {
  const [speaking, setSpeaking] = useState(false);
  function toggle() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(text, { onEnd: () => setSpeaking(false) });
  }
  return (
    <button className={`font-mono text-[10px] text-inkMuted underline ${className}`} onClick={toggle}>
      {speaking ? '⏹ Stop' : '🔊 Read aloud'}
    </button>
  );
}
