'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Card, Eyebrow, Empty, H2, Sub, inputCls, labelCls, btnCls, btnSecondary, btnGold } from './ui';
import { computeMacros } from '../../lib/program';
import { BarChart, Bar as RBar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Nutrition({ dayLog, food, profile, setProfile, userId, updateDayLog, reload, showToast }) {
  const macros = computeMacros(profile);
  const totals = food.reduce((a, f) => ({
    calories: a.calories + (f.calories || 0), protein: a.protein + (f.protein_g || 0),
    carbs: a.carbs + (f.carbs_g || 0), fat: a.fat + (f.fat_g || 0)
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const [item, setItem] = useState({ name: '', cal: '', pro: '', carb: '', fat: '' });
  const [weightInput, setWeightInput] = useState(dayLog.morning_weight_kg ?? '');
  const [profileForm, setProfileForm] = useState(profile);

  function ProgressBar({ label, val, target, unit }) {
    const pct = target ? Math.min(100, (val / target) * 100) : 0;
    return (
      <div className="mt-2.5">
        <label className={labelCls}>{label} — {Math.round(val)}{unit} / {Math.round(target)}{unit}</label>
        <div className="h-2 bg-ink/10 rounded-full overflow-hidden">
          <div className="h-full bg-seam rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  async function addFood() {
    if (!item.name.trim()) { showToast('Add a food name'); return; }
    await supabase.from('food_entries').insert({
      day_log_id: dayLog.id, item: item.name, calories: Number(item.cal) || null,
      protein_g: Number(item.pro) || null, carbs_g: Number(item.carb) || null, fat_g: Number(item.fat) || null, source: 'manual'
    });
    setItem({ name: '', cal: '', pro: '', carb: '', fat: '' });
    showToast('Added ✓');
    reload();
  }
  async function removeFood(id) { await supabase.from('food_entries').delete().eq('id', id); reload(); }
  async function saveWeight() { await updateDayLog({ morning_weight_kg: Number(weightInput) || null }); showToast('Weight saved ✓'); }
  async function saveProfile() {
    const { active_program_id, onboarded, id, created_at, ...clean } = profileForm;
    await supabase.from('profiles').update(clean).eq('id', userId);
    setProfile(profileForm);
    showToast('Targets updated ✓');
  }

  return (
    <>
      <Card>
        <Eyebrow>Daily targets</Eyebrow>
        <H2>{macros.target} kcal / day</H2>
        <Sub>TDEE {macros.tdee} kcal {profile.surplus >= 0 ? '+' : ''}{profile.surplus} adjustment.</Sub>

        <ResponsiveContainer width="100%" height={140}>
          <BarChart
            data={[
              { name: 'Protein', actual: Math.round(totals.protein), target: macros.protein },
              { name: 'Carbs', actual: Math.round(totals.carbs), target: macros.carbs },
              { name: 'Fat', actual: Math.round(totals.fat), target: macros.fat }
            ]}
            margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: '#7C897B' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#7C897B' }} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={{ background: '#171D15', border: '1px solid #F1F4EF1A', color: '#F1F4EF', borderRadius: 8, fontFamily: 'Inter', fontSize: 12 }} />
            <RBar dataKey="target" fill="#F1F4EF15" radius={[4, 4, 0, 0]} />
            <RBar dataKey="actual" fill="#22C55E" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="font-mono text-[9px] text-inkMuted text-center -mt-2 mb-1">solid = today so far · faint = target</div>

        <ProgressBar label="Calories" val={totals.calories} target={macros.target} unit="" />
        <ProgressBar label="Protein" val={totals.protein} target={macros.protein} unit="g" />
        <ProgressBar label="Carbs" val={totals.carbs} target={macros.carbs} unit="g" />
        <ProgressBar label="Fat" val={totals.fat} target={macros.fat} unit="g" />
      </Card>

      <Card>
        <Eyebrow>Add food</Eyebrow>
        <div className="grid grid-cols-2 gap-2.5">
          <div><label className={labelCls}>Item</label><input className={inputCls} value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} placeholder="Chicken & rice" /></div>
          <div><label className={labelCls}>Calories</label><input type="number" inputMode="numeric" className={inputCls} value={item.cal} onChange={(e) => setItem({ ...item, cal: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <div><label className={labelCls}>Protein g</label><input type="number" inputMode="numeric" className={inputCls} value={item.pro} onChange={(e) => setItem({ ...item, pro: e.target.value })} /></div>
          <div><label className={labelCls}>Carbs g</label><input type="number" inputMode="numeric" className={inputCls} value={item.carb} onChange={(e) => setItem({ ...item, carb: e.target.value })} /></div>
          <div><label className={labelCls}>Fat g</label><input type="number" inputMode="numeric" className={inputCls} value={item.fat} onChange={(e) => setItem({ ...item, fat: e.target.value })} /></div>
        </div>
        <button className={`${btnCls} w-full mt-3`} onClick={addFood}>Add entry</button>
      </Card>

      <Card>
        <Eyebrow>Today&apos;s food log</Eyebrow>
        {food.length === 0 ? <Empty>Nothing logged yet.</Empty> : food.map((f) => (
          <div key={f.id} className="py-2 border-b border-ink/10 last:border-0 text-sm font-serif">
            <div className="flex justify-between"><span>{f.item}</span><span className="font-mono text-xs text-alert" onClick={() => removeFood(f.id)}>remove</span></div>
            <div className="font-mono text-xs text-inkMuted">{f.calories ?? '?'} kcal · P{f.protein_g ?? '–'} C{f.carbs_g ?? '–'} F{f.fat_g ?? '–'}</div>
          </div>
        ))}
      </Card>

      <Card>
        <Eyebrow>Morning weight</Eyebrow>
        <div className="grid grid-cols-2 gap-2.5">
          <input type="number" inputMode="decimal" className={inputCls} value={weightInput} onChange={(e) => setWeightInput(e.target.value)} placeholder="kg" />
          <button className={btnSecondary} onClick={saveWeight}>Save</button>
        </div>
      </Card>

      <Card>
        <Eyebrow>Profile — recalculate targets</Eyebrow>
        <div className="grid grid-cols-2 gap-2.5">
          <div><label className={labelCls}>Weight kg</label><input type="number" inputMode="decimal" className={inputCls} value={profileForm.weight_kg} onChange={(e) => setProfileForm({ ...profileForm, weight_kg: Number(e.target.value) })} /></div>
          <div><label className={labelCls}>Height cm</label><input type="number" inputMode="numeric" className={inputCls} value={profileForm.height_cm} onChange={(e) => setProfileForm({ ...profileForm, height_cm: Number(e.target.value) })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div><label className={labelCls}>Age</label><input type="number" inputMode="numeric" className={inputCls} value={profileForm.age} onChange={(e) => setProfileForm({ ...profileForm, age: Number(e.target.value) })} /></div>
          <div><label className={labelCls}>Activity ×</label><input type="number" step="0.05" inputMode="decimal" className={inputCls} value={profileForm.activity} onChange={(e) => setProfileForm({ ...profileForm, activity: Number(e.target.value) })} /></div>
        </div>
        <label className={labelCls}>Calorie adjustment (+300 bulk, 0 maintain, -300 cut)</label>
        <input type="number" inputMode="numeric" className={inputCls} value={profileForm.surplus} onChange={(e) => setProfileForm({ ...profileForm, surplus: Number(e.target.value) })} />
        <button className={`${btnGold} w-full mt-3`} onClick={saveProfile}>Update targets</button>
      </Card>
    </>
  );
}
