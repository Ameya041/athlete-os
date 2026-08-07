'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Card, Eyebrow, Empty, H2, Sub, FlipTile, inputCls, labelCls, btnCls, btnSecondary, btnGold } from './ui';
import { Mail, LogOut, HelpCircle } from 'lucide-react';

const SUPPORT_EMAIL = 'support@athleteos.app'; // placeholder — swap for your real inbox once you have one

export default function Profile({ session, profile, setProfile, recentDays, recentMatches, cricket, workout, onSignOut, onReopenHelp }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    primary_role: profile.primary_role || 'all-rounder',
    experience_years: profile.experience_years || '',
    injury_history: profile.injury_history || ''
  });
  const [busy, setBusy] = useState(false);

  const daysActive = recentDays.filter((d) => d.readiness != null || d.morning_weight_kg != null).length;
  const totalSessions = recentDays.filter((d) => d.session_rpe != null).length;
  const totalMeditation = recentDays.reduce((s, d) => s + (d.meditation_minutes || 0), 0);
  const streak = (() => {
    let s = 0;
    for (let i = recentDays.length - 1; i >= 0; i--) {
      const d = recentDays[i];
      if (d.session_rpe != null || d.meditation_done) s++; else break;
    }
    return s;
  })();

  async function saveProfile() {
    setBusy(true);
    const patch = {
      primary_role: form.primary_role,
      experience_years: Number(form.experience_years) || null,
      injury_history: form.injury_history
    };
    await supabase.from('profiles').update(patch).eq('id', session.user.id);
    setProfile({ ...profile, ...patch });
    setBusy(false);
    setEditing(false);
  }

  return (
    <>
      <Card>
        <Eyebrow>Signed in as</Eyebrow>
        <H2>{session.user.email}</H2>
        <Sub>{profile.primary_role || 'all-rounder'} · {profile.experience_years ? `${profile.experience_years} yrs training` : 'experience not set'}</Sub>
        <div className="grid grid-cols-4 gap-2 mt-2">
          <FlipTile value={streak} caption="Day streak" />
          <FlipTile value={totalSessions} caption="Sessions" />
          <FlipTile value={recentMatches.length} caption="Matches" />
          <FlipTile value={totalMeditation} caption="Meditate min" />
        </div>
      </Card>

      <Card>
        <Eyebrow>Settings</Eyebrow>
        <H2>Player details</H2>
        {!editing ? (
          <>
            <div className="text-sm font-serif py-1">Role: {profile.primary_role || '–'}</div>
            <div className="text-sm font-serif py-1">Experience: {profile.experience_years ? `${profile.experience_years} years` : '–'}</div>
            <div className="text-sm font-serif py-1">Injury history: {profile.injury_history || 'None noted'}</div>
            <button className={`${btnSecondary} w-full mt-3`} onClick={() => setEditing(true)}>Edit details</button>
          </>
        ) : (
          <>
            <label className={labelCls}>Role</label>
            <select className={inputCls} value={form.primary_role} onChange={(e) => setForm({ ...form, primary_role: e.target.value })}>
              {['batter', 'bowler', 'all-rounder', 'wicketkeeper'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <label className={labelCls}>Years of serious training</label>
            <input type="number" inputMode="numeric" className={inputCls} value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: e.target.value })} />
            <label className={labelCls}>Injury history</label>
            <textarea className={inputCls} value={form.injury_history} onChange={(e) => setForm({ ...form, injury_history: e.target.value })} />
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <button className={btnCls} onClick={saveProfile} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
              <button className={btnSecondary} onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </>
        )}
      </Card>

      <Card>
        <Eyebrow>Need something?</Eyebrow>
        <H2>Help & contact</H2>
        <button className={`${btnSecondary} w-full flex items-center justify-center gap-2`} onClick={onReopenHelp}>
          <HelpCircle size={16} /> Replay the how-it-works tour
        </button>
        <a href={`mailto:${SUPPORT_EMAIL}`} className={`${btnSecondary} w-full mt-2 flex items-center justify-center gap-2`}>
          <Mail size={16} /> Email support
        </a>
        <p className="font-mono text-[10px] text-inkMuted mt-2 text-center">{SUPPORT_EMAIL}</p>
      </Card>

      <Card>
        <button className={`${btnCls} w-full flex items-center justify-center gap-2`} onClick={onSignOut}>
          <LogOut size={16} /> Sign out
        </button>
        <p className="font-mono text-[9px] text-inkMuted mt-3 text-center">Athlete OS · beta</p>
      </Card>
    </>
  );
}
