'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { todayISO, fmtDate, isoDaysAgo, DEFAULT_PROFILE, defaultProgramSeed } from '../lib/program';
import { Card, Eyebrow, H2, Sub, btnCls, btnGold, btnSecondary, inputCls, labelCls } from './components/ui';
import { LayoutGrid, Mic, Dumbbell, Trophy, HeartPulse, Apple, Brain, LineChart as LineChartIcon, HelpCircle, X, User, Users } from 'lucide-react';
import Dashboard from './components/Dashboard';
import AiLog from './components/AiLog';
import Train from './components/Train';
import Cricket from './components/Cricket';
import Body from './components/Body';
import Nutrition from './components/Nutrition';
import Mind from './components/Mind';
import History from './components/History';
import Profile from './components/Profile';
import Feed from './components/Feed';

const TABS = [
  { id: 'dashboard', label: 'Today', icon: LayoutGrid, help: 'Your snapshot for today: the plan, your morning readiness, and quick shortcuts.' },
  { id: 'ailog', label: 'AI', icon: Mic, help: 'Talk or type about your day — training, food, sleep, cricket, mood — and it gets sorted automatically. Also where you get your daily coach review.' },
  { id: 'train', label: 'Train', icon: Dumbbell, help: 'Log today\u2019s workout, rate how hard it felt, or build/edit your training program.' },
  { id: 'cricket', label: 'Cricket', icon: Trophy, help: 'Log nets sessions and full match scorecards. Watch your bowling workload here.' },
  { id: 'body', label: 'Body', icon: HeartPulse, help: 'Track sleep and any pain or niggles — early, before they become injuries.' },
  { id: 'nutrition', label: 'Food', icon: Apple, help: 'Your daily calorie and macro targets, and a place to log what you eat.' },
  { id: 'mind', label: 'Mind', icon: Brain, help: 'Mood check-ins and guided meditation, with spoken instructions.' },
  { id: 'history', label: 'History', icon: LineChartIcon, help: 'Graphs of your trends over the last month: weight, training load, sleep, strength, and match stats.' },
  { id: 'feed', label: 'Feed', icon: Users, help: 'Share wins with friends and cheer each other on — visible posts, not private messaging.' },
  { id: 'profile', label: 'Profile', icon: User, help: 'Your account, player details, stats summary, friends, and support contact.' }
];

