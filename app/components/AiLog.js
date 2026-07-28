'use client';
import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Card, Eyebrow, H2, Sub, inputCls, labelCls, btnCls, btnSecondary, btnGold } from './ui';

async function authedFetch(path, body) {
  const { data: { session: s } } = await supabase.auth.getSession();
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed');
  return json;
}

export default function AiLog({ dayLog, session, recentDays, reload, showToast }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [parsed, setParsed] = useState(null);
  const [recording, setRecording] = useState(false);
  const [review, setReview] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const recRef = useRef(null);

  function toggleMic() {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { showToast('Voice input not supported here'); return; }
    if (recording) { recRef.current?.stop(); setRecording(false); return; }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = false; rec.lang = 'en-IN';
    rec.onresult = (e) => {
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
      setText((prev) => (prev ? prev + ' ' : '') + t);
    };
    rec.onend = () => setRecording(false);
    rec.start();
    recRef.current = rec;
    setRecording(true);
  }

  async function parseIt() {
    if (!text.trim()) { showToast('Say or type something first'); return; }
    setStatus('Parsing...');
    try {
      const json = await authedFetch('/api/ai-log', { text });
      setParsed(json.parsed);
      setStatus('');
    } catch (e) {
      setStatus('Could not parse — check connection and try again.');
    }
  }

  async function commit() {
    if (!parsed) return;
    const uid = session.user.id;
    const inserts = [];
    (parsed.workout || []).forEach((w) =>
      inserts.push(supabase.from('workout_entries').insert({
        day_log_id: dayLog.id, user_id: uid, exercise: w.exercise, sets_reps: w.setsReps,
        weight_kg: w.weightKg, notes: w.notes, source: 'ai'
      })));
    (parsed.nutrition || []).forEach((f) =>
      inserts.push(supabase.from('food_entries').insert({
        day_log_id: dayLog.id, user_id: uid, item: f.item, calories: f.calories,
        protein_g: f.proteinG, carbs_g: f.carbsG, fat_g: f.fatG, source: 'ai'
      })));
    if (parsed.cricket && parsed.cricket.sessionType !== 'none') {
      inserts.push(supabase.from('cricket_entries').insert({
        day_log_id: dayLog.id, user_id: uid, session_type: parsed.cricket.sessionType,
        batting_notes: parsed.cricket.battingNotes, bowling_notes: parsed.cricket.bowlingNotes,
        fielding_notes: parsed.cricket.fieldingNotes, rating: parsed.cricket.rating,
        improvement_focus: parsed.cricket.improvementFocus, source: 'ai'
      }));
    }
    if (parsed.match && parsed.match.played) {
      inserts.push(supabase.from('match_entries').insert({
        day_log_id: dayLog.id, user_id: uid, opponent: parsed.match.opponent, format: parsed.match.format,
        runs: parsed.match.runs, balls: parsed.match.balls, dismissal: parsed.match.dismissal,
        overs_bowled: parsed.match.oversBowled, runs_conceded: parsed.match.runsConceded,
        wickets: parsed.match.wickets, catches: parsed.match.catches, conditions: parsed.match.conditions,
        notes: '', source: 'ai'
      }));
    }
    (parsed.niggles || []).forEach((n) =>
      inserts.push(supabase.from('niggle_entries').insert({
        day_log_id: dayLog.id, user_id: uid, body_area: n.bodyArea, severity: n.severity,
        description: n.description, worse_after: n.worseAfter, source: 'ai'
      })));
    if (parsed.mindset && (parsed.mindset.mood || parsed.mindset.notes)) {
      inserts.push(supabase.from('mindset_entries').insert({
        day_log_id: dayLog.id, user_id: uid, mood: parsed.mindset.mood,
        confidence: parsed.mindset.confidence, notes: parsed.mindset.notes, insight: '', source: 'ai'
      }));
    }
    const dayPatch = {};
    if (parsed.sessionRpe) dayPatch.session_rpe = parsed.sessionRpe;
    if (parsed.sessionMinutes) dayPatch.session_minutes = parsed.sessionMinutes;
    if (parsed.sleep?.hours) dayPatch.sleep_hours = parsed.sleep.hours;
    if (parsed.sleep?.quality) dayPatch.sleep_quality = parsed.sleep.quality;
    if (Object.keys(dayPatch).length) inserts.push(supabase.from('day_logs').update(dayPatch).eq('id', dayLog.id));

    await Promise.all(inserts);
    setText(''); setParsed(null);
    showToast('Logged ✓');
    reload();
  }

  async function getReview() {
    setReviewLoading(true);
    setReview('');
    try {
      const json = await authedFetch('/api/ai-review', { mode: 'review', summary: { today: dayLog, recentDays } });
      setReview(json.text);
    } catch (e) {
      setReview('Could not load the review — try again in a moment.');
    } finally {
      setReviewLoading(false);
    }
  }

  async function ask() {
    if (!question.trim()) return;
    setQaLoading(true);
    setAnswer('');
    try {
      const json = await authedFetch('/api/ai-review', { mode: 'qa', question });
      setAnswer(json.text);
    } catch (e) {
      setAnswer('Could not get an answer — try again in a moment.');
    } finally {
      setQaLoading(false);
    }
  }

  const previewSections = parsed ? [
    parsed.workout?.length && ['Workout', parsed.workout.map((w) => `${w.exercise} — ${w.setsReps || ''} ${w.weightKg ? w.weightKg + 'kg' : ''}`)],
    parsed.sessionRpe && ['Session effort', [`RPE ${parsed.sessionRpe}/10${parsed.sessionMinutes ? ` · ${parsed.sessionMinutes} min` : ''}`]],
    parsed.nutrition?.length && ['Nutrition', parsed.nutrition.map((f) => `${f.item} — ${f.calories ?? '?'} kcal`)],
    (parsed.sleep?.hours || parsed.sleep?.quality) && ['Sleep', [`${parsed.sleep.hours ?? '?'}h · quality ${parsed.sleep.quality ?? '?'}/5`]],
    parsed.cricket?.sessionType !== 'none' && ['Cricket', [parsed.cricket.battingNotes, parsed.cricket.bowlingNotes, parsed.cricket.fieldingNotes, parsed.cricket.oversBowled ? `${parsed.cricket.oversBowled} overs bowled` : ''].filter(Boolean)],
    parsed.match?.played && ['Match', [`vs ${parsed.match.opponent || '?'} · ${parsed.match.runs ?? '-'}(${parsed.match.balls ?? '-'})${parsed.match.wickets != null ? ` · ${parsed.match.wickets}w` : ''}`]],
    parsed.niggles?.length && ['Niggles', parsed.niggles.map((n) => `${n.bodyArea} — ${n.severity ?? '?'}/10${n.worseAfter ? ` (after ${n.worseAfter})` : ''}`)],
    (parsed.mindset?.mood || parsed.mindset?.notes) && ['Mindset', [`Mood ${parsed.mindset.mood ?? '–'}/10 · Confidence ${parsed.mindset.confidence ?? '–'}/10`, parsed.mindset.notes].filter(Boolean)]
  ].filter(Boolean) : [];

  return (
    <>
      <Card>
        <Eyebrow>Speak or type your day</Eyebrow>
        <H2>Tell me what happened</H2>
        <Sub>Everything at once is fine: nets, gym, food, sleep, overs bowled, any pain, mood. I will sort it.</Sub>
        <div className="flex gap-2 items-start">
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type here, or tap the mic..." className={`${inputCls} min-h-[90px]`} />
          <button onClick={toggleMic}
            className={`flex-none w-12 h-12 rounded-full border border-ink/15 flex items-center justify-center text-lg ${recording ? 'mic-rec' : 'bg-white'}`}>🎙</button>
        </div>
        <button className={`${btnCls} w-full mt-3`} onClick={parseIt}>Parse & preview</button>
        {status && <p className="text-inkMuted text-xs mt-2 font-serif">{status}</p>}
      </Card>

      {parsed && (
        <Card>
          <Eyebrow>Preview — save when ready</Eyebrow>
          <H2>Parsed entry</H2>
          {previewSections.length === 0 && <Sub>Nothing structured detected in that note.</Sub>}
          {previewSections.map(([title, lines]) => (
            <div key={title} className="mb-2">
              <div className={labelCls}>{title}</div>
              {lines.map((l, i) => <div key={i} className="text-sm py-1 border-b border-ink/10 font-serif">{l}</div>)}
            </div>
          ))}
          <button className={`${btnCls} w-full mt-2`} onClick={commit}>Save all to today</button>
        </Card>
      )}

      <Card>
        <Eyebrow>End of day</Eyebrow>
        <H2>Coach review</H2>
        <Sub>Reads today plus your recent trend and gives you one honest focus for tomorrow.</Sub>
        <button className={`${btnGold} w-full`} onClick={getReview} disabled={reviewLoading}>
          {reviewLoading ? 'Thinking…' : 'Review my day'}
        </button>
        {review && <p className="font-serif text-sm mt-3 whitespace-pre-wrap leading-relaxed">{review}</p>}
      </Card>

      <Card>
        <Eyebrow>Ask anything</Eyebrow>
        <H2>Cricket knowledge</H2>
        <Sub>Training methods, skills, tactics, nutrition, recovery, mindset. For pain or injury questions it will point you to a professional.</Sub>
        <textarea className={inputCls} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. How do I add more overspin to my off-break?" />
        <button className={`${btnSecondary} w-full mt-2`} onClick={ask} disabled={qaLoading}>
          {qaLoading ? 'Thinking…' : 'Ask'}
        </button>
        {answer && <p className="font-serif text-sm mt-3 whitespace-pre-wrap leading-relaxed">{answer}</p>}
      </Card>
    </>
  );
}
