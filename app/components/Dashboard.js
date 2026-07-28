'use client';
import { useState } from 'react';
import { Card, Eyebrow, Empty, H2, Sub, FlipTile, btnCls, btnSecondary, labelCls } from './ui';
import { PREHAB } from '../../lib/program';

export default function Dashboard({ dayLog, todayPlan, workout, food, updateDayLog, setTab }) {
  const kcal = food.reduce((s, f) => s + (f.calories || 0), 0);
  const [readiness, setReadiness] = useState(dayLog.readiness ?? 3);

  return (
    <>
      {dayLog.readiness == null && (
        <Card>
          <Eyebrow>Morning check-in</Eyebrow>
          <H2>How ready do you feel?</H2>
          <Sub>One tap. Be honest — it shapes how hard to push today.</Sub>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n}
                onClick={() => setReadiness(n)}
                className={`rounded-lg py-3 font-display font-bold text-xl border ${readiness === n ? 'bg-seam text-paper border-seam' : 'bg-white border-ink/15 text-ink'}`}>
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
