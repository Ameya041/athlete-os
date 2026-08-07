'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Card, Eyebrow, Empty, H2, Sub, FlipTile, inputCls, labelCls, btnCls, btnSecondary } from './ui';
import { Camera } from 'lucide-react';

export default function Cricket({ session, dayLog, cricket, matches, weekOvers, prevWeekOvers, reload, showToast }) {
  const [mode, setMode] = useState('practice');
  return (
    <>
      <Card>
        <Eyebrow>Bowling workload — this week</Eyebrow>
        <div className="grid grid-cols-2 gap-2.5">
          <FlipTile value={weekOvers} caption="Overs this week" />
          <FlipTile value={prevWeekOvers} caption="Overs last week" />
        </div>
        {prevWeekOvers > 0 && weekOvers > prevWeekOvers * 1.5 && (
          <p className="text-sm text-alert mt-3">
            Your bowling volume is up sharply on last week. Big jumps in workload are the strongest predictor of overuse injuries — worth easing the ramp.
          </p>
        )}
      </Card>

      <div className="flex gap-2 mb-3">
        <button className={`${mode === 'practice' ? btnCls : btnSecondary} flex-1`} onClick={() => setMode('practice')}>Practice</button>
        <button className={`${mode === 'match' ? btnCls : btnSecondary} flex-1`} onClick={() => setMode('match')}>Match scorecard</button>
      </div>

      {mode === 'practice'
        ? <PracticeForm session={session} dayLog={dayLog} cricket={cricket} reload={reload} showToast={showToast} />
        : <MatchForm dayLog={dayLog} matches={matches} reload={reload} showToast={showToast} />}
    </>
  );
}

function PracticeForm({ session, dayLog, cricket, reload, showToast }) {
  const [form, setForm] = useState({ bat: '', bowl: '', field: '', overs: '', rate: 3, focus: '' });
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);

  async function save() {
    setUploading(true);
    let photo_url = null;
    try {
      if (photo) {
        const path = `${session.user.id}/cricket/${Date.now()}-${photo.name}`;
        const { error } = await supabase.storage.from('athlete-os-media').upload(path, photo);
        if (!error) photo_url = supabase.storage.from('athlete-os-media').getPublicUrl(path).data.publicUrl;
      }
      await supabase.from('cricket_entries').insert({
        day_log_id: dayLog.id, session_type: 'practice', batting_notes: form.bat, bowling_notes: form.bowl + (form.overs ? ` (${form.overs} overs)` : ''),
        fielding_notes: form.field, rating: Number(form.rate), improvement_focus: form.focus, photo_url, source: 'manual'
      });
      showToast('Session saved ✓');
      setForm({ bat: '', bowl: '', field: '', overs: '', rate: 3, focus: '' });
      setPhoto(null);
      reload();
    } finally {
      setUploading(false);
    }
  }
  async function remove(id) { await supabase.from('cricket_entries').delete().eq('id', id); reload(); }

  return (
    <>
      <Card>
        <Eyebrow>Nets / practice</Eyebrow>
        <H2>Log a session</H2>
        <label className={labelCls}>Batting notes</label>
        <textarea className={inputCls} value={form.bat} onChange={(e) => setForm({ ...form, bat: e.target.value })} placeholder="Shot execution, footwork, vs pace/spin..." />
        <label className={labelCls}>Bowling notes</label>
        <textarea className={inputCls} value={form.bowl} onChange={(e) => setForm({ ...form, bowl: e.target.value })} placeholder="Line, length, turn, rhythm..." />
        <label className={labelCls}>Overs bowled in nets</label>
        <input type="number" inputMode="decimal" className={inputCls} value={form.overs} onChange={(e) => setForm({ ...form, overs: e.target.value })} placeholder="e.g. 6" />
        <label className={labelCls}>Fielding notes</label>
        <textarea className={inputCls} value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })} placeholder="Catches, ground fielding, energy..." />
        <label className={labelCls}>Session rating (1-5): <span className="text-seam font-bold">{form.rate}</span></label>
        <input type="range" min="1" max="5" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} className="w-full accent-seam" />
        <label className={labelCls}>One thing to improve</label>
        <input className={inputCls} value={form.focus} onChange={(e) => setForm({ ...form, focus: e.target.value })} />
        <label className={labelCls}>Technique photo — grip, stance, follow-through (optional)</label>
        <label className={`${btnSecondary} w-full flex items-center justify-center gap-2 cursor-pointer`}>
          <Camera size={16} /> {photo ? photo.name : 'Add a photo'}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
        </label>
        <button className={`${btnCls} w-full mt-3`} onClick={save} disabled={uploading}>{uploading ? 'Saving…' : 'Save session'}</button>
      </Card>

      <Card>
        <Eyebrow>Today&apos;s sessions</Eyebrow>
        {cricket.length === 0 ? <Empty>No sessions logged today.</Empty> : cricket.map((c) => (
          <div key={c.id} className="py-2 border-b border-ink/10 last:border-0 text-sm font-serif">
            <div className="flex justify-between"><b>{c.session_type}</b><span className="font-mono text-xs text-alert" onClick={() => remove(c.id)}>remove</span></div>
            {c.batting_notes && <div>Batting: {c.batting_notes}</div>}
            {c.bowling_notes && <div>Bowling: {c.bowling_notes}</div>}
            {c.fielding_notes && <div>Fielding: {c.fielding_notes}</div>}
            {c.photo_url && <img src={c.photo_url} alt="" className="mt-1.5 rounded-lg max-h-40 object-cover" />}
            <div className="font-mono text-xs text-inkMuted">Rating {c.rating || '–'}/5 {c.improvement_focus ? `· Focus: ${c.improvement_focus}` : ''}</div>
          </div>
        ))}
      </Card>
    </>
  );
}

