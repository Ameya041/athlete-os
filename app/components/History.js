'use client';
import { Card, Eyebrow, Empty, H2, Sub, Sparkline, FlipTile, btnSecondary } from './ui';

export default function History({ recentDays, recentWorkouts, recentMatches }) {
  // recentDays: oldest -> newest array of day_log rows (up to 28 days)
  const weights = recentDays.map((d) => d.morning_weight_kg);
  const loads = recentDays.map((d) => (d.session_rpe && d.session_minutes) ? d.session_rpe * d.session_minutes : null);
  const sleep = recentDays.map((d) => d.sleep_hours);

  // per-exercise best weight per day for the big three
  function liftTrend(name) {
    const byDate = {};
    recentWorkouts.forEach((w) => {
      if (!w.exercise?.toLowerCase().includes(name) || !w.weight_kg) return;
      const day = w.created_at?.slice(0, 10);
      byDate[day] = Math.max(byDate[day] || 0, Number(w.weight_kg));
    });
    return recentDays.map((d) => byDate[d.log_date] ?? null);
  }

  const squat = liftTrend('squat');
  const dead = liftTrend('deadlift');
  const bench = liftTrend('bench');

  const totalRuns = recentMatches.reduce((s, m) => s + (m.runs || 0), 0);
  const totalWkts = recentMatches.reduce((s, m) => s + (m.wickets || 0), 0);
  const dismissed = recentMatches.filter((m) => m.dismissal && !/not out/i.test(m.dismissal)).length;
  const avg = dismissed ? (totalRuns / dismissed).toFixed(1) : totalRuns > 0 ? 'NO' : '–';

  function exportCSV() {
    const header = 'date,weight_kg,readiness,sleep_hours,sleep_quality,session_rpe,session_minutes,training_load,meditation_minutes\n';
    const rows = recentDays.map((d) =>
      [d.log_date, d.morning_weight_kg ?? '', d.readiness ?? '', d.sleep_hours ?? '', d.sleep_quality ?? '',
        d.session_rpe ?? '', d.session_minutes ?? '',
        (d.session_rpe && d.session_minutes) ? d.session_rpe * d.session_minutes : '',
        d.meditation_minutes ?? ''].join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'athlete-os-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Card>
        <Eyebrow>Last {recentDays.length} days</Eyebrow>
        <H2>Trends</H2>
        <Sub>The picture your daily logs add up to.</Sub>

        <div className="mt-3">
          <div className="font-mono text-[10px] uppercase text-inkMuted mb-1">Morning weight (kg)</div>
          <Sparkline points={weights} />
        </div>
        <div className="mt-4">
          <div className="font-mono text-[10px] uppercase text-inkMuted mb-1">Training load (RPE × minutes)</div>
          <Sparkline points={loads} stroke="#C69A3E" />
        </div>
        <div className="mt-4">
          <div className="font-mono text-[10px] uppercase text-inkMuted mb-1">Sleep hours</div>
          <Sparkline points={sleep} stroke="#4C7A54" />
        </div>
      </Card>

      <Card>
        <Eyebrow>Strength progression — heaviest set per day</Eyebrow>
        <div className="mt-1">
          <div className="font-mono text-[10px] uppercase text-inkMuted mb-1">Squat</div>
          <Sparkline points={squat} />
        </div>
        <div className="mt-4">
          <div className="font-mono text-[10px] uppercase text-inkMuted mb-1">Deadlift</div>
          <Sparkline points={dead} />
        </div>
        <div className="mt-4">
          <div className="font-mono text-[10px] uppercase text-inkMuted mb-1">Bench press</div>
          <Sparkline points={bench} />
        </div>
      </Card>

      <Card>
        <Eyebrow>Matches — last 28 days</Eyebrow>
        <div className="grid grid-cols-4 gap-2 mt-1">
          <FlipTile value={recentMatches.length} caption="Matches" />
          <FlipTile value={totalRuns} caption="Runs" />
          <FlipTile value={avg} caption="Average" />
          <FlipTile value={totalWkts} caption="Wickets" />
        </div>
      </Card>

      <Card>
        <Eyebrow>Take it with you</Eyebrow>
        <Sub>Download your daily history as a CSV — useful for a coach, physio, or your own spreadsheet.</Sub>
        <button className={`${btnSecondary} w-full`} onClick={exportCSV}>Export CSV</button>
      </Card>
    </>
  );
}
