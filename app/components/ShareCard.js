'use client';
import { btnGold } from './ui';

// Renders a shareable "week card" PNG entirely client-side via canvas — no server, no cost.
export function generateShareCard({ name, streak, sessions, matches, runs, wickets, meditationMin }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext('2d');

  // turf background with a faint pitch-line texture
  ctx.fillStyle = '#10241C';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(244,239,225,0.04)';
  for (let y = 40; y < canvas.height; y += 42) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  // header
  ctx.fillStyle = '#F1ECDE';
  ctx.font = '800 64px "Arial Black", sans-serif';
  ctx.fillText('ATHLETE', 60, 130);
  ctx.fillStyle = '#AE3529';
  ctx.fillText('OS', 340, 130);

  ctx.fillStyle = '#93A69B';
  ctx.font = '28px monospace';
  ctx.fillText(`${name}'s week`, 60, 175);

  // paper card
  const pad = 60, cardY = 230, cardH = 900;
  ctx.fillStyle = '#F4EFE1';
  roundRect(ctx, pad, cardY, canvas.width - pad * 2, cardH, 24); ctx.fill();

  const stats = [
    ['STREAK', `${streak} days`],
    ['SESSIONS LOGGED', `${sessions}`],
    ['MATCHES', `${matches}`],
    ['RUNS', `${runs}`],
    ['WICKETS', `${wickets}`],
    ['MEDITATION', `${meditationMin} min`]
  ];
  let y = cardY + 100;
  stats.forEach(([label, val], i) => {
    ctx.fillStyle = '#7A6F5C';
    ctx.font = '24px monospace';
    ctx.fillText(label, pad + 60, y);
    ctx.fillStyle = '#202D26';
    ctx.font = '800 72px "Arial Black", sans-serif';
    ctx.fillText(val, pad + 60, y + 80);
    y += 140;
  });

  ctx.fillStyle = '#AE3529';
  ctx.font = '600 26px monospace';
  ctx.fillText('ATHLETEOS.APP', pad + 60, cardY + cardH - 40);

  return canvas.toDataURL('image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default function ShareCardButton({ data }) {
  function download() {
    const url = generateShareCard(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-week-athleteos.png';
    a.click();
  }
  return <button className={`${btnGold} w-full`} onClick={download}>📸 Generate my week card</button>;
}
