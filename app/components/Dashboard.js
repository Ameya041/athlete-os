'use client';
import { useState } from 'react';
import { Card, Eyebrow, Empty, H2, Sub, FlipTile, btnCls, btnSecondary, labelCls } from './ui';
import { PREHAB } from '../../lib/program';
import { TrendingUp, TrendingDown, Minus, Flame } from 'lucide-react';

function Delta({ label, today, yesterday, unit = '', goodDirection = 'up' }) {
  if (today == null || yesterday == null) return null;
  const diff = Math.round((today - yesterday) * 10) / 10;
  if (diff === 0) return (
    <div className="flex items-center justify-between py-1.5 border-b border-ink/10 last:border-0 text-sm font-serif">
      <span>{label}</span><span className="flex items-center gap-1 text-inkMuted font-mono text-xs"><Minus size={12} /> same as yesterday</span>
    </div>
  );
  const isUp = diff > 0;
  const good = goodDirection === 'up' ? isUp : !isUp;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-ink/10 last:border-0 text-sm font-serif">
      <span>{label}</span>
      <span className={`flex items-center gap-1 font-mono text-xs ${good ? 'text-good' : 'text-alert'}`}>
        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {isUp ? '+' : ''}{diff}{unit} vs yesterday
      </span>
    </div>
  );
}

export default function Dashboard({ dayLog, todayPlan, workout, food, updateDayLog, setTab, streak, bestStreak, yesterdayLog }) {
  const kcal = food.reduce((s, f) => s + (f.calories || 0), 0);
  const [readiness, setReadiness] = useState(dayLog.readiness ?? 3);
  const todayLoad = (dayLog.session_rpe && dayLog.session_minutes) ? dayLog.session_rpe * dayLog.session_minutes : null;
  const yesterdayLoad = (yesterdayLog?.session_rpe && yesterdayLog?.session_minutes) ? yesterdayLog.session_rpe * yesterdayLog.session_minutes : null;

  return (
    <>
      {streak > 0 && (
        <Card className="!bg-seam/10 !border-seam/25 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-seam/20 flex items-center justify-center flex-none"><Flame size={20} className="text-seam" /></div>
          <div>
            <div className="font-display text-2xl leading-none text-ink">{streak} day{streak === 1 ? '' : 's'}</div>
            <div className="font-mono text-[10px] text-inkMuted uppercase">
              {streak >= bestStreak ? "That's your best streak yet" : `Best ever: ${bestStreak} days`}
            </div>
          </div>
        </Card>
      )}

      {dayLog.readiness == null && (
        <Card>
          <Eyebrow>Morning check-in</Eyebrow>
          <H2>How ready do you feel?</H2>
          <Sub>One tap. Be honest — it shapes how hard to push today.</Sub>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n}
                onClick={() => setReadiness(n)}
                className={`rounded-lg py-3 font-display font-bold text-xl border ${readiness === n ? 'bg-seam text-bg border-seam' : 'bg-paperDim border-white/10 text-ink'}`}>
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between font-mono text-[9px] text-inkMuted mt-1 px-1">
            <span>Wrecked</span><span>Fresh</span>
          </div>
          <button className={`${btnCls} w-full mt-3`} onClick={() => updateDayLog({ readiness })}>Save</button>
        </Card>
      )}

      <Card>
        <Eyebrow>{todayPlan?.day_type || 'today'}</Eyebrow>
        <H2>{todayPlan?.title || 'No plan for today'}</H2>
        <Sub>{todayPlan?.subtitle || 'Open Train to set up your program.'}</Sub>
        <div className="grid grid-cols-4 gap-2 mt-3">
          <FlipTile value={workout.length} caption="Sets" />
          <FlipTile value={dayLog.morning_weight_kg ?? '–'} caption="Kg" />
          <FlipTile value={kcal} caption="Kcal" />
          <FlipTile value={dayLog.readiness ?? '–'} caption="Ready /5" />
        </div>
      </Card>

      {yesterdayLog && (
        <Card>
          <Eyebrow>Compared to yesterday</Eyebrow>
          <H2>Small moves</H2>
          <Delta label="Morning weight" today={dayLog.morning_weight_kg} yesterday={yesterdayLog.morning_weight_kg} unit="kg" goodDirection="down" />
          <Delta label="Training load" today={todayLoad} yesterday={yesterdayLoad} goodDirection="up" />
          <Delta label="Sleep" today={dayLog.sleep_hours} yesterday={yesterdayLog.sleep_hours} unit="h" goodDirection="up" />
          <Delta label="Readiness" today={dayLog.readiness} yesterday={yesterdayLog.readiness} unit="/5" goodDirection="up" />
        </Card>
      )}

      <Card>
        <Eyebrow>Daily prehab — before gym / nets</Eyebrow>
        {PREHAB.map((p, i) => (
          <div key={i} className="text-sm font-serif py-1.5 border-b border-ink/10 last:border-0">{p}</div>
        ))}
        <button
          className={`${dayLog.prehab_done ? btnSecondary : btnCls} w-full mt-3`}
          onClick={() => updateDayLog({ prehab_done: !dayLog.prehab_done })}>
          {dayLog.prehab_done ? 'Prehab done ✓' : 'Mark prehab done'}
        </button>
      </Card>

      <Card>
        <Eyebrow>Quick actions</Eyebrow>
        <div className="grid grid-cols-2 gap-2.5">
          <button className={btnCls} onClick={() => setTab('ailog')}>Talk / Log</button>
          <button className={btnSecondary} onClick={() => setTab('train')}>Open workout</button>
        </div>
      </Card>
    </>
  );
}
