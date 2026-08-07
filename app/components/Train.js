'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Card, Eyebrow, Empty, H2, Sub, inputCls, labelCls, btnCls, btnSecondary, btnGold } from './ui';
import { CORE_CIRCUIT, DAY_TYPES, defaultProgramSeed, todayISO, fmtDate } from '../../lib/program';

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Train({ dayLog, todayPlan, todayExercises, programs, activeProgram, workout, userId, reload, showToast, updateDayLog }) {
  const [mode, setMode] = useState('today'); // today | builder
  return (
    <>
      <div className="flex gap-2 mb-3">
        <button className={`${mode === 'today' ? btnCls : btnSecondary} flex-1`} onClick={() => setMode('today')}>Today&apos;s session</button>
        <button className={`${mode === 'builder' ? btnCls : btnSecondary} flex-1`} onClick={() => setMode('builder')}>My program</button>
      </div>
      {mode === 'today'
        ? <TodaySession dayLog={dayLog} todayPlan={todayPlan} todayExercises={todayExercises} workout={workout} reload={reload} showToast={showToast} updateDayLog={updateDayLog} />
        : <ProgramBuilder programs={programs} activeProgram={activeProgram} userId={userId} reload={reload} showToast={showToast} />}
    </>
  );
}

function TodaySession({ dayLog, todayPlan, todayExercises, workout, reload, showToast, updateDayLog }) {
  const [vals, setVals] = useState({});
  const [rpe, setRpe] = useState(dayLog.session_rpe ?? 6);
  const [minutes, setMinutes] = useState(dayLog.session_minutes ?? 60);

  async function logSets() {
    const inserts = [];
    todayExercises.forEach((ex, i) => {
      const kg = vals[`w_${i}`];
      const reps = vals[`r_${i}`];
      if (kg || reps) {
        inserts.push(supabase.from('workout_entries').insert({
          day_log_id: dayLog.id, exercise: ex.name,
          sets_reps: reps ? `${reps} reps` : (ex.target || ''), weight_kg: kg ? Number(kg) : null,
          notes: '', source: 'manual'
        }));
      }
    });
    if (!inserts.length) { showToast('Enter at least one weight or rep count'); return; }
    await Promise.all(inserts);
    showToast('Sets logged ✓');
    reload();
  }

  async function saveEffort() {
    await updateDayLog({ session_rpe: Number(rpe), session_minutes: Number(minutes) });
    showToast('Effort saved ✓');
  }

  async function removeEntry(id) {
    await supabase.from('workout_entries').delete().eq('id', id);
    reload();
  }

  return (
    <>
      <Card>
        <Eyebrow>{fmtDate(todayISO())}</Eyebrow>
        <H2>{todayPlan?.title || 'No plan set for today'}</H2>
        <Sub>{todayPlan?.subtitle || 'Build or activate a program in the My Program tab.'}</Sub>

        {todayExercises.map((ex, i) => (
          <div key={ex.id || i} className="flex justify-between items-center py-2.5 border-b border-ink/10 gap-2">
            <div>
              <div className="text-base font-semibold font-body">{ex.name}</div>
              {ex.target && <div className="font-mono text-xs text-inkMuted">{ex.target}</div>}
            </div>
            <div className="flex gap-1.5">
              <input type="number" placeholder="kg" inputMode="decimal" className="w-16 bg-paperDim border border-white/10 rounded-lg text-center py-2 font-mono text-sm"
                onChange={(e) => setVals((v) => ({ ...v, [`w_${i}`]: e.target.value }))} />
              <input type="number" placeholder="reps" inputMode="numeric" className="w-16 bg-paperDim border border-white/10 rounded-lg text-center py-2 font-mono text-sm"
                onChange={(e) => setVals((v) => ({ ...v, [`r_${i}`]: e.target.value }))} />
            </div>
          </div>
        ))}
        {todayExercises.length > 0 && <button className={`${btnCls} w-full mt-3`} onClick={logSets}>Log these sets</button>}
        {todayExercises.length === 0 && todayPlan && <Empty>No exercises listed for today — recovery, conditioning, or rest.</Empty>}
      </Card>

      <Card>
        <Eyebrow>How hard was it?</Eyebrow>
        <H2>Session effort</H2>
        <Sub>Effort × minutes gives your training load — the number that catches dangerous weekly spikes before they become injuries.</Sub>
        <label className={labelCls}>Effort (RPE): <span className="text-seam font-bold">{rpe}</span>/10</label>
        <input type="range" min="1" max="10" value={rpe} onChange={(e) => setRpe(e.target.value)} className="w-full accent-seam" />
        <label className={labelCls}>Session length (minutes)</label>
        <input type="number" inputMode="numeric" className={inputCls} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        <button className={`${btnGold} w-full mt-3`} onClick={saveEffort}>Save effort</button>
      </Card>

      {(todayPlan?.day_type === 'strength' || todayPlan?.day_type === 'power') && (
        <Card>
          <Eyebrow>Core circuit — end of session</Eyebrow>
          {CORE_CIRCUIT.map((c, i) => <div key={i} className="text-sm font-serif py-1.5 border-b border-ink/10 last:border-0">{c}</div>)}
        </Card>
      )}

      <Card>
        <Eyebrow>Logged today</Eyebrow>
        {workout.length === 0 ? <Empty>No sets logged yet.</Empty> : workout.map((w) => (
          <div key={w.id} className="py-2 border-b border-ink/10 last:border-0 text-sm font-serif">
            <div className="flex justify-between">
              <b>{w.exercise}</b>
              <span className="font-mono text-xs text-alert" onClick={() => removeEntry(w.id)}>remove</span>
            </div>
            <div className="font-mono text-xs text-inkMuted">{w.sets_reps} {w.weight_kg ? `· ${w.weight_kg}kg` : ''} {w.source === 'ai' ? '· via AI log' : ''}</div>
          </div>
        ))}
      </Card>
    </>
  );
}

