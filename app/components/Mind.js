'use client';
import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Card, Eyebrow, Empty, H2, Sub, inputCls, labelCls, btnCls, btnSecondary, btnGold } from './ui';
import { MEDITATIONS } from '../../lib/program';

export default function Mind({ dayLog, mindset, updateDayLog, reload, showToast }) {
  const [view, setView] = useState('checkin');
  return (
    <>
      <div className="flex gap-2 mb-3">
        <button className={`${view === 'checkin' ? btnCls : btnSecondary} flex-1`} onClick={() => setView('checkin')}>Check in</button>
        <button className={`${view === 'meditate' ? btnCls : btnSecondary} flex-1`} onClick={() => setView('meditate')}>Meditate</button>
      </div>
      {view === 'checkin'
        ? <CheckIn dayLog={dayLog} mindset={mindset} reload={reload} showToast={showToast} setView={setView} />
        : <Meditate dayLog={dayLog} updateDayLog={updateDayLog} showToast={showToast} />}
    </>
  );
}

function CheckIn({ dayLog, mindset, reload, showToast, setView }) {
  const [mood, setMood] = useState(6);
  const [confidence, setConfidence] = useState(6);
  const [pressure, setPressure] = useState(4);
  const [notes, setNotes] = useState('');

  async function save() {
    let insight = '';
    if (pressure >= 7) insight = 'High pressure noted — a short breathing session before your next net can reset the nervous system.';
    else if (confidence <= 4) insight = 'Low confidence day — before you sleep, name one thing that went right today, however small.';
    else if (mood >= 8) insight = 'Good headspace — a great day to work on the technical detail you have been avoiding.';
    await supabase.from('mindset_entries').insert({ day_log_id: dayLog.id, mood, confidence, pressure, notes, insight, source: 'manual' });
    setNotes('');
    showToast('Check-in saved ✓');
    reload();
  }
  async function remove(id) { await supabase.from('mindset_entries').delete().eq('id', id); reload(); }

  return (
    <>
      <Card>
        <Eyebrow>Check in</Eyebrow>
        <H2>How&apos;s your headspace?</H2>
        <label className={labelCls}>Mood: <span className="text-seam font-bold">{mood}</span>/10</label>
        <input type="range" min="1" max="10" value={mood} onChange={(e) => setMood(Number(e.target.value))} className="w-full accent-seam" />
        <label className={labelCls}>Confidence: <span className="text-seam font-bold">{confidence}</span>/10</label>
        <input type="range" min="1" max="10" value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-full accent-seam" />
        <label className={labelCls}>Pressure / anxiety: <span className="text-seam font-bold">{pressure}</span>/10</label>
        <input type="range" min="1" max="10" value={pressure} onChange={(e) => setPressure(Number(e.target.value))} className="w-full accent-seam" />
        <label className={labelCls}>Journal</label>
        <textarea className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What's on your mind after today?" />
        <button className={`${btnCls} w-full mt-3`} onClick={save}>Save check-in</button>
      </Card>

      <Card>
        <Eyebrow>Today&apos;s entries</Eyebrow>
        {mindset.length === 0 ? <Empty>No check-ins yet.</Empty> : mindset.map((m) => (
          <div key={m.id} className="py-2 border-b border-ink/10 last:border-0 text-sm font-serif">
            <div className="flex justify-between">
              <span>Mood {m.mood ?? '–'}/10 · Confidence {m.confidence ?? '–'}/10</span>
              <span className="font-mono text-xs text-seam" onClick={() => remove(m.id)}>remove</span>
            </div>
            {m.notes && <div>{m.notes}</div>}
            {m.insight && <div className="text-seam italic mt-1">{m.insight}</div>}
          </div>
        ))}
      </Card>

      <Card>
        <Eyebrow>Feeling wound up?</Eyebrow>
        <button className={`${btnGold} w-full`} onClick={() => setView('meditate')}>Go to meditation</button>
      </Card>
    </>
  );
}

