'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { todayISO, fmtDate, isoDaysAgo, DEFAULT_PROFILE, defaultProgramSeed } from '../lib/program';
import { Card, Eyebrow, H2, Sub, btnCls, btnGold, inputCls, labelCls } from './components/ui';
import Dashboard from './components/Dashboard';
import AiLog from './components/AiLog';
import Train from './components/Train';
import Cricket from './components/Cricket';
import Body from './components/Body';
import Nutrition from './components/Nutrition';
import Mind from './components/Mind';
import History from './components/History';

const TABS = [
  { id: 'dashboard', label: 'Today' },
  { id: 'ailog', label: 'AI' },
  { id: 'train', label: 'Train' },
  { id: 'cricket', label: 'Cricket' },
  { id: 'body', label: 'Body' },
  { id: 'nutrition', label: 'Food' },
  { id: 'mind', label: 'Mind' },
  { id: 'history', label: 'History' }
];

export default function App() {
  const router = useRouter();
  const [session, setSession] = useState(undefined);
  const [tab, setTab] = useState('dashboard');
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [dayLog, setDayLog] = useState(null);
  const [workout, setWorkout] = useState([]);
  const [food, setFood] = useState([]);
  const [cricket, setCricket] = useState([]);
  const [mindset, setMindset] = useState([]);
  const [niggles, setNiggles] = useState([]);
  const [matches, setMatches] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [activeProgram, setActiveProgram] = useState(null);
  const [recentDays, setRecentDays] = useState([]);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [recentNiggles, setRecentNiggles] = useState([]);
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

  const loadEverything = useCallback(async () => {
    if (!session?.user) return;
    const uid = session.user.id;

    let { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (!prof) {
      const ins = await supabase.from('profiles').insert({ id: uid, ...DEFAULT_PROFILE }).select().single();
      prof = ins.data;
    }
    setProfile(prof || DEFAULT_PROFILE);

    let { data: day } = await supabase.from('day_logs').select('*').eq('user_id', uid).eq('log_date', iso).maybeSingle();
    if (!day) {
      const ins = await supabase.from('day_logs')
        .insert({ user_id: uid, log_date: iso, prehab_done: false, meditation_done: false })
        .select().single();
      day = ins.data;
    }
    setDayLog(day);

    const since = isoDaysAgo(27);
    const [w, f, c, m, n, mt, progs, days28, w28, mt28, n14] = await Promise.all([
      supabase.from('workout_entries').select('*').eq('day_log_id', day.id).order('created_at'),
      supabase.from('food_entries').select('*').eq('day_log_id', day.id).order('created_at'),
      supabase.from('cricket_entries').select('*').eq('day_log_id', day.id).order('created_at'),
      supabase.from('mindset_entries').select('*').eq('day_log_id', day.id).order('created_at'),
      supabase.from('niggle_entries').select('*').eq('day_log_id', day.id).order('created_at'),
      supabase.from('match_entries').select('*').eq('day_log_id', day.id).order('created_at'),
      supabase.from('programs').select('*').eq('user_id', uid).order('created_at'),
      supabase.from('day_logs').select('*').eq('user_id', uid).gte('log_date', since).order('log_date'),
      supabase.from('workout_entries').select('exercise,weight_kg,created_at').eq('user_id', uid).gte('created_at', since).order('created_at'),
      supabase.from('match_entries').select('*').eq('user_id', uid).gte('created_at', since),
      supabase.from('niggle_entries').select('body_area,severity,created_at').eq('user_id', uid).gte('created_at', isoDaysAgo(13))
    ]);
    setWorkout(w.data || []);
    setFood(f.data || []);
    setCricket(c.data || []);
    setMindset(m.data || []);
    setNiggles(n.data || []);
    setMatches(mt.data || []);
    setPrograms(progs.data || []);
    setRecentDays(days28.data || []);
    setRecentWorkouts(w28.data || []);
    setRecentMatches(mt28.data || []);
    setRecentNiggles(n14.data || []);

    if (prof?.active_program_id) {
      const { data: pdays } = await supabase.from('program_days').select('*, program_exercises(*)').eq('program_id', prof.active_program_id).order('day_of_week');
      const progRow = (progs.data || []).find((p) => p.id === prof.active_program_id);
      if (progRow) {
        setActiveProgram({
          ...progRow,
          days: (pdays || []).map((d) => ({ ...d, exercises: (d.program_exercises || []).sort((a, b) => a.sort - b.sort) }))
        });
      } else setActiveProgram(null);
    } else setActiveProgram(null);
  }, [session, iso]);

  useEffect(() => {
    if (session?.user) loadEverything();
  }, [session, loadEverything]);

  if (session === undefined) return <div className="min-h-screen flex items-center justify-center text-muted font-mono text-sm">Loading...</div>;
  if (session === null) return null;

  async function updateDayLog(patch) {
    const { data } = await supabase.from('day_logs').update(patch).eq('id', dayLog.id).select().single();
    setDayLog(data);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  // today's plan from the active program
  const todayDow = new Date().getDay();
  const todayPlan = activeProgram?.days?.find((d) => d.day_of_week === todayDow) || null;
  const todayExercises = todayPlan?.exercises || [];

  // bowling overs this week vs last week (from matches + practice notes overs field in match_entries only for accuracy)
  function oversInRange(fromDaysAgo, toDaysAgo) {
    const from = isoDaysAgo(fromDaysAgo), to = isoDaysAgo(toDaysAgo);
    return recentMatches
      .filter((m) => { const d = m.created_at?.slice(0, 10); return d >= from && d <= to; })
      .reduce((s, m) => s + (Number(m.overs_bowled) || 0), 0);
  }
  const weekOvers = Math.round(oversInRange(6, 0) * 10) / 10;
  const prevWeekOvers = Math.round(oversInRange(13, 7) * 10) / 10;

  if (dayLog && profile && !profile.onboarded) {
    return <Onboarding profile={profile} setProfile={setProfile} userId={session.user.id} reload={loadEverything} />;
  }

  return (
    <div className="max-w-xl mx-auto min-h-screen pb-24 relative">
      <div className="sticky top-0 z-20 px-4 pt-5 pb-0 bg-gradient-to-b from-bg via-bg to-transparent">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display font-extrabold text-4xl tracking-tight">
            ATHLETE<span className="text-seam">OS</span>
          </h1>
          <div className="text-right">
            <div className="font-mono text-[11px] text-muted">{fmtDate(iso).toUpperCase()}</div>
            <button onClick={signOut} className="font-mono text-[10px] text-muted underline">sign out</button>
          </div>
        </div>
        <div className="seam-rule mt-3" />
        <div className="flex gap-1 mt-4 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`folder-tab flex-none text-[11px] uppercase tracking-wide px-3.5 py-2.5 rounded-t-lg border border-b-0 whitespace-nowrap ${
                tab === t.id ? 'is-active' : 'bg-bgElev2 border-white/10 text-muted'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="px-4">
        <div key={tab} className="view-enter">
          {dayLog && tab === 'dashboard' && (
            <Dashboard dayLog={dayLog} todayPlan={todayPlan} workout={workout} food={food} updateDayLog={updateDayLog} setTab={setTab} />
          )}
          {dayLog && tab === 'ailog' && (
            <AiLog dayLog={dayLog} session={session} recentDays={recentDays} reload={loadEverything} showToast={showToast} />
          )}
          {dayLog && tab === 'train' && (
            <Train dayLog={dayLog} todayPlan={todayPlan} todayExercises={todayExercises} programs={programs}
              activeProgram={activeProgram} workout={workout} userId={session.user.id}
              reload={loadEverything} showToast={showToast} updateDayLog={updateDayLog} />
          )}
          {dayLog && tab === 'cricket' && (
            <Cricket dayLog={dayLog} cricket={cricket} matches={matches} weekOvers={weekOvers}
              prevWeekOvers={prevWeekOvers} reload={loadEverything} showToast={showToast} />
          )}
          {dayLog && tab === 'body' && (
            <Body dayLog={dayLog} niggles={niggles} recentNiggles={recentNiggles}
              updateDayLog={updateDayLog} reload={loadEverything} showToast={showToast} />
          )}
          {dayLog && tab === 'nutrition' && (
            <Nutrition dayLog={dayLog} food={food} profile={profile} setProfile={setProfile} userId={session.user.id}
              updateDayLog={updateDayLog} reload={loadEverything} showToast={showToast} />
          )}
          {dayLog && tab === 'mind' && (
            <Mind dayLog={dayLog} mindset={mindset} updateDayLog={updateDayLog} reload={loadEverything} showToast={showToast} />
          )}
          {dayLog && tab === 'history' && (
            <History recentDays={recentDays} recentWorkouts={recentWorkouts} recentMatches={recentMatches} />
          )}
        </div>
      </main>

      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-ink text-paper text-xs font-bold px-4 py-2 rounded-full z-50 font-mono">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

/* First-run onboarding: three friendly steps, no jargon */
function Onboarding({ profile, setProfile, userId, reload }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ weight_kg: profile.weight_kg, height_cm: profile.height_cm, age: profile.age });
  const [goal, setGoal] = useState(300);
  const [wantTemplate, setWantTemplate] = useState(true);
  const [busy, setBusy] = useState(false);

  async function finish() {
    setBusy(true);
    await supabase.from('profiles').update({
      weight_kg: Number(form.weight_kg) || 70, height_cm: Number(form.height_cm) || 175,
      age: Number(form.age) || 20, surplus: goal, onboarded: true
    }).eq('id', userId);
    if (wantTemplate) {
      const { data: prog } = await supabase.from('programs')
        .insert({ user_id: userId, name: 'Cricket S&C (starter)', weeks: 4 }).select().single();
      if (prog) {
        for (const day of defaultProgramSeed()) {
          const { data: pd } = await supabase.from('program_days')
            .insert({ program_id: prog.id, day_of_week: day.day_of_week, title: day.title, subtitle: day.subtitle, day_type: day.day_type })
            .select().single();
          if (pd && day.exercises.length) {
            await supabase.from('program_exercises').insert(
              day.exercises.map((ex) => ({ program_day_id: pd.id, name: ex.name, target: ex.target, sort: ex.sort }))
            );
          }
        }
        await supabase.from('profiles').update({ active_program_id: prog.id }).eq('id', userId);
      }
    }
    await reload();
    setBusy(false);
  }

  return (
    <div className="max-w-xl mx-auto min-h-screen flex items-center px-4">
      <div className="w-full">
        <h1 className="font-display font-extrabold text-5xl text-center mb-1 text-cream tracking-tight">
          ATHLETE<span className="text-seam">OS</span>
        </h1>
        <div className="seam-rule mb-5" />

        {step === 0 && (
          <Card>
            <Eyebrow>Welcome · 1 of 3</Eyebrow>
            <H2>A bit about you</H2>
            <Sub>Used only to work out your daily food targets. You can change it any time.</Sub>
            <label className={labelCls}>Body weight (kg)</label>
            <input type="number" inputMode="decimal" className={inputCls} value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} />
            <label className={labelCls}>Height (cm)</label>
            <input type="number" inputMode="numeric" className={inputCls} value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} />
            <label className={labelCls}>Age</label>
            <input type="number" inputMode="numeric" className={inputCls} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            <button className={`${btnCls} w-full mt-4`} onClick={() => setStep(1)}>Next</button>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <Eyebrow>Goal · 2 of 3</Eyebrow>
            <H2>What are you after?</H2>
            <Sub>This sets your calorie target. Change it whenever your season changes.</Sub>
            {[{ v: 300, t: 'Build muscle', d: 'Eat slightly above maintenance' },
              { v: 0, t: 'Stay as I am', d: 'Eat at maintenance' },
              { v: -300, t: 'Trim down', d: 'Eat slightly below maintenance' }].map((g) => (
              <div key={g.v} onClick={() => setGoal(g.v)}
                className={`py-3 px-3 rounded-lg mb-2 border cursor-pointer ${goal === g.v ? 'border-seam bg-white' : 'border-ink/10 bg-white/50'}`}>
                <div className="font-semibold text-sm">{g.t}</div>
                <div className="font-serif italic text-inkMuted text-xs">{g.d}</div>
              </div>
            ))}
            <button className={`${btnCls} w-full mt-3`} onClick={() => setStep(2)}>Next</button>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <Eyebrow>Training · 3 of 3</Eyebrow>
            <H2>Your training week</H2>
            <Sub>Start with a proven cricket S&C template (2 strength, 1 power, 2 conditioning days) — or start blank and enter the plan your coach gave you. Either way you can edit every day and every exercise later.</Sub>
            <div onClick={() => setWantTemplate(true)}
              className={`py-3 px-3 rounded-lg mb-2 border cursor-pointer ${wantTemplate ? 'border-seam bg-white' : 'border-ink/10 bg-white/50'}`}>
              <div className="font-semibold text-sm">Use the starter template</div>
            </div>
            <div onClick={() => setWantTemplate(false)}
              className={`py-3 px-3 rounded-lg mb-2 border cursor-pointer ${!wantTemplate ? 'border-seam bg-white' : 'border-ink/10 bg-white/50'}`}>
              <div className="font-semibold text-sm">Start blank — I have my own plan</div>
            </div>
            <button className={`${btnGold} w-full mt-3`} onClick={finish} disabled={busy}>
              {busy ? 'Setting up…' : "Let's go"}
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}