function ProgramBuilder({ programs, activeProgram, userId, reload, showToast }) {
  const [name, setName] = useState('');
  const [weeks, setWeeks] = useState(4);
  const [editingDay, setEditingDay] = useState(null); // program_day row being edited
  const [dayForm, setDayForm] = useState({ title: '', subtitle: '', day_type: 'strength' });
  const [newEx, setNewEx] = useState({ name: '', target: '' });

  async function createProgram(seedDefault) {
    const pName = name.trim() || (seedDefault ? 'Cricket S&C (starter)' : 'My program');
    const { data: prog, error } = await supabase.from('programs')
      .insert({ user_id: userId, name: pName, weeks: Number(weeks) || 4 }).select().single();
    if (error) { showToast('Could not create program'); return; }
    if (seedDefault) {
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
    }
    await supabase.from('profiles').update({ active_program_id: prog.id }).eq('id', userId);
    setName('');
    showToast('Program created ✓');
    reload();
  }

  async function activate(id) {
    await supabase.from('profiles').update({ active_program_id: id }).eq('id', userId);
    showToast('Program activated ✓');
    reload();
  }

  async function deleteProgram(id) {
    await supabase.from('programs').delete().eq('id', id);
    showToast('Program deleted');
    reload();
  }

  async function saveDay(dow) {
    if (!activeProgram) return;
    if (!dayForm.title.trim()) { showToast('Give the day a title'); return; }
    const existing = (activeProgram.days || []).find((d) => d.day_of_week === dow);
    if (existing) {
      await supabase.from('program_days').update({ title: dayForm.title, subtitle: dayForm.subtitle, day_type: dayForm.day_type }).eq('id', existing.id);
    } else {
      await supabase.from('program_days').insert({ program_id: activeProgram.id, day_of_week: dow, title: dayForm.title, subtitle: dayForm.subtitle, day_type: dayForm.day_type });
    }
    setEditingDay(null);
    showToast('Day saved ✓');
    reload();
  }

  async function addExercise(programDayId) {
    if (!newEx.name.trim()) { showToast('Exercise needs a name'); return; }
    const day = (activeProgram.days || []).find((d) => d.id === programDayId);
    const sort = (day?.exercises?.length || 0);
    await supabase.from('program_exercises').insert({ program_day_id: programDayId, name: newEx.name, target: newEx.target, sort });
    setNewEx({ name: '', target: '' });
    reload();
  }

  async function removeExercise(id) {
    await supabase.from('program_exercises').delete().eq('id', id);
    reload();
  }

  return (
    <>
      <Card>
        <Eyebrow>Your training plans</Eyebrow>
        <H2>Programs</H2>
        <Sub>Build the plan your coach gave you — any split, 4 to 12 weeks — or start from the cricket S&C template.</Sub>
        {programs.length === 0 && <Empty>No programs yet.</Empty>}
        {programs.map((p) => (
          <div key={p.id} className="flex justify-between items-center py-2 border-b border-ink/10 last:border-0">
            <div>
              <div className="font-semibold text-sm">{p.name} {activeProgram?.id === p.id && <span className="text-seam font-mono text-[10px]">· ACTIVE</span>}</div>
              <div className="font-mono text-xs text-inkMuted">{p.weeks} weeks</div>
            </div>
            <div className="flex gap-2">
              {activeProgram?.id !== p.id && <button className="font-mono text-xs underline" onClick={() => activate(p.id)}>activate</button>}
              <button className="font-mono text-xs text-alert underline" onClick={() => deleteProgram(p.id)}>delete</button>
            </div>
          </div>
        ))}
        <label className={labelCls}>New program name</label>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pre-season block" />
        <label className={labelCls}>Length (weeks)</label>
        <input type="number" inputMode="numeric" className={inputCls} value={weeks} onChange={(e) => setWeeks(e.target.value)} />
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <button className={btnCls} onClick={() => createProgram(false)}>Create blank</button>
          <button className={btnGold} onClick={() => createProgram(true)}>Start from template</button>
        </div>
      </Card>

      {activeProgram && (
        <Card>
          <Eyebrow>Editing: {activeProgram.name}</Eyebrow>
          <H2>Week layout</H2>
          <Sub>Tap a day to set what it is and list its exercises.</Sub>
          {DOW.map((label, dow) => {
            const day = (activeProgram.days || []).find((d) => d.day_of_week === dow);
            const isEditing = editingDay === dow;
            return (
              <div key={dow} className="py-2 border-b border-ink/10 last:border-0">
                <div className="flex justify-between items-center"
                  onClick={() => {
                    setEditingDay(isEditing ? null : dow);
                    setDayForm(day ? { title: day.title, subtitle: day.subtitle || '', day_type: day.day_type } : { title: '', subtitle: '', day_type: 'strength' });
                  }}>
                  <div>
                    <span className="font-mono text-[10px] uppercase text-inkMuted mr-2">{label.slice(0, 3)}</span>
                    <span className="font-semibold text-sm">{day ? day.title : '—'}</span>
                  </div>
                  <span className="font-mono text-xs underline">{isEditing ? 'close' : 'edit'}</span>
                </div>

                {isEditing && (
                  <div className="mt-2 bg-paperDim/60 rounded-lg p-3">
                    <label className={labelCls}>Title</label>
                    <input className={inputCls} value={dayForm.title} onChange={(e) => setDayForm({ ...dayForm, title: e.target.value })} placeholder="e.g. Heavy lower body" />
                    <label className={labelCls}>Subtitle</label>
                    <input className={inputCls} value={dayForm.subtitle} onChange={(e) => setDayForm({ ...dayForm, subtitle: e.target.value })} placeholder="Focus / notes" />
                    <label className={labelCls}>Type</label>
                    <select className={inputCls} value={dayForm.day_type} onChange={(e) => setDayForm({ ...dayForm, day_type: e.target.value })}>
                      {DAY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button className={`${btnCls} w-full mt-2`} onClick={() => saveDay(dow)}>Save day</button>

                    {day && (
                      <div className="mt-3">
                        <div className={labelCls}>Exercises</div>
                        {(day.exercises || []).map((ex) => (
                          <div key={ex.id} className="flex justify-between text-sm py-1 border-b border-ink/10">
                            <span>{ex.name} <span className="font-mono text-xs text-inkMuted">{ex.target}</span></span>
                            <span className="font-mono text-xs text-alert" onClick={() => removeExercise(ex.id)}>remove</span>
                          </div>
                        ))}
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <input className={inputCls} placeholder="Exercise" value={newEx.name} onChange={(e) => setNewEx({ ...newEx, name: e.target.value })} />
                          <input className={inputCls} placeholder="e.g. 4 x 8" value={newEx.target} onChange={(e) => setNewEx({ ...newEx, target: e.target.value })} />
                        </div>
                        <button className={`${btnSecondary} w-full mt-2`} onClick={() => addExercise(day.id)}>Add exercise</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
