'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { PREHAB, CORE_CIRCUIT, todayISO, fmtDate, computeMacros, DEFAULT_PROFILE, PLAYER_ROLES, roleMetricFields, checkMindsetGate, DEFAULT_TEMPLATE_ITEMS } from '../lib/program';

const TABS = [
  { id: 'dashboard', label: 'Today' },
  { id: 'ailog', label: 'AI Log' },
  { id: 'workout', label: 'Workout' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'cricket', label: 'Cricket' },
  { id: 'mindset', label: 'Mindset' },
  { id: 'meditate', label: 'Meditate' }
];

export default function App() {
  const router = useRouter();
  const [session, setSession] = useState(undefined); // undefined = loading, null = logged out
  const [tab, setTab] = useState('dashboard');
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [dayLog, setDayLog] = useState(null);
  const [workout, setWorkout] = useState([]);
  const [food, setFood] = useState([]);
  const [cricket, setCricket] = useState([]);
  const [mindset, setMindset] = useState([]);
  const [template, setTemplate] = useState(null);
  const [templateItems, setTemplateItems] = useState([]);
  const [toastMsg, setToastMsg] = useState('');
  const iso = todayISO();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) router.push('/login');
  }, [session, router]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 1800);
  };

  async function seedTemplatesIfNeeded(uid) {
    const inserts = [];
    for (let dow = 0; dow <= 6; dow++) {
      const def = DEFAULT_TEMPLATE_ITEMS[dow];
      const { data: tmpl } = await supabase
        .from('workout_templates')
        .insert({ user_id: uid, day_of_week: dow, title: def.title, subtitle: def.subtitle, session_type: def.session_type, core_circuit: def.core_circuit })
        .select()
        .single();
      if (tmpl) {
        def.items.forEach((it, i) => inserts.push(
          supabase.from('template_items').insert({ template_id: tmpl.id, item_type: it.item_type, name: it.name, target: it.target || null, sort_order: i })
        ));
      }
    }
    await Promise.all(inserts);
  }

  const loadTemplate = useCallback(async (uid) => {
    const dow = new Date().getDay();
    let { data: tmpl } = await supabase.from('workout_templates').select('*').eq('user_id', uid).eq('day_of_week', dow).maybeSingle();
    if (!tmpl) return { tmpl: null, items: [] };
    const { data: items } = await supabase.from('template_items').select('*').eq('template_id', tmpl.id).order('sort_order');
    return { tmpl, items: items || [] };
  }, []);

  const loadEverything = useCallback(async () => {
    if (!session?.user) return;
    const uid = session.user.id;

    let { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (!prof) {
      const insertRes = await supabase.from('profiles').insert({ id: uid, ...DEFAULT_PROFILE }).select().single();
      prof = insertRes.data;
    }
    setProfile(prof || DEFAULT_PROFILE);

    if (prof && !prof.templates_seeded) {
      await seedTemplatesIfNeeded(uid);
      await supabase.from('profiles').update({ templates_seeded: true }).eq('id', uid);
    }
    const { tmpl, items } = await loadTemplate(uid);
    setTemplate(tmpl);
    setTemplateItems(items);

    let { data: day } = await supabase.from('day_logs').select('*').eq('user_id', uid).eq('log_date', iso).maybeSingle();
    if (!day) {
      const insertRes = await supabase
        .from('day_logs')
        .insert({ user_id: uid, log_date: iso, prehab_done: false, meditation_done: false })
        .select()
        .single();
      day = insertRes.data;
    }
    setDayLog(day);

    const [w, f, c, m] = await Promise.all([
      supabase.from('workout_entries').select('*').eq('day_log_id', day.id).order('created_at'),
      supabase.from('food_entries').select('*').eq('day_log_id', day.id).order('created_at'),
      supabase.from('cricket_entries').select('*').eq('day_log_id', day.id).order('created_at'),
      supabase.from('mindset_entries').select('*').eq('day_log_id', day.id).order('created_at')
    ]);
    setWorkout(w.data || []);
    setFood(f.data || []);
    setCricket(c.data || []);
    setMindset(m.data || []);
  }, [session, iso]);

  useEffect(() => {
    if (session?.user) loadEverything();
  }, [session, loadEverything]);

  if (session === undefined) return <div className="min-h-screen flex items-center justify-center text-muted">Loading...</div>;
  if (session === null) return null;

  async function updateDayLog(patch) {
    const { data } = await supabase.from('day_logs').update(patch).eq('id', dayLog.id).select().single();
    setDayLog(data);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="max-w-xl mx-auto min-h-screen pb-24 relative">
      <div className="sticky top-0 z-20 px-4 pt-5 pb-3 bg-gradient-to-b from-bg to-transparent">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-3xl">
            ATHLETE<span className="text-seam">OS</span>
          </h1>
          <div className="text-right">
            <div className="font-mono text-xs text-muted">{fmtDate(iso).toUpperCase()}</div>
            <button onClick={signOut} className="font-mono text-[10px] text-muted underline">sign out</button>
          </div>
        </div>
        <div className="seam-rule mt-3" />
        <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-none font-mono text-[11px] uppercase tracking-wide px-3 py-2 rounded-lg border whitespace-nowrap ${
                tab === t.id ? 'bg-seam border-seam text-cream' : 'bg-bgElev border-white/10 text-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="px-4">
        {tab === 'dashboard' && dayLog && (
          <Dashboard dayLog={dayLog} workout={workout} food={food} template={template} updateDayLog={updateDayLog} setTab={setTab} />
        )}
        {tab === 'ailog' && dayLog && (
          <AiLog dayLogId={dayLog.id} session={session} profile={profile} reload={loadEverything} showToast={showToast} setTab={setTab} />
        )}
        {tab === 'workout' && dayLog && (
          <Workout dayLogId={dayLog.id} workout={workout} template={template} templateItems={templateItems} reload={loadEverything} showToast={showToast} />
        )}
        {tab === 'nutrition' && dayLog && (
          <Nutrition dayLog={dayLog} food={food} profile={profile} setProfile={setProfile} userId={session.user.id}
            updateDayLog={updateDayLog} reload={loadEverything} showToast={showToast} />
        )}
        {tab === 'cricket' && dayLog && (
          <Cricket dayLogId={dayLog.id} cricket={cricket} profile={profile} reload={loadEverything} showToast={showToast} setTab={setTab} />
        )}
        {tab === 'mindset' && dayLog && (
          <Mindset dayLogId={dayLog.id} mindset={mindset} reload={loadEverything} showToast={showToast} setTab={setTab} />
        )}
        {tab === 'meditate' && dayLog && (
          <Meditate dayLog={dayLog} updateDayLog={updateDayLog} showToast={showToast} />
        )}
      </main>

      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-cream text-bg text-xs font-bold px-4 py-2 rounded-full z-50">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

/* ---------------- shared bits ---------------- */
function Card({ children, className = '' }) {
  return <div className={`bg-bgElev border border-white/10 rounded-2xl p-4 mb-3.5 ${className}`}>{children}</div>;
}
function Eyebrow({ children }) {
  return <span className="block font-mono text-[10px] uppercase tracking-wider text-willow mb-1.5">{children}</span>;
}
function Empty({ children }) {
  return <div className="text-muted2 text-sm italic py-2">{children}</div>;
}
const inputCls = 'w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-cream text-sm';
const labelCls = 'block font-mono text-[10px] uppercase tracking-wide text-muted mt-2.5 mb-1';
const btnCls = 'bg-seam text-cream font-bold rounded-lg py-2.5 px-4 text-sm';
const btnSecondary = 'bg-transparent border border-white/10 text-cream font-bold rounded-lg py-2.5 px-4 text-sm';
const btnGold = 'bg-willow text-bg font-bold rounded-lg py-2.5 px-4 text-sm';

/* ---------------- Dashboard ---------------- */
function Dashboard({ dayLog, workout, food, template, updateDayLog, setTab }) {
  const kcal = food.reduce((s, f) => s + (f.calories || 0), 0);
  return (
    <>
      <Card>
        <Eyebrow>{template?.session_type || '—'}</Eyebrow>
        <h2 className="font-display text-2xl">{template?.title || 'No session set'}</h2>
        <p className="text-muted text-sm mb-3">{template?.subtitle || ''}</p>
        <div className="grid grid-cols-3 gap-2.5 mt-2">
          <div className="bg-bgElev2 rounded-xl p-2.5 text-center">
            <div className="font-display text-2xl text-seam">{workout.length}</div>
            <div className="font-mono text-[9px] text-muted uppercase">Sets logged</div>
          </div>
          <div className="bg-bgElev2 rounded-xl p-2.5 text-center">
            <div className="font-display text-2xl text-seam">{dayLog.morning_weight_kg ?? '–'}</div>
            <div className="font-mono text-[9px] text-muted uppercase">Weight kg</div>
          </div>
          <div className="bg-bgElev2 rounded-xl p-2.5 text-center">
            <div className="font-display text-2xl text-seam">{kcal}</div>
            <div className="font-mono text-[9px] text-muted uppercase">Kcal today</div>
          </div>
        </div>
      </Card>
      <Card>
        <Eyebrow>Daily prehab — before gym / nets</Eyebrow>
        {PREHAB.map((p, i) => (
          <div key={i} className="text-sm py-1.5 border-b border-white/10 last:border-0">{p}</div>
        ))}
        <button
          className={`${dayLog.prehab_done ? btnSecondary : btnCls} w-full mt-3`}
          onClick={() => updateDayLog({ prehab_done: !dayLog.prehab_done })}
        >
          {dayLog.prehab_done ? 'Prehab done ✓' : 'Mark prehab done'}
        </button>
      </Card>
      <Card>
        <Eyebrow>Quick actions</Eyebrow>
        <div className="grid grid-cols-2 gap-2.5">
          <button className={btnCls} onClick={() => setTab('ailog')}>Talk / Log now</button>
          <button className={btnSecondary} onClick={() => setTab('workout')}>Open workout</button>
        </div>
      </Card>
    </>
  );
}

/* ---------------- AI Log ---------------- */
function AiLog({ dayLogId, session, profile, reload, showToast, setTab }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [parsed, setParsed] = useState(null);
  const [pendingCricket, setPendingCricket] = useState(null);
  const [recording, setRecording] = useState(false);
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
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch('/api/ai-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
        body: JSON.stringify({ text })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
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
      inserts.push(
        supabase.from('workout_entries').insert({
          day_log_id: dayLogId, user_id: uid, exercise: w.exercise, sets_reps: w.setsReps,
          weight_kg: w.weightKg, notes: w.notes, source: 'ai'
        })
      )
    );
    (parsed.nutrition || []).forEach((f) =>
      inserts.push(
        supabase.from('food_entries').insert({
          day_log_id: dayLogId, user_id: uid, item: f.item, calories: f.calories,
          protein_g: f.proteinG, carbs_g: f.carbsG, fat_g: f.fatG, source: 'ai'
        })
      )
    );
    let cricketRow = null;
    if (parsed.cricket && parsed.cricket.sessionType !== 'none') {
      cricketRow = {
        day_log_id: dayLogId, user_id: uid, session_type: parsed.cricket.sessionType,
        batting_notes: parsed.cricket.battingNotes, bowling_notes: parsed.cricket.bowlingNotes,
        fielding_notes: parsed.cricket.fieldingNotes, rating: parsed.cricket.rating,
        improvement_focus: parsed.cricket.improvementFocus, fatigue_level: parsed.cricket.fatigue,
        role_metrics: parsed.cricket.roleMetrics || {}, source: 'ai'
      };
    }
    if (parsed.mindset && (parsed.mindset.mood || parsed.mindset.notes)) {
      inserts.push(
        supabase.from('mindset_entries').insert({
          day_log_id: dayLogId, user_id: uid, mood: parsed.mindset.mood, confidence: parsed.mindset.confidence,
          notes: parsed.mindset.notes, insight: parsed.mindset.insight, source: 'ai'
        })
      );
    }
    await Promise.all(inserts);

    if (cricketRow) {
      const gate = checkMindsetGate({ fatigue: cricketRow.fatigue_level, roleMetrics: cricketRow.role_metrics, notes: `${cricketRow.batting_notes} ${cricketRow.bowling_notes}` });
      if (gate.flagged) {
        setPendingCricket({ row: cricketRow, reason: gate.reason });
        setText(''); setParsed(null);
        showToast('Logged workout/food/mindset ✓');
        reload();
        return;
      }
      await supabase.from('cricket_entries').insert({ ...cricketRow, gate_flagged: false });
    }
    setText(''); setParsed(null);
    showToast('Logged ✓');
    reload();
  }

  async function resolvePendingCricket(logAnyway) {
    if (logAnyway) {
      await supabase.from('cricket_entries').insert({ ...pendingCricket.row, gate_flagged: true, gate_reason: pendingCricket.reason });
      showToast('Cricket session saved ✓');
      reload();
    }
    setPendingCricket(null);
  }

  return (
    <>
      {pendingCricket && (
        <Card className="border-willow">
          <Eyebrow>Before we log the cricket part</Eyebrow>
          <h2 className="font-display text-2xl mb-1">Worth a reset first?</h2>
          <p className="text-sm text-cream mb-3">{pendingCricket.reason}</p>
          <div className="grid grid-cols-1 gap-2.5">
            <button className={btnGold} onClick={() => setTab('meditate')}>Do the 7-minute reset first</button>
            <button className={btnSecondary} onClick={() => resolvePendingCricket(true)}>Log it anyway</button>
          </div>
        </Card>
      )}
      <Card>
        <Eyebrow>Speak or type your session</Eyebrow>
        <h2 className="font-display text-2xl mb-1">Just tell me what happened</h2>
        <p className="text-muted text-sm mb-3">
          e.g. &ldquo;Batted for two hours, felt shaky against the left-arm spinner. Squats 90kg for 8. Had chicken and rice after, ~600 calories. Mood 7/10.&rdquo;
        </p>
        <div className="flex gap-2 items-start">
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type here, or tap the mic..." className={`${inputCls} min-h-[80px]`} />
          <button
            onClick={toggleMic}
            className={`flex-none w-11 h-11 rounded-full border border-white/10 flex items-center justify-center ${recording ? 'mic-rec' : 'bg-bgElev2'}`}
          >🎙</button>
        </div>
        <button className={`${btnCls} w-full mt-3`} onClick={parseIt}>Parse & preview</button>
        {status && <p className="text-muted text-xs mt-2">{status}</p>}
      </Card>

      {parsed && (
        <Card>
          <Eyebrow>Preview — save when ready</Eyebrow>
          <h2 className="font-display text-2xl mb-2">Parsed entry</h2>
          {parsed.workout?.length > 0 && (
            <div className="mb-2">
              <div className={labelCls}>Workout</div>
              {parsed.workout.map((w, i) => (
                <div key={i} className="text-sm py-1 border-b border-white/10 flex justify-between">
                  <b>{w.exercise}</b><span className="font-mono text-xs text-muted">{w.setsReps} {w.weightKg ? `· ${w.weightKg}kg` : ''}</span>
                </div>
              ))}
            </div>
          )}
          {parsed.nutrition?.length > 0 && (
            <div className="mb-2">
              <div className={labelCls}>Nutrition</div>
              {parsed.nutrition.map((f, i) => (
                <div key={i} className="text-sm py-1 border-b border-white/10 flex justify-between">
                  {f.item}<span className="font-mono text-xs text-muted">{f.calories ?? '?'} kcal</span>
                </div>
              ))}
            </div>
          )}
          {parsed.cricket?.sessionType !== 'none' && (
            <div className="mb-2">
              <div className={labelCls}>Cricket ({parsed.cricket.sessionType})</div>
              <div className="text-sm">
                {parsed.cricket.battingNotes && <div>Batting: {parsed.cricket.battingNotes}</div>}
                {parsed.cricket.bowlingNotes && <div>Bowling: {parsed.cricket.bowlingNotes}</div>}
                {parsed.cricket.fieldingNotes && <div>Fielding: {parsed.cricket.fieldingNotes}</div>}
                {parsed.cricket.improvementFocus && <div>Focus on: {parsed.cricket.improvementFocus}</div>}
              </div>
            </div>
          )}
          {(parsed.mindset?.mood || parsed.mindset?.notes) && (
            <div className="mb-2">
              <div className={labelCls}>Mindset</div>
              <div className="text-sm">Mood {parsed.mindset.mood ?? '–'}/10 · Confidence {parsed.mindset.confidence ?? '–'}/10</div>
              {parsed.mindset.notes && <div className="text-sm">{parsed.mindset.notes}</div>}
              {parsed.mindset.insight && <div className="text-willow text-sm italic mt-1">{parsed.mindset.insight}</div>}
            </div>
          )}
          <button className={`${btnCls} w-full mt-2`} onClick={commit}>Save all to today</button>
        </Card>
      )}
    </>
  );
}

/* ---------------- Workout ---------------- */
function Workout({ dayLogId, workout, template, templateItems, reload, showToast }) {
  const [vals, setVals] = useState({});
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState(templateItems);
  useEffect(() => setItems(templateItems), [templateItems]);

  const exercises = items.filter((i) => i.item_type === 'exercise');
  const blocks = items.filter((i) => i.item_type === 'block');

  async function logSets() {
    const inserts = [];
    exercises.forEach((ex, i) => {
      const kg = vals[`w_${i}`];
      const reps = vals[`r_${i}`];
      if (kg || reps) {
        inserts.push(
          supabase.from('workout_entries').insert({
            day_log_id: dayLogId, exercise: ex.name,
            sets_reps: reps ? `${reps} reps` : ex.target, weight_kg: kg ? Number(kg) : null,
            notes: '', source: 'manual'
          })
        );
      }
    });
    await Promise.all(inserts);
    showToast('Sets logged ✓');
    reload();
  }

  async function markConditioningDone() {
    await supabase.from('workout_entries').insert({
      day_log_id: dayLogId, exercise: template.title, sets_reps: 'completed', weight_kg: null, notes: '', source: 'manual'
    });
    showToast('Session marked done ✓');
    reload();
  }

  async function removeEntry(id) {
    await supabase.from('workout_entries').delete().eq('id', id);
    reload();
  }

  async function addItem(itemType) {
    await supabase.from('template_items').insert({
      template_id: template.id, item_type: itemType, name: itemType === 'exercise' ? 'New exercise' : 'New line', target: itemType === 'exercise' ? '3 x 10' : null, sort_order: items.length
    });
    reload();
  }
  async function updateItem(id, patch) {
    await supabase.from('template_items').update(patch).eq('id', id);
  }
  async function removeItem(id) {
    await supabase.from('template_items').delete().eq('id', id);
    reload();
  }
  async function updateTemplateMeta(patch) {
    await supabase.from('workout_templates').update(patch).eq('id', template.id);
    reload();
  }

  if (!template) return <Card><Empty>No session set up for today yet.</Empty></Card>;

  return (
    <>
      <Card>
        <div className="flex justify-between items-start">
          <div>
            <Eyebrow>{fmtDate(todayISO())} · {template.session_type}</Eyebrow>
            {editing ? (
              <>
                <input className={`${inputCls} font-display text-xl mb-1`} value={template.title} onChange={(e) => updateTemplateMeta({ title: e.target.value })} />
                <input className={inputCls} value={template.subtitle || ''} onChange={(e) => updateTemplateMeta({ subtitle: e.target.value })} placeholder="Subtitle" />
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl">{template.title}</h2>
                <p className="text-muted text-sm mb-2">{template.subtitle}</p>
              </>
            )}
          </div>
          <button className="font-mono text-[10px] text-willow underline flex-none mt-1" onClick={() => setEditing(!editing)}>
            {editing ? 'done' : 'edit day'}
          </button>
        </div>

        {editing && (
          <div className="grid grid-cols-2 gap-2.5 mt-2">
            <select className={inputCls} value={template.session_type} onChange={(e) => updateTemplateMeta({ session_type: e.target.value })}>
              <option value="strength">Strength</option>
              <option value="power">Power</option>
              <option value="conditioning">Conditioning</option>
              <option value="recovery">Recovery</option>
              <option value="rest">Rest</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-seam w-5 h-5" checked={template.core_circuit} onChange={(e) => updateTemplateMeta({ core_circuit: e.target.checked })} />
              Core circuit after session
            </label>
          </div>
        )}

        {exercises.map((ex, i) => (
          <div key={ex.id} className="flex justify-between items-center py-2.5 border-b border-white/10 gap-2">
            {editing ? (
              <div className="flex-1 flex gap-2">
                <input className={inputCls} defaultValue={ex.name} onBlur={(e) => updateItem(ex.id, { name: e.target.value })} />
                <input className={`${inputCls} w-24`} defaultValue={ex.target} onBlur={(e) => updateItem(ex.id, { target: e.target.value })} />
                <button className="text-seam font-mono text-xs" onClick={() => removeItem(ex.id)}>del</button>
              </div>
            ) : (
              <>
                <div>
                  <div className="text-sm font-semibold">{ex.name}</div>
                  <div className="font-mono text-xs text-muted">{ex.target}</div>
                </div>
                <div className="flex gap-1.5">
                  <input type="number" placeholder="kg" className="w-14 bg-bg border border-white/10 rounded-lg text-center py-1.5 font-mono text-xs"
                    onChange={(e) => setVals((v) => ({ ...v, [`w_${i}`]: e.target.value }))} />
                  <input type="number" placeholder="reps" className="w-14 bg-bg border border-white/10 rounded-lg text-center py-1.5 font-mono text-xs"
                    onChange={(e) => setVals((v) => ({ ...v, [`r_${i}`]: e.target.value }))} />
                </div>
              </>
            )}
          </div>
        ))}
        {editing && <button className={`${btnSecondary} w-full mt-2`} onClick={() => addItem('exercise')}>+ Add exercise</button>}
        {!editing && exercises.length > 0 && <button className={`${btnCls} w-full mt-3`} onClick={logSets}>Log these sets</button>}

        {blocks.map((b) => (
          <div key={b.id} className="text-sm py-2 border-b border-white/10 last:border-0 flex justify-between gap-2">
            {editing ? (
              <>
                <input className={inputCls} defaultValue={b.name} onBlur={(e) => updateItem(b.id, { name: e.target.value })} />
                <button className="text-seam font-mono text-xs" onClick={() => removeItem(b.id)}>del</button>
              </>
            ) : b.name}
          </div>
        ))}
        {editing && <button className={`${btnSecondary} w-full mt-2`} onClick={() => addItem('block')}>+ Add line</button>}
        {!editing && blocks.length > 0 && <button className={`${btnSecondary} w-full mt-3`} onClick={markConditioningDone}>Mark session done</button>}
        {!editing && exercises.length === 0 && blocks.length === 0 && <Empty>Rest day, or match day — no fixed session. Tap &ldquo;edit day&rdquo; to add one.</Empty>}
      </Card>

      {template.core_circuit && (
        <Card>
          <Eyebrow>Core circuit — end of session</Eyebrow>
          {CORE_CIRCUIT.map((c, i) => <div key={i} className="text-sm py-1.5 border-b border-white/10 last:border-0">{c}</div>)}
        </Card>
      )}

      <Card>
        <Eyebrow>Logged today</Eyebrow>
        {workout.length === 0 ? <Empty>No sets logged yet.</Empty> : workout.map((w) => (
          <div key={w.id} className="py-2 border-b border-white/10 last:border-0 text-sm">
            <div className="flex justify-between">
              <b>{w.exercise}</b>
              <span className="font-mono text-xs text-seam" onClick={() => removeEntry(w.id)}>remove</span>
            </div>
            <div className="font-mono text-xs text-muted">{w.sets_reps} {w.weight_kg ? `· ${w.weight_kg}kg` : ''} {w.source === 'ai' ? '· via AI log' : ''}</div>
          </div>
        ))}
      </Card>
    </>
  );
}

/* ---------------- Nutrition ---------------- */
function Nutrition({ dayLog, food, profile, setProfile, userId, updateDayLog, reload, showToast }) {
  const macros = computeMacros(profile);
  const totals = food.reduce((a, f) => ({
    calories: a.calories + (f.calories || 0), protein: a.protein + (f.protein_g || 0),
    carbs: a.carbs + (f.carbs_g || 0), fat: a.fat + (f.fat_g || 0)
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const [item, setItem] = useState({ name: '', cal: '', pro: '', carb: '', fat: '' });
  const [weightInput, setWeightInput] = useState(dayLog.morning_weight_kg ?? '');
  const [profileForm, setProfileForm] = useState(profile);

  function Bar({ label, val, target, unit }) {
    const pct = target ? Math.min(100, (val / target) * 100) : 0;
    return (
      <div className="mt-2.5">
        <label className={labelCls}>{label} — {Math.round(val)}{unit} / {Math.round(target)}{unit}</label>
        <div className="h-2 bg-bgElev2 rounded-full overflow-hidden">
          <div className="h-full bg-seam rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  async function addFood() {
    if (!item.name.trim()) { showToast('Add a food name'); return; }
    await supabase.from('food_entries').insert({
      day_log_id: dayLog.id, item: item.name, calories: Number(item.cal) || null,
      protein_g: Number(item.pro) || null, carbs_g: Number(item.carb) || null, fat_g: Number(item.fat) || null, source: 'manual'
    });
    setItem({ name: '', cal: '', pro: '', carb: '', fat: '' });
    showToast('Added ✓');
    reload();
  }
  async function removeFood(id) { await supabase.from('food_entries').delete().eq('id', id); reload(); }
  async function saveWeight() { await updateDayLog({ morning_weight_kg: Number(weightInput) || null }); showToast('Weight saved ✓'); }
  async function saveProfile() {
    await supabase.from('profiles').update(profileForm).eq('id', userId);
    setProfile(profileForm);
    showToast('Targets updated ✓');
  }

  return (
    <>
      <Card>
        <Eyebrow>Lean bulk targets</Eyebrow>
        <h2 className="font-display text-2xl">{macros.target} kcal / day</h2>
        <p className="text-muted text-sm">TDEE {macros.tdee} kcal + {profile.surplus} surplus.</p>
        <Bar label="Calories" val={totals.calories} target={macros.target} unit="" />
        <Bar label="Protein" val={totals.protein} target={macros.protein} unit="g" />
        <Bar label="Carbs" val={totals.carbs} target={macros.carbs} unit="g" />
        <Bar label="Fat" val={totals.fat} target={macros.fat} unit="g" />
      </Card>

      <Card>
        <Eyebrow>Add food</Eyebrow>
        <div className="grid grid-cols-2 gap-2.5">
          <div><label className={labelCls}>Item</label><input className={inputCls} value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} placeholder="Chicken & rice" /></div>
          <div><label className={labelCls}>Calories</label><input type="number" className={inputCls} value={item.cal} onChange={(e) => setItem({ ...item, cal: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <div><label className={labelCls}>Protein g</label><input type="number" className={inputCls} value={item.pro} onChange={(e) => setItem({ ...item, pro: e.target.value })} /></div>
          <div><label className={labelCls}>Carbs g</label><input type="number" className={inputCls} value={item.carb} onChange={(e) => setItem({ ...item, carb: e.target.value })} /></div>
          <div><label className={labelCls}>Fat g</label><input type="number" className={inputCls} value={item.fat} onChange={(e) => setItem({ ...item, fat: e.target.value })} /></div>
        </div>
        <button className={`${btnCls} w-full mt-3`} onClick={addFood}>Add entry</button>
      </Card>

      <Card>
        <Eyebrow>Today&apos;s food log</Eyebrow>
        {food.length === 0 ? <Empty>Nothing logged yet.</Empty> : food.map((f) => (
          <div key={f.id} className="py-2 border-b border-white/10 last:border-0 text-sm">
            <div className="flex justify-between"><span>{f.item}</span><span className="font-mono text-xs text-seam" onClick={() => removeFood(f.id)}>remove</span></div>
            <div className="font-mono text-xs text-muted">{f.calories ?? '?'} kcal · P{f.protein_g ?? '–'} C{f.carbs_g ?? '–'} F{f.fat_g ?? '–'}</div>
          </div>
        ))}
      </Card>

      <Card>
        <Eyebrow>Morning weight</Eyebrow>
        <div className="grid grid-cols-2 gap-2.5">
          <input type="number" className={inputCls} value={weightInput} onChange={(e) => setWeightInput(e.target.value)} placeholder="kg" />
          <button className={btnSecondary} onClick={saveWeight}>Save</button>
        </div>
      </Card>

      <Card>
        <Eyebrow>Profile — recalculate macros</Eyebrow>
        <label className={labelCls}>Playing role</label>
        <select className={inputCls} value={profileForm.player_role} onChange={(e) => setProfileForm({ ...profileForm, player_role: e.target.value })}>
          {PLAYER_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <p className="text-muted text-xs mt-1">Changes which fields show up in your Cricket tab.</p>
        <div className="grid grid-cols-2 gap-2.5 mt-2.5">
          <div><label className={labelCls}>Weight kg</label><input type="number" className={inputCls} value={profileForm.weight_kg} onChange={(e) => setProfileForm({ ...profileForm, weight_kg: Number(e.target.value) })} /></div>
          <div><label className={labelCls}>Height cm</label><input type="number" className={inputCls} value={profileForm.height_cm} onChange={(e) => setProfileForm({ ...profileForm, height_cm: Number(e.target.value) })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div><label className={labelCls}>Age</label><input type="number" className={inputCls} value={profileForm.age} onChange={(e) => setProfileForm({ ...profileForm, age: Number(e.target.value) })} /></div>
          <div><label className={labelCls}>Activity ×</label><input type="number" step="0.05" className={inputCls} value={profileForm.activity} onChange={(e) => setProfileForm({ ...profileForm, activity: Number(e.target.value) })} /></div>
        </div>
        <label className={labelCls}>Surplus (kcal) — 300 = lean bulk</label>
        <input type="number" className={inputCls} value={profileForm.surplus} onChange={(e) => setProfileForm({ ...profileForm, surplus: Number(e.target.value) })} />
        <button className={`${btnGold} w-full mt-3`} onClick={saveProfile}>Update targets</button>
      </Card>
    </>
  );
}

/* ---------------- Cricket ---------------- */
function Cricket({ dayLogId, cricket, profile, reload, showToast, setTab }) {
  const [form, setForm] = useState({ type: 'practice', bat: '', bowl: '', field: '', rate: 3, focus: '', fatigue: 4, metrics: {} });
  const [pending, setPending] = useState(null); // holds a flagged entry awaiting confirm/decline
  const fields = roleMetricFields(profile.player_role);

  function setMetric(key, val) {
    setForm((f) => ({ ...f, metrics: { ...f.metrics, [key]: val === '' ? null : Number(val) } }));
  }

  function buildRow() {
    return {
      day_log_id: dayLogId, session_type: form.type, batting_notes: form.bat, bowling_notes: form.bowl,
      fielding_notes: form.field, rating: Number(form.rate), improvement_focus: form.focus,
      fatigue_level: Number(form.fatigue), role_metrics: form.metrics, source: 'manual'
    };
  }

  async function insertRow(row, flagged, reason) {
    await supabase.from('cricket_entries').insert({ ...row, gate_flagged: flagged, gate_reason: reason || null });
    setForm({ type: 'practice', bat: '', bowl: '', field: '', rate: 3, focus: '', fatigue: 4, metrics: {} });
    setPending(null);
    showToast('Session saved ✓');
    reload();
  }

  async function save() {
    const row = buildRow();
    const gate = checkMindsetGate({ fatigue: row.fatigue_level, roleMetrics: row.role_metrics, notes: `${row.batting_notes} ${row.bowling_notes}` });
    if (gate.flagged) {
      setPending({ row, reason: gate.reason });
    } else {
      await insertRow(row, false, null);
    }
  }

  async function remove(id) { await supabase.from('cricket_entries').delete().eq('id', id); reload(); }

  return (
    <>
      {pending && (
        <Card className="border-willow">
          <Eyebrow>Before we log this</Eyebrow>
          <h2 className="font-display text-2xl mb-1">Worth a reset first?</h2>
          <p className="text-sm text-cream mb-3">{pending.reason}</p>
          <div className="grid grid-cols-1 gap-2.5">
            <button className={`${btnGold}`} onClick={() => setTab('meditate')}>Do the 7-minute reset first</button>
            <button className={btnSecondary} onClick={() => insertRow(pending.row, true, pending.reason)}>Log it anyway</button>
          </div>
        </Card>
      )}

      <Card>
        <Eyebrow>Log a session</Eyebrow>
        <h2 className="font-display text-2xl mb-1">Practice or match</h2>
        <label className={labelCls}>Type</label>
        <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="practice">Nets / practice</option>
          <option value="match">Match</option>
        </select>
        <label className={labelCls}>Batting notes</label>
        <textarea className={inputCls} value={form.bat} onChange={(e) => setForm({ ...form, bat: e.target.value })} placeholder="Shot execution, footwork, against pace/spin..." />
        <label className={labelCls}>Bowling notes</label>
        <textarea className={inputCls} value={form.bowl} onChange={(e) => setForm({ ...form, bowl: e.target.value })} placeholder="Line, length, turn, rhythm..." />
        <label className={labelCls}>Fielding notes</label>
        <textarea className={inputCls} value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })} placeholder="Catches, ground fielding, energy..." />

        <label className={labelCls}>Fatigue (1-10): <span className="text-willow">{form.fatigue}</span></label>
        <input type="range" min="1" max="10" value={form.fatigue} onChange={(e) => setForm({ ...form, fatigue: e.target.value })} className="w-full accent-seam" />

        {fields.length > 0 && (
          <>
            <label className={labelCls}>Role-specific metrics ({PLAYER_ROLES.find((r) => r.value === profile.player_role)?.label})</label>
            <div className="grid grid-cols-2 gap-2.5">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className={labelCls}>{f.label}</label>
                  <input type="number" max={f.max} className={inputCls} onChange={(e) => setMetric(f.key, e.target.value)} />
                </div>
              ))}
            </div>
          </>
        )}

        <label className={labelCls}>Session rating (1-5): <span className="text-willow">{form.rate}</span></label>
        <input type="range" min="1" max="5" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} className="w-full accent-seam" />
        <label className={labelCls}>One thing to improve</label>
        <input className={inputCls} value={form.focus} onChange={(e) => setForm({ ...form, focus: e.target.value })} placeholder="e.g. finishing follow-through against effort balls" />
        <button className={`${btnCls} w-full mt-3`} onClick={save}>Save session</button>
      </Card>

      <Card>
        <Eyebrow>History</Eyebrow>
        {cricket.length === 0 ? <Empty>No sessions logged today.</Empty> : cricket.map((c) => (
          <div key={c.id} className="py-2 border-b border-white/10 last:border-0 text-sm">
            <div className="flex justify-between"><b>{c.session_type}</b><span className="font-mono text-xs text-seam" onClick={() => remove(c.id)}>remove</span></div>
            {c.batting_notes && <div>Batting: {c.batting_notes}</div>}
            {c.bowling_notes && <div>Bowling: {c.bowling_notes}</div>}
            {c.fielding_notes && <div>Fielding: {c.fielding_notes}</div>}
            <div className="font-mono text-xs text-muted">Rating {c.rating || '–'}/5 · Fatigue {c.fatigue_level ?? '–'}/10 {c.improvement_focus ? `· Focus: ${c.improvement_focus}` : ''} {c.gate_flagged ? '· reset was offered' : ''}</div>
          </div>
        ))}
      </Card>
    </>
  );
}

/* ---------------- Mindset ---------------- */
function Mindset({ dayLogId, mindset, reload, showToast, setTab }) {
  const [mood, setMood] = useState(6);
  const [confidence, setConfidence] = useState(6);
  const [pressure, setPressure] = useState(4);
  const [notes, setNotes] = useState('');

  async function save() {
    let insight = '';
    if (pressure >= 7) insight = 'High pressure noted — try box-breathing before your next net session to reset your nervous system.';
    else if (confidence <= 4) insight = 'Low confidence day — review one thing that went right today, however small, before you sleep.';
    else if (mood >= 8) insight = 'Good headspace — this is a great day to work on the technical detail you\u2019ve been avoiding.';
    await supabase.from('mindset_entries').insert({ day_log_id: dayLogId, mood, confidence, pressure, notes, insight, source: 'manual' });
    setNotes('');
    showToast('Check-in saved ✓');
    reload();
  }
  async function remove(id) { await supabase.from('mindset_entries').delete().eq('id', id); reload(); }

  return (
    <>
      <Card>
        <Eyebrow>Check in</Eyebrow>
        <h2 className="font-display text-2xl mb-1">How&apos;s your headspace?</h2>
        <label className={labelCls}>Mood: <span className="text-willow">{mood}</span>/10</label>
        <input type="range" min="1" max="10" value={mood} onChange={(e) => setMood(Number(e.target.value))} className="w-full accent-seam" />
        <label className={labelCls}>Confidence: <span className="text-willow">{confidence}</span>/10</label>
        <input type="range" min="1" max="10" value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-full accent-seam" />
        <label className={labelCls}>Pressure / anxiety: <span className="text-willow">{pressure}</span>/10</label>
        <input type="range" min="1" max="10" value={pressure} onChange={(e) => setPressure(Number(e.target.value))} className="w-full accent-seam" />
        <label className={labelCls}>Journal</label>
        <textarea className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What's on your mind after today's session?" />
        <button className={`${btnCls} w-full mt-3`} onClick={save}>Save check-in</button>
      </Card>

      <Card>
        <Eyebrow>Today&apos;s entries</Eyebrow>
        {mindset.length === 0 ? <Empty>No check-ins yet.</Empty> : mindset.map((m) => (
          <div key={m.id} className="py-2 border-b border-white/10 last:border-0 text-sm">
            <div className="flex justify-between">
              <span>Mood {m.mood ?? '–'}/10 · Confidence {m.confidence ?? '–'}/10</span>
              <span className="font-mono text-xs text-seam" onClick={() => remove(m.id)}>remove</span>
            </div>
            {m.notes && <div>{m.notes}</div>}
            {m.insight && <div className="text-willow italic mt-1">{m.insight}</div>}
          </div>
        ))}
      </Card>

      <Card>
        <Eyebrow>Low on confidence or high pressure?</Eyebrow>
        <button className={`${btnGold} w-full`} onClick={() => setTab('meditate')}>Do a 7-minute breathing reset</button>
      </Card>
    </>
  );
}

/* ---------------- Meditate ---------------- */
function Meditate({ dayLog, updateDayLog, showToast }) {
  const [label, setLabel] = useState('07:00 remaining');
  const [phase, setPhase] = useState('Ready');
  const ringRef = useRef(null);
  const timerRef = useRef(null);
  const secondsRef = useRef(7 * 60);

  function cycle() {
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
    secondsRef.current = 7 * 60;
    cycle();
    timerRef.current = setInterval(() => {
      secondsRef.current -= 1;
      if (secondsRef.current % 14 === 0) cycle();
      const m = String(Math.floor(secondsRef.current / 60)).padStart(2, '0');
      const s = String(secondsRef.current % 60).padStart(2, '0');
      setLabel(`${m}:${s} remaining`);
      if (secondsRef.current <= 0) { stop(); setPhase('Done'); }
    }, 1000);
  }
  function stop() { clearInterval(timerRef.current); }

  async function markDone() { await updateDayLog({ meditation_done: true }); showToast('Nice work ✓'); }

  return (
    <Card className="text-center">
      <Eyebrow>7-minute breathing reset</Eyebrow>
      <h2 className="font-display text-2xl mb-1">Settle the mind</h2>
      <p className="text-muted text-sm mb-3">4s in · 4s hold · 6s out. Sit tall, relax the shoulders.</p>
      <div
        ref={ringRef}
        className="w-44 h-44 rounded-full border-2 border-seam mx-auto my-5 flex items-center justify-center transition-transform duration-[4000ms] ease-in-out"
      >
        <div className="font-display text-xl tracking-wide">{phase}</div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <button className={btnCls} onClick={start}>Start</button>
        <button className={btnSecondary} onClick={stop}>Stop</button>
      </div>
      <div className="font-mono text-muted text-sm mt-3">{label}</div>
      <button className={`${btnGold} w-full mt-4`} onClick={markDone}>
        {dayLog.meditation_done ? 'Meditation done ✓' : "Mark today's meditation done"}
      </button>
    </Card>
  );
}