function MatchForm({ dayLog, matches, reload, showToast }) {
  const [f, setF] = useState({ opponent: '', format: 'T20', runs: '', balls: '', dismissal: '', overs: '', maidens: '', conceded: '', wickets: '', catches: '', conditions: '', notes: '' });

  async function save() {
    await supabase.from('match_entries').insert({
      day_log_id: dayLog.id, opponent: f.opponent, format: f.format,
      runs: f.runs === '' ? null : Number(f.runs), balls: f.balls === '' ? null : Number(f.balls),
      dismissal: f.dismissal, overs_bowled: f.overs === '' ? null : Number(f.overs),
      maidens: f.maidens === '' ? null : Number(f.maidens), runs_conceded: f.conceded === '' ? null : Number(f.conceded),
      wickets: f.wickets === '' ? null : Number(f.wickets), catches: f.catches === '' ? null : Number(f.catches),
      conditions: f.conditions, notes: f.notes, source: 'manual'
    });
    showToast('Match saved ✓');
    reload();
  }
  async function remove(id) { await supabase.from('match_entries').delete().eq('id', id); reload(); }

  const econ = (m) => (m.overs_bowled && m.runs_conceded != null) ? (m.runs_conceded / m.overs_bowled).toFixed(1) : null;
  const sr = (m) => (m.runs != null && m.balls) ? ((m.runs / m.balls) * 100).toFixed(0) : null;

  return (
    <>
      <Card>
        <Eyebrow>Match day</Eyebrow>
        <H2>Scorecard</H2>
        <div className="grid grid-cols-2 gap-2.5">
          <div><label className={labelCls}>Opponent</label><input className={inputCls} value={f.opponent} onChange={(e) => setF({ ...f, opponent: e.target.value })} /></div>
          <div><label className={labelCls}>Format</label>
            <select className={inputCls} value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}>
              {['T20', '50-over', '2-day', '3-day', 'Other'].map((x) => <option key={x}>{x}</option>)}
            </select></div>
        </div>
        <div className={labelCls} style={{ marginTop: 14 }}>— Batting —</div>
        <div className="grid grid-cols-3 gap-2.5">
          <div><label className={labelCls}>Runs</label><input type="number" inputMode="numeric" className={inputCls} value={f.runs} onChange={(e) => setF({ ...f, runs: e.target.value })} /></div>
          <div><label className={labelCls}>Balls</label><input type="number" inputMode="numeric" className={inputCls} value={f.balls} onChange={(e) => setF({ ...f, balls: e.target.value })} /></div>
          <div><label className={labelCls}>Dismissal</label><input className={inputCls} value={f.dismissal} onChange={(e) => setF({ ...f, dismissal: e.target.value })} placeholder="b / lbw / c..." /></div>
        </div>
        <div className={labelCls} style={{ marginTop: 14 }}>— Bowling —</div>
        <div className="grid grid-cols-4 gap-2">
          <div><label className={labelCls}>Overs</label><input type="number" inputMode="decimal" className={inputCls} value={f.overs} onChange={(e) => setF({ ...f, overs: e.target.value })} /></div>
          <div><label className={labelCls}>Mdns</label><input type="number" inputMode="numeric" className={inputCls} value={f.maidens} onChange={(e) => setF({ ...f, maidens: e.target.value })} /></div>
          <div><label className={labelCls}>Runs</label><input type="number" inputMode="numeric" className={inputCls} value={f.conceded} onChange={(e) => setF({ ...f, conceded: e.target.value })} /></div>
          <div><label className={labelCls}>Wkts</label><input type="number" inputMode="numeric" className={inputCls} value={f.wickets} onChange={(e) => setF({ ...f, wickets: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div><label className={labelCls}>Catches</label><input type="number" inputMode="numeric" className={inputCls} value={f.catches} onChange={(e) => setF({ ...f, catches: e.target.value })} /></div>
          <div><label className={labelCls}>Conditions</label><input className={inputCls} value={f.conditions} onChange={(e) => setF({ ...f, conditions: e.target.value })} placeholder="Turning track, dewy..." /></div>
        </div>
        <label className={labelCls}>Notes</label>
        <textarea className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        <button className={`${btnCls} w-full mt-3`} onClick={save}>Save match</button>
      </Card>

      <Card>
        <Eyebrow>Today&apos;s matches</Eyebrow>
        {matches.length === 0 ? <Empty>No match logged today.</Empty> : matches.map((m) => (
          <div key={m.id} className="py-2 border-b border-ink/10 last:border-0 text-sm font-serif">
            <div className="flex justify-between">
              <b>vs {m.opponent || '?'} · {m.format}</b>
              <span className="font-mono text-xs text-alert" onClick={() => remove(m.id)}>remove</span>
            </div>
            <div className="font-mono text-xs text-inkMuted mt-1">
              Bat: {m.runs ?? '–'}({m.balls ?? '–'}){sr(m) ? ` SR ${sr(m)}` : ''} {m.dismissal ? `· ${m.dismissal}` : ''}
            </div>
            <div className="font-mono text-xs text-inkMuted">
              Bowl: {m.overs_bowled ?? '–'}-{m.maidens ?? '–'}-{m.runs_conceded ?? '–'}-{m.wickets ?? '–'}{econ(m) ? ` · econ ${econ(m)}` : ''} {m.catches ? `· ${m.catches} ct` : ''}
            </div>
            {m.conditions && <div className="text-xs">{m.conditions}</div>}
          </div>
        ))}
      </Card>
    </>
  );
}
