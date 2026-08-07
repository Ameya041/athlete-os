'use client';
import { Card, Eyebrow, Empty, H2, Sub, FlipTile, btnSecondary } from './ui';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import ShareCardButton from './ShareCard';

const CHART_COLORS = { seam: '#22C55E', willow: '#D4B25A', good: '#34D399' };

function Trend({ data, dataKey, color, unit = '' }) {
  const clean = data.filter((d) => d[dataKey] != null);
  if (clean.length < 2) return <div className="text-inkMuted text-xs font-serif italic py-2">Not enough data yet — keep logging daily.</div>;
  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F4EF15" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#7C897B' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#7C897B' }} axisLine={false} tickLine={false} width={30} />
        <Tooltip
          contentStyle={{ background: '#171D15', border: '1px solid #F1F4EF1A', color: '#F1F4EF', borderRadius: 8, fontFamily: 'Inter', fontSize: 12 }}
          formatter={(v) => [`${v}${unit}`, '']} labelStyle={{ fontFamily: 'JetBrains Mono', fontSize: 10 }} />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 2 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function History({ recentDays, recentWorkouts, recentMatches, profile, streak, session }) {
  // recentDays: oldest -> newest array of day_log rows (up to 28 days)
  function liftByDate(name) {
    const byDate = {};
    recentWorkouts.forEach((w) => {
      if (!w.exercise?.toLowerCase().includes(name) || !w.weight_kg) return;
      const day = w.created_at?.slice(0, 10);
      byDate[day] = Math.max(byDate[day] || 0, Number(w.weight_kg));
    });
    return byDate;
  }
  const squatByDate = liftByDate('squat');
  const deadByDate = liftByDate('deadlift');
  const benchByDate = liftByDate('bench');

  const chartData = recentDays.map((d) => {
    const dt = new Date(d.log_date + 'T00:00:00');
    return {
      label: dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      weight: d.morning_weight_kg ?? null,
      load: (d.session_rpe && d.session_minutes) ? d.session_rpe * d.session_minutes : null,
      sleep: d.sleep_hours ?? null,
      squat: squatByDate[d.log_date] ?? null,
      deadlift: deadByDate[d.log_date] ?? null,
      bench: benchByDate[d.log_date] ?? null
    };
  });

  const totalRuns = recentMatches.reduce((s, m) => s + (m.runs || 0), 0);
  const totalWkts = recentMatches.reduce((s, m) => s + (m.wickets || 0), 0);
  const dismissed = recentMatches.filter((m) => m.dismissal && !/not out/i.test(m.dismissal)).length;
  const avg = dismissed ? (totalRuns / dismissed).toFixed(1) : totalRuns > 0 ? 'NO' : '–';
  const totalOvers = Math.round(recentMatches.reduce((s, m) => s + (Number(m.overs_bowled) || 0), 0) * 10) / 10;

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
          <Trend data={chartData} dataKey="weight" color={CHART_COLORS.seam} unit="kg" />
        </div>
        <div className="mt-4">
          <div className="font-mono text-[10px] uppercase text-inkMuted mb-1">Training load (RPE × minutes)</div>
          <Trend data={chartData} dataKey="load" color={CHART_COLORS.willow} />
        </div>
        <div className="mt-4">
          <div className="font-mono text-[10px] uppercase text-inkMuted mb-1">Sleep hours</div>
          <Trend data={chartData} dataKey="sleep" color={CHART_COLORS.good} unit="h" />
        </div>
      </Card>

      <Card>
        <Eyebrow>Strength progression — heaviest set per day</Eyebrow>
        <div className="mt-1">
          <div className="font-mono text-[10px] uppercase text-inkMuted mb-1">Squat</div>
          <Trend data={chartData} dataKey="squat" color={CHART_COLORS.seam} unit="kg" />
        </div>
        <div className="mt-4">
          <div className="font-mono text-[10px] uppercase text-inkMuted mb-1">Deadlift</div>
          <Trend data={chartData} dataKey="deadlift" color={CHART_COLORS.willow} unit="kg" />
        </div>
        <div className="mt-4">
          <div className="font-mono text-[10px] uppercase text-inkMuted mb-1">Bench press</div>
          <Trend data={chartData} dataKey="bench" color={CHART_COLORS.good} unit="kg" />
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
        <div className="mt-3">
          <div className="font-mono text-[10px] uppercase text-inkMuted mb-1">Overs bowled: {totalOvers} total</div>
        </div>
      </Card>

      <Card>
        <Eyebrow>Show it off</Eyebrow>
        <Sub>A shareable image of your week — post it, or send it straight to your coach.</Sub>
        <ShareCardButton data={{
          name: profile?.display_name || session?.user?.email?.split('@')[0] || 'Player',
          streak, sessions: recentDays.filter((d) => d.session_rpe != null).length,
          matches: recentMatches.length, runs: totalRuns, wickets: totalWkts,
          meditationMin: recentDays.reduce((s, d) => s + (d.meditation_minutes || 0), 0)
        }} />
      </Card>

      <Card>
        <Eyebrow>Take it with you</Eyebrow>
        <Sub>Download your daily history as a CSV — useful for a coach, physio, or your own spreadsheet.</Sub>
        <button className={`${btnSecondary} w-full`} onClick={exportCSV}>Export CSV</button>
      </Card>
    </>
  );
}
