'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Card, Eyebrow, Empty, H2, Sub, inputCls, labelCls, btnCls, btnGold } from './ui';
import { BODY_AREAS, WORSE_AFTER } from '../../lib/program';

export default function Body({ dayLog, niggles, recentNiggles, updateDayLog, reload, showToast }) {
  const [sleepH, setSleepH] = useState(dayLog.sleep_hours ?? '');
  const [sleepQ, setSleepQ] = useState(dayLog.sleep_quality ?? 3);
  const [n, setN] = useState({ area: BODY_AREAS[0], severity: 3, desc: '', worse: 'bowling' });

  async function saveSleep() {
    await updateDayLog({ sleep_hours: Number(sleepH) || null, sleep_quality: Number(sleepQ) });
    showToast('Sleep saved ✓');
  }

  async function saveNiggle() {
    await supabase.from('niggle_entries').insert({
      day_log_id: dayLog.id, body_area: n.area, severity: Number(n.severity),
      description: n.desc, worse_after: n.worse, source: 'manual'
    });
    setN({ area: BODY_AREAS[0], severity: 3, desc: '', worse: 'bowling' });
    showToast('Logged ✓');
    reload();
  }
  async function remove(id) { await supabase.from('niggle_entries').delete().eq('id', id); reload(); }

  // pattern flags across recent days
  const areaCounts = {};
  recentNiggles.forEach((r) => { areaCounts[r.body_area] = (areaCounts[r.body_area] || 0) + 1; });
  const recurring = Object.entries(areaCounts).filter(([, c]) => c >= 3).map(([a]) => a);
  const severe = niggles.some((x) => (x.severity || 0) >= 6);

  return (
    <>
      <Card>
        <Eyebrow>Last night</Eyebrow>
        <H2>Sleep</H2>
        <Sub>The biggest recovery lever there is. Log it daily and trends show up fast.</Sub>
        <div className="grid grid-cols-2 gap-2.5">
          <div><label className={labelCls}>Hours</label><input type="number" inputMode="decimal" step="0.5" className={inputCls} value={sleepH} onChange={(e) => setSleepH(e.target.value)} placeholder="7.5" /></div>
          <div><label className={labelCls}>Quality: <span className="text-seam font-bold">{sleepQ}</span>/5</label>
            <input type="range" min="1" max="5" value={sleepQ} onChange={(e) => setSleepQ(e.target.value)} className="w-full accent-seam mt-3" /></div>
        </div>
        <button className={`${btnGold} w-full mt-3`} onClick={saveSleep}>Save sleep</button>
      </Card>

      <Card>
        <Eyebrow>Pain & niggles</Eyebrow>
        <H2>Body log</H2>
        <Sub>Track it early, before it becomes an injury. This is a record for you and your physio — not a diagnosis.</Sub>
        <label className={labelCls}>Where</label>
        <select className={inputCls} value={n.area} onChange={(e) => setN({ ...n, area: e.target.value })}>
          {BODY_AREAS.map((a) => <option key={a}>{a}</option>)}
        </select>
        <label className={labelCls}>How much does it hurt: <span className="text-seam font-bold">{n.severity}</span>/10</label>
        <input type="range" min="1" max="10" value={n.severity} onChange={(e) => setN({ ...n, severity: e.target.value })} className="w-full accent-seam" />
        <label className={labelCls}>Worse after</label>
        <select className={inputCls} value={n.worse} onChange={(e) => setN({ ...n, worse: e.target.value })}>
          {WORSE_AFTER.map((w) => <option key={w}>{w}</option>)}
        </select>
        <label className={labelCls}>Describe it</label>
        <textarea className={inputCls} value={n.desc} onChange={(e) => setN({ ...n, desc: e.target.value })} placeholder="Dull ache low on the right side, eases after stretching..." />
        <button className={`${btnCls} w-full mt-3`} onClick={saveNiggle}>Log it</button>
      </Card>

      {(recurring.length > 0 || severe) && (
        <Card>
          <Eyebrow>Worth acting on</Eyebrow>
          {severe && (
            <p className="font-serif text-sm mb-2">
              You logged pain at 6/10 or above today. That level is beyond &ldquo;train through it&rdquo; territory — get it looked at by a physio or doctor before your next heavy session.
            </p>
          )}
          {recurring.map((a) => (
            <p key={a} className="font-serif text-sm mb-2">
              <b>{a}</b> has come up {areaCounts[a]} times in the last two weeks. A recurring pattern like this deserves a professional assessment — take this log with you, it will genuinely help them.
            </p>
          ))}
        </Card>
      )}

      <Card>
        <Eyebrow>Today&apos;s entries</Eyebrow>
        {niggles.length === 0 ? <Empty>Nothing logged today. Good sign.</Empty> : niggles.map((x) => (
          <div key={x.id} className="py-2 border-b border-ink/10 last:border-0 text-sm font-serif">
            <div className="flex justify-between">
              <b>{x.body_area} — {x.severity}/10</b>
              <span className="font-mono text-xs text-seam" onClick={() => remove(x.id)}>remove</span>
            </div>
            {x.description && <div>{x.description}</div>}
            {x.worse_after && <div className="font-mono text-xs text-inkMuted">worse after {x.worse_after}</div>}
          </div>
        ))}
      </Card>
    </>
  );
}