export default function App() {
  const router = useRouter();
  const [session, setSession] = useState(undefined);
  const [tab, setTab] = useState('dashboard');
  const [helpOpen, setHelpOpen] = useState(false);
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
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
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

    const { data: friendRows } = await supabase.rpc('get_my_friends');
    const accepted = (friendRows || []).filter((f) => f.status === 'accepted');
    const incoming = (friendRows || []).filter((f) => f.status === 'pending' && !f.i_am_requester)
      .map((f) => ({ id: f.friendship_id, requester_email: f.email }));
    setFriends(accepted.map((f) => ({ id: f.other_user_id, email: f.email, display_name: f.display_name })));
    setIncomingRequests(incoming);

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

  useEffect(() => {
    if (profile?.onboarded && profile?.seen_help_tour === false) setHelpOpen(true);
  }, [profile]);

  useEffect(() => {
    if (!session?.user || !recentDays.length) return;
    let s = 0;
    for (let i = recentDays.length - 1; i >= 0; i--) {
      const d = recentDays[i];
      const active = d.session_rpe != null || d.meditation_done || d.readiness != null || d.morning_weight_kg != null;
      if (active) s++; else break;
    }
    if (s > 0 && s > (profile.best_streak || 0)) {
      supabase.from('profiles').update({ best_streak: s }).eq('id', session.user.id).then(() => {
        setProfile((p) => ({ ...p, best_streak: s }));
      });
    }
  }, [session, recentDays, profile.best_streak]);

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

  async function addFriend(email) {
    if (!email.trim()) return;
    const { data: targetId } = await supabase.rpc('find_user_id_by_email', { lookup_email: email.trim() });
    if (!targetId) { showToast('No player found with that email'); return; }
    if (targetId === session.user.id) { showToast("That's you!"); return; }
    const { error } = await supabase.from('friendships').insert({ user_id: session.user.id, friend_id: targetId, status: 'pending' });
    if (error) showToast('Already sent, or already friends');
    else showToast('Friend request sent ✓');
    loadEverything();
  }

  async function respondFriend(friendshipId, accept) {
    if (accept) await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    else await supabase.from('friendships').delete().eq('id', friendshipId);
    loadEverything();
  }

  // today's plan from the active program
  const todayDow = new Date().getDay();
  const todayPlan = activeProgram?.days?.find((d) => d.day_of_week === todayDow) || null;
  const todayExercises = todayPlan?.exercises || [];

  // current streak: consecutive days (ending today) with any real activity logged
  let streak = 0;
  for (let i = recentDays.length - 1; i >= 0; i--) {
    const d = recentDays[i];
    const active = d.session_rpe != null || d.meditation_done || d.readiness != null || d.morning_weight_kg != null;
    if (active) streak++; else break;
  }
  const bestStreak = Math.max(profile.best_streak || 0, streak);

  // yesterday vs today, for small motivating deltas on the dashboard
  const yesterdayLog = recentDays.find((d) => d.log_date === isoDaysAgo(1)) || null;

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
          <div className="text-right flex items-start gap-3">
            <button onClick={() => setHelpOpen(true)} className="w-8 h-8 rounded-full bg-bgElev2 border border-white/10 flex items-center justify-center text-cream" aria-label="How this app works">
              <HelpCircle size={16} />
            </button>
            <div className="font-mono text-[11px] text-muted pt-1.5">{fmtDate(iso).toUpperCase()}</div>
          </div>
        </div>
        <div className="seam-rule mt-3" />
        <div className="flex gap-1 mt-4 overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`folder-tab flex-none flex flex-col items-center gap-1 text-[10px] uppercase tracking-wide px-3 py-2.5 rounded-t-lg border border-b-0 whitespace-nowrap ${
                  tab === t.id ? 'is-active' : 'bg-bgElev2 border-white/10 text-muted'
                }`}>
                <Icon size={16} strokeWidth={2} />
                {t.label}
              </button>
            );
          })}
          <div className="flex-none w-2" />
        </div>
      </div>

      {helpOpen && <HelpTour onClose={() => setHelpOpen(false)} />}

      <main className="px-4">
        <div key={tab} className="view-enter">
          {dayLog && tab === 'dashboard' && (
            <Dashboard dayLog={dayLog} todayPlan={todayPlan} workout={workout} food={food} updateDayLog={updateDayLog}
              setTab={setTab} streak={streak} bestStreak={bestStreak} yesterdayLog={yesterdayLog} />
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
            <Cricket session={session} dayLog={dayLog} cricket={cricket} matches={matches} weekOvers={weekOvers}
              prevWeekOvers={prevWeekOvers} reload={loadEverything} showToast={showToast} />
          )}
          {dayLog && tab === 'body' && (
            <Body session={session} dayLog={dayLog} niggles={niggles} recentNiggles={recentNiggles}
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
            <History recentDays={recentDays} recentWorkouts={recentWorkouts} recentMatches={recentMatches}
              profile={profile} streak={streak} session={session} />
          )}
          {dayLog && tab === 'feed' && (
            <Feed session={session} dayLog={dayLog} recentMatches={recentMatches} streak={streak} />
          )}
          {dayLog && tab === 'profile' && (
            <Profile session={session} profile={profile} setProfile={setProfile} recentDays={recentDays}
              recentMatches={recentMatches} streak={streak} bestStreak={bestStreak}
              friends={friends} incomingRequests={incomingRequests}
              onAddFriend={addFriend} onRespondFriend={respondFriend}
              onSignOut={signOut} onReopenHelp={() => setHelpOpen(true)} onOpenFeed={() => setTab('feed')} />
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
/* A simple, dismissible walkthrough of every tab — shown automatically once after onboarding, reopenable any time from the ? button */
function HelpTour({ onClose }) {
  async function dismiss() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from('profiles').update({ seen_help_tour: true }).eq('id', user.id);
    } catch (e) { /* non-critical */ }
    onClose();
  }
  return (
    <div className="fixed inset-0 z-50 bg-bg/95 flex items-center justify-center px-4">
      <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto bg-paper text-ink rounded-xl p-5">
        <div className="flex justify-between items-start mb-2">
          <div>
            <Eyebrow>How this app works</Eyebrow>
            <H2>One tab, one job each</H2>
          </div>
          <button onClick={dismiss} className="w-8 h-8 rounded-full bg-ink/10 flex items-center justify-center"><X size={16} /></button>
        </div>
        <Sub>The fastest way to use this: after any session, just open AI and talk. Everything below still works if you'd rather enter things by hand.</Sub>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.id} className="flex gap-3 py-3 border-b border-ink/10 last:border-0">
              <div className="w-9 h-9 rounded-lg bg-seam/10 flex items-center justify-center flex-none text-seam"><Icon size={18} /></div>
              <div>
                <div className="font-semibold text-sm">{t.label}</div>
                <div className="font-serif text-inkMuted text-sm">{t.help}</div>
              </div>
            </div>
          );
        })}
        <button className={`${btnCls} w-full mt-4`} onClick={dismiss}>Got it, let's go</button>
      </div>
    </div>
  );
}

function Onboarding({ profile, setProfile, userId, reload }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ weight_kg: profile.weight_kg, height_cm: profile.height_cm, age: profile.age });
  const [goal, setGoal] = useState(300);
  const [wantTemplate, setWantTemplate] = useState(true);
  const [assess, setAssess] = useState({ role: 'all-rounder', experience_years: '', squat: '', deadlift: '', bench: '', aerobic: '', injuries: '' });
  const [busy, setBusy] = useState(false);

  async function finish() {
    setBusy(true);
    await supabase.from('profiles').update({
      weight_kg: Number(form.weight_kg) || 70, height_cm: Number(form.height_cm) || 175,
      age: Number(form.age) || 20, surplus: goal,
      primary_role: assess.role, experience_years: Number(assess.experience_years) || null,
      squat_est_1rm: Number(assess.squat) || null, deadlift_est_1rm: Number(assess.deadlift) || null,
      bench_est_1rm: Number(assess.bench) || null, aerobic_note: assess.aerobic, injury_history: assess.injuries,
      assessment_done: true, onboarded: true
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
            <Eyebrow>Welcome · 1 of 4</Eyebrow>
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
            <Eyebrow>Goal · 2 of 4</Eyebrow>
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
            <Eyebrow>Quick assessment · 3 of 4</Eyebrow>
            <H2>Where are you starting from?</H2>
            <Sub>No wrong answers — leave anything blank if you're not sure. This just helps set a sensible starting point, and gives your future coach useful context.</Sub>
            <label className={labelCls}>Your role</label>
            <select className={inputCls} value={assess.role} onChange={(e) => setAssess({ ...assess, role: e.target.value })}>
              {['batter', 'bowler', 'all-rounder', 'wicketkeeper'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <label className={labelCls}>Years of serious training</label>
            <input type="number" inputMode="numeric" className={inputCls} value={assess.experience_years} onChange={(e) => setAssess({ ...assess, experience_years: e.target.value })} placeholder="e.g. 3" />
            <div className="grid grid-cols-3 gap-2.5">
              <div><label className={labelCls}>Squat (kg)</label><input type="number" inputMode="numeric" className={inputCls} value={assess.squat} onChange={(e) => setAssess({ ...assess, squat: e.target.value })} placeholder="Best effort" /></div>
              <div><label className={labelCls}>Deadlift (kg)</label><input type="number" inputMode="numeric" className={inputCls} value={assess.deadlift} onChange={(e) => setAssess({ ...assess, deadlift: e.target.value })} placeholder="Best effort" /></div>
              <div><label className={labelCls}>Bench (kg)</label><input type="number" inputMode="numeric" className={inputCls} value={assess.bench} onChange={(e) => setAssess({ ...assess, bench: e.target.value })} placeholder="Best effort" /></div>
            </div>
            <label className={labelCls}>Aerobic fitness (any number you have)</label>
            <input className={inputCls} value={assess.aerobic} onChange={(e) => setAssess({ ...assess, aerobic: e.target.value })} placeholder="e.g. 2km in 8:30, or Yo-Yo 18.5" />
            <label className={labelCls}>Any past injuries worth knowing about</label>
            <textarea className={inputCls} value={assess.injuries} onChange={(e) => setAssess({ ...assess, injuries: e.target.value })} placeholder="e.g. rotator cuff niggle, lower back soreness..." />
            <button className={`${btnCls} w-full mt-4`} onClick={() => setStep(3)}>Next</button>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <Eyebrow>Training · 4 of 4</Eyebrow>
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