function Meditate({ dayLog, updateDayLog, showToast }) {
  const [med, setMed] = useState(MEDITATIONS[0]);
  const [duration, setDuration] = useState(MEDITATIONS[0].durations[1] || MEDITATIONS[0].durations[0]);
  const [running, setRunning] = useState(false);
  const [label, setLabel] = useState('');
  const [phase, setPhase] = useState('Ready');
  const ringRef = useRef(null);
  const timerRef = useRef(null);
  const secondsRef = useRef(0);

  function breathCycle() {
    setPhase('Inhale');
    if (ringRef.current) ringRef.current.style.transform = 'scale(1.15)';
    setTimeout(() => setPhase('Hold'), 4000);
    setTimeout(() => {
      setPhase('Exhale');
      if (ringRef.current) ringRef.current.style.transform = 'scale(1)';
    }, 8000);
  }

  function start() {
    stop();
    secondsRef.current = duration * 60;
    setRunning(true);
    if (med.id === 'breath') breathCycle(); else setPhase(med.name);
    timerRef.current = setInterval(() => {
      secondsRef.current -= 1;
      if (med.id === 'breath' && secondsRef.current % 14 === 0) breathCycle();
      const m = String(Math.floor(secondsRef.current / 60)).padStart(2, '0');
      const s = String(secondsRef.current % 60).padStart(2, '0');
      setLabel(`${m}:${s} remaining`);
      if (secondsRef.current <= 0) {
        stop();
        setPhase('Done');
        finish();
      }
    }, 1000);
  }
  function stop() { clearInterval(timerRef.current); setRunning(false); }

  async function finish() {
    const total = (dayLog.meditation_minutes || 0) + duration;
    await updateDayLog({ meditation_minutes: total, meditation_type: med.id, meditation_done: true });
    showToast(`${duration} min logged ✓`);
  }

  return (
    <>
      <Card>
        <Eyebrow>Choose a practice</Eyebrow>
        <H2>Meditation</H2>
        {MEDITATIONS.map((m) => (
          <div key={m.id}
            onClick={() => { setMed(m); setDuration(m.durations[0]); }}
            className={`py-2.5 px-3 rounded-lg mb-2 border cursor-pointer ${med.id === m.id ? 'border-seam bg-white' : 'border-ink/10 bg-white/50'}`}>
            <div className="font-semibold text-sm">{m.name}</div>
            <div className="font-serif italic text-inkMuted text-xs">{m.desc}</div>
          </div>
        ))}
        <label className={labelCls}>Duration</label>
        <div className="flex gap-2">
          {med.durations.map((d) => (
            <button key={d} onClick={() => setDuration(d)}
              className={`flex-1 rounded-lg py-2.5 font-display font-bold text-lg border ${duration === d ? 'bg-seam text-paper border-seam' : 'bg-white border-ink/15'}`}>
              {d}m
            </button>
          ))}
        </div>
      </Card>

      <Card className="text-center">
        <Eyebrow>{med.name} · {duration} min</Eyebrow>
        <div ref={ringRef}
          className="w-44 h-44 rounded-full border-2 border-seam mx-auto my-5 flex items-center justify-center transition-transform duration-[4000ms] ease-in-out">
          <div className="font-display font-bold text-lg tracking-wide px-4">{phase}</div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <button className={btnCls} onClick={start}>{running ? 'Restart' : 'Start'}</button>
          <button className={btnSecondary} onClick={stop}>Stop</button>
        </div>
        {label && <div className="font-mono text-inkMuted text-sm mt-3">{label}</div>}
        <div className="font-mono text-xs text-inkMuted mt-3">
          {dayLog.meditation_minutes ? `${dayLog.meditation_minutes} min meditated today` : 'Nothing logged today yet'}
        </div>
      </Card>
    </>
  );
}
