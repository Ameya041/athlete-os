'use client';
import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Card, Eyebrow, H2, Sub, inputCls, labelCls, btnCls, btnSecondary, btnGold, speak, ReadAloudButton } from './ui';

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

const PROMPT_TEMPLATE = `Training: I did ___ (gym / nets / conditioning) for ___ minutes, it felt like ___/10 effort.
Cricket: I batted for ___ / bowled ___ overs / fielded. It went ___.
Food: I had ___ for breakfast/lunch/dinner.
Sleep: I slept ___ hours, felt ___.
Body: ___ feels sore/tight, especially after ___. (leave blank if nothing)
Mood: I'm feeling ___/10 about things right now.`;

export default function AiLog({ dayLog, session, recentDays, reload, showToast }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [parsed, setParsed] = useState(null);
  const [assistantReply, setAssistantReply] = useState('');
  const [conversation, setConversation] = useState([]); // {role, content} turns for this entry
  const [recording, setRecording] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
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
    setStatus('Thinking...');
    const myText = text;
    try {
      const json = await authedFetch('/api/ai-log', { text: myText, history: conversation });
      setParsed(json.parsed);
      setAssistantReply(json.parsed?.assistantReply || '');
      setConversation((prev) => [...prev, { role: 'user', content: myText }, { role: 'assistant', content: json.raw || JSON.stringify(json.parsed) }]);
      setText('');
      setStatus('');
    } catch (e) {
      setStatus('Could not reach the AI — check your connection and try again.');
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
    setParsed(null); setAssistantReply(''); setConversation([]);
    showToast('Logged ✓');
    reload();
  }

  function discard() {
    setParsed(null); setAssistantReply(''); setConversation([]); setText('');
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
    parsed.nutrition?.length && ['Nutrition', parsed.nutrition.map((f) => `${f.item} — ${f.calories ?? '?'} kcal${f.estimated ? ' (estimated)' : ''}`)],
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
        <H2>{conversation.length ? 'Anything to add or correct?' : 'Tell me what happened'}</H2>
        <Sub>
          {conversation.length
            ? 'Reply below — I\u2019ll fold it into the same entry.'
            : 'Everything at once is fine: nets, gym, food, sleep, overs bowled, any pain, mood. I\u2019ll ask if anything needs clarifying.'}
        </Sub>

        {assistantReply && (
          <div className="bg-paperDim border border-seam/20 rounded-lg p-3 mb-3">
            <div className="font-mono text-[9px] uppercase text-seam mb-1">Athlete OS</div>
            <p className="font-serif text-sm leading-relaxed">{assistantReply}</p>
            <ReadAloudButton text={assistantReply} className="mt-1" />
          </div>
        )}

        <div className="flex gap-2 items-start">
          <textarea value={text} onChange={(e) => setText(e.target.value)}
            placeholder={conversation.length ? 'Type your answer...' : 'Type here, or tap the mic...'}
            className={`${inputCls} min-h-[80px]`} />
          <button onClick={toggleMic}
            className={`flex-none w-12 h-12 rounded-full border border-ink/15 flex items-center justify-center text-lg ${recording ? 'mic-rec' : 'bg-paperDim'}`}>🎙</button>
        </div>
        <button className={`${btnCls} w-full mt-3`} onClick={parseIt}>{conversation.length ? 'Send' : 'Parse & preview'}</button>
        {status && <p className="text-inkMuted text-xs mt-2 font-serif">{status}</p>}

        {!conversation.length && (
          <button className="font-mono text-[10px] text-inkMuted underline mt-3" onClick={() => setShowTemplate((s) => !s)}>
            {showTemplate ? 'Hide example' : 'Not sure what to say? See an example'}
          </button>
        )}
        {showTemplate && (
          <pre className="mt-2 bg-paperDim rounded-lg p-3 text-xs whitespace-pre-wrap leading-relaxed text-inkMuted">{PROMPT_TEMPLATE}</pre>
        )}
      </Card>

      {parsed && (
        <Card>
          <Eyebrow>Ready to save?</Eyebrow>
          <H2>Here's what I've got</H2>
          {previewSections.length === 0 && <Sub>Nothing structured detected yet — reply above with more detail.</Sub>}
          {previewSections.map(([title, lines]) => (
            <div key={title} className="mb-2">
              <div className={labelCls}>{title}</div>
              {lines.map((l, i) => <div key={i} className="text-sm py-1 border-b border-ink/10 font-serif">{l}</div>)}
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2.5 mt-2">
            <button className={btnCls} onClick={commit}>Save all to today</button>
            <button className={btnSecondary} onClick={discard}>Discard</button>
          </div>
        </Card>
      )}

      <Card>
        <Eyebrow>End of day</Eyebrow>
        <H2>Coach review</H2>
        <Sub>Reads today plus your recent trend and gives you one honest focus for tomorrow.</Sub>
        <button className={`${btnGold} w-full`} onClick={getReview} disabled={reviewLoading}>
          {reviewLoading ? 'Thinking…' : 'Review my day'}
        </button>
        {review && (
          <>
            <p className="font-serif text-sm mt-3 whitespace-pre-wrap leading-relaxed">{review}</p>
            <ReadAloudButton text={review} className="mt-2" />
          </>
        )}
      </Card>

      <Card>
        <Eyebrow>Ask anything</Eyebrow>
        <H2>Cricket knowledge</H2>
        <Sub>Training methods, skills, tactics, nutrition, recovery, mindset. For pain or injury questions it will point you to a professional.</Sub>
        <textarea className={inputCls} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. How do I add more overspin to my off-break?" />
        <button className={`${btnSecondary} w-full mt-2`} onClick={ask} disabled={qaLoading}>
          {qaLoading ? 'Thinking…' : 'Ask'}
        </button>
        {answer && (
          <>
            <p className="font-serif text-sm mt-3 whitespace-pre-wrap leading-relaxed">{answer}</p>
            <ReadAloudButton text={answer} className="mt-2" />
          </>
        )}
      </Card>
    </>
  );
}
