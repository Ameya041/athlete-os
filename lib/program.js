export const PREHAB = [
  "TheraBand pull-aparts — 3 x 15",
  "TheraBand external rotations — 2 x 15 / arm",
  "Foam roll quads & hamstrings — 2 min",
  "Spiderman lunge + thoracic rotation — 5 / side",
  "Bird-dogs — 10 / side"
];

export const CORE_CIRCUIT = [
  "Weighted planks (15kg plate) — 3 x 60 sec",
  "Weighted Russian twists (12.5kg) — 2 x 15 / side",
  "Weighted crunches (12.5kg) — 2 x 15",
  "Leg lifts — 2 x 15",
  "V-sit-ups — 2 x 35"
];

export const PROGRAM = {
  monday: {
    title: "Heavy Strength",
    subtitle: "Lower push & chest — hypertrophy",
    type: "strength",
    core: true,
    exercises: [
      { name: "Barbell back squats", target: "4 x 8-10" },
      { name: "Barbell bench press", target: "4 x 8-10" },
      { name: "Bulgarian split squats", target: "4 x 10 / leg" },
      { name: "Dumbbell flyes", target: "3 x 12" },
      { name: "Calf raises (holding DBs)", target: "4 x 15" }
    ]
  },
  tuesday: {
    title: "Conditioning",
    subtitle: "Fat-burning & anaerobic capacity",
    type: "conditioning",
    core: false,
    blocks: [
      "Warm-up — 5 min light jog",
      "RSA: 20m max sprints, walk back to recover — Block 1: 8 sprints",
      "Rest 3 min",
      "RSA — Block 2: 8 sprints",
      "Crease shuttles (22yd, 3 lengths = 'a three'), 30s rest — 10 sets"
    ]
  },
  wednesday: {
    title: "Explosive Power",
    subtitle: "Off-spin & batting focus",
    type: "power",
    core: true,
    exercises: [
      { name: "Barbell jump squats (light)", target: "4 x 5" },
      { name: "Broad jumps", target: "4 x 4" },
      { name: "Rotational band punches (fast)", target: "4 x 12 / side" },
      { name: "Dumbbell snatch (single arm)", target: "3 x 6 / arm" }
    ]
  },
  thursday: {
    title: "Conditioning",
    subtitle: "Aerobic / intermittent",
    type: "conditioning",
    core: false,
    blocks: [
      "HIIT circuit: burpees → mountain climbers → high knees → jumping lunges, 45s work / 15s rest — 5 rounds",
      "Shadow bowling / batting footwork drills — 15 min high intensity"
    ]
  },
  friday: {
    title: "Heavy Strength",
    subtitle: "Upper pull & hamstrings — hypertrophy",
    type: "strength",
    core: true,
    exercises: [
      { name: "Barbell deadlift (or RDLs)", target: "4 x 8" },
      { name: "Barbell bent-over rows", target: "4 x 8-10" },
      { name: "Dumbbell overhead press", target: "4 x 8-10" },
      { name: "Bicep curls / tricep ext (superset)", target: "3 x 12 each" },
      { name: "Heavy farmer's walks", target: "4 x 40m" }
    ]
  },
  saturday: {
    title: "Active Recovery",
    subtitle: "Mobility & CNS flush",
    type: "recovery",
    core: false,
    blocks: [
      "Long run — 25-30 min steady Zone 2 jog",
      "Mobility — 15 min: couch stretch + 90/90 stretch"
    ]
  },
  sunday: {
    title: "Rest or Match Day",
    subtitle: "Full recovery, or execute on the field",
    type: "rest",
    core: false,
    blocks: []
  }
};

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function dayName(iso) {
  const names = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  return names[new Date(iso + 'T00:00:00').getDay()];
}

export function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
}

export function computeMacros(p) {
  const bmr = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age + 5;
  const tdee = bmr * p.activity;
  const target = tdee + p.surplus;
  const protein = 2.2 * p.weight_kg;
  const fat = 1.0 * p.weight_kg;
  const carbs = Math.max(0, (target - protein * 4 - fat * 9) / 4);
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target: Math.round(target),
    protein: Math.round(protein),
    fat: Math.round(fat),
    carbs: Math.round(carbs)
  };
}

export const DEFAULT_PROFILE = { weight_kg: 72, height_cm: 180, age: 22, activity: 1.8, surplus: 300, player_role: 'all_rounder' };

/* ---------------- Player roles (generalizes the app beyond one person) ---------------- */
export const PLAYER_ROLES = [
  { value: 'batsman_top', label: 'Batsman — top order' },
  { value: 'batsman_middle', label: 'Batsman — middle order' },
  { value: 'fast_bowler', label: 'Fast bowler' },
  { value: 'spinner_off', label: 'Spinner — off-spin' },
  { value: 'spinner_leg', label: 'Spinner — leg-spin' },
  { value: 'spinner_left_arm', label: 'Spinner — left-arm orthodox' },
  { value: 'wicket_keeper', label: 'Wicketkeeper' },
  { value: 'all_rounder', label: 'All-rounder' }
];

// Buckets the many specific roles down into which metric set applies
function roleBucket(role) {
  if (role === 'wicket_keeper') return 'keeper';
  if (role === 'fast_bowler' || role?.startsWith('spinner')) return 'bowler';
  if (role === 'all_rounder') return 'all_rounder';
  return 'batsman';
}

// Field definitions rendered dynamically in the Cricket tab, based on player_role.
// Each field's value is stored in cricket_entries.role_metrics (jsonb) under its key.
export function roleMetricFields(role) {
  const bucket = roleBucket(role);
  const batting = [
    { key: 'middlingPct', label: 'Middling %', type: 'number', max: 100 },
    { key: 'shotExecutionPct', label: 'Shot execution %', type: 'number', max: 100 }
  ];
  const bowling = [
    { key: 'oversBowled', label: 'Overs bowled', type: 'number' },
    { key: 'effortBalls', label: 'Effort balls', type: 'number' },
    { key: 'lineLengthControlPct', label: 'Line/length control %', type: 'number', max: 100 },
    { key: 'stiffnessRating', label: 'Shoulder/back stiffness (1-10)', type: 'number', max: 10 }
  ];
  const keeping = [
    { key: 'catches', label: 'Catches', type: 'number' },
    { key: 'stumpings', label: 'Stumpings', type: 'number' },
    { key: 'byesConceded', label: 'Byes conceded', type: 'number' },
    { key: 'footworkRating', label: 'Footwork rating (1-10)', type: 'number', max: 10 }
  ];
  if (bucket === 'batsman') return batting;
  if (bucket === 'bowler') return bowling;
  if (bucket === 'keeper') return keeping;
  return [...batting, ...bowling]; // all_rounder sees both
}

/* ---------------- Mindset gatekeeper ----------------
   Checks a cricket entry (plus optional free-text notes) for signs that the player
   is fatigued, frustrated, or performing poorly — and should be offered a reset
   before the technical log is reviewed/saved, rather than straight into self-critique. */
const NEGATIVE_WORDS = ['frustrated', 'annoyed', 'angry', 'terrible', 'hate', 'furious', 'hopeless', 'awful', 'crap', 'useless'];

export function checkMindsetGate({ fatigue, roleMetrics = {}, notes = '' }) {
  const reasons = [];
  if (fatigue && fatigue > 7) reasons.push('fatigue is high');
  if (roleMetrics.shotExecutionPct !== undefined && roleMetrics.shotExecutionPct !== null && roleMetrics.shotExecutionPct < 40) {
    reasons.push('shot execution was low');
  }
  if (roleMetrics.lineLengthControlPct !== undefined && roleMetrics.lineLengthControlPct !== null && roleMetrics.lineLengthControlPct < 40) {
    reasons.push('line/length control was low');
  }
  const lowerNotes = (notes || '').toLowerCase();
  if (NEGATIVE_WORDS.some((w) => lowerNotes.includes(w))) reasons.push('your notes sound frustrated');

  if (reasons.length === 0) return { flagged: false };
  return {
    flagged: true,
    reason: `Your ${reasons.join(' and ')}, which points to a stressed nervous system. Reviewing technical detail right now tends to be counterproductive — a short reset first usually helps more.`
  };
}

/* ---------------- Default workout template content (seeded once per new user, then editable) ---------------- */
export const DEFAULT_TEMPLATE_ITEMS = {
  0: { title: 'Rest or Match Day', subtitle: 'Full recovery, or execute on the field', session_type: 'rest', core_circuit: false, items: [] },
  1: { title: 'Heavy Strength', subtitle: 'Lower push & chest — hypertrophy', session_type: 'strength', core_circuit: true, items: [
    { item_type: 'exercise', name: 'Barbell back squats', target: '4 x 8-10' },
    { item_type: 'exercise', name: 'Barbell bench press', target: '4 x 8-10' },
    { item_type: 'exercise', name: 'Bulgarian split squats', target: '4 x 10 / leg' },
    { item_type: 'exercise', name: 'Dumbbell flyes', target: '3 x 12' },
    { item_type: 'exercise', name: 'Calf raises (holding DBs)', target: '4 x 15' }
  ]},
  2: { title: 'Conditioning', subtitle: 'Fat-burning & anaerobic capacity', session_type: 'conditioning', core_circuit: false, items: [
    { item_type: 'block', name: 'Warm-up — 5 min light jog' },
    { item_type: 'block', name: "RSA: 20m max sprints, walk back to recover — Block 1: 8 sprints" },
    { item_type: 'block', name: 'Rest 3 min' },
    { item_type: 'block', name: 'RSA — Block 2: 8 sprints' },
    { item_type: 'block', name: "Crease shuttles (22yd, 3 lengths = 'a three'), 30s rest — 10 sets" }
  ]},
  3: { title: 'Explosive Power', subtitle: 'Batting & bowling-action power', session_type: 'power', core_circuit: true, items: [
    { item_type: 'exercise', name: 'Barbell jump squats (light)', target: '4 x 5' },
    { item_type: 'exercise', name: 'Broad jumps', target: '4 x 4' },
    { item_type: 'exercise', name: 'Rotational band punches (fast)', target: '4 x 12 / side' },
    { item_type: 'exercise', name: 'Dumbbell snatch (single arm)', target: '3 x 6 / arm' }
  ]},
  4: { title: 'Conditioning', subtitle: 'Aerobic / intermittent', session_type: 'conditioning', core_circuit: false, items: [
    { item_type: 'block', name: 'HIIT circuit: burpees → mountain climbers → high knees → jumping lunges, 45s work / 15s rest — 5 rounds' },
    { item_type: 'block', name: 'Shadow bowling / batting footwork drills — 15 min high intensity' }
  ]},
  5: { title: 'Heavy Strength', subtitle: 'Upper pull & hamstrings — hypertrophy', session_type: 'strength', core_circuit: true, items: [
    { item_type: 'exercise', name: 'Barbell deadlift (or RDLs)', target: '4 x 8' },
    { item_type: 'exercise', name: 'Barbell bent-over rows', target: '4 x 8-10' },
    { item_type: 'exercise', name: 'Dumbbell overhead press', target: '4 x 8-10' },
    { item_type: 'exercise', name: 'Bicep curls / tricep ext (superset)', target: '3 x 12 each' },
    { item_type: 'exercise', name: "Heavy farmer's walks", target: '4 x 40m' }
  ]},
  6: { title: 'Active Recovery', subtitle: 'Mobility & CNS flush', session_type: 'recovery', core_circuit: false, items: [
    { item_type: 'block', name: 'Long run — 25-30 min steady Zone 2 jog' },
    { item_type: 'block', name: 'Mobility — 15 min: couch stretch + 90/90 stretch' }
  ]}
};

/* ===== v2 additions ===== */

export const DAY_TYPES = ['strength', 'power', 'conditioning', 'recovery', 'rest'];

export const BODY_AREAS = [
  'Lower back', 'Upper back / shoulder blades', 'Shoulder', 'Rotator cuff', 'Neck',
  'Elbow', 'Wrist / hand', 'Finger', 'Hip', 'Groin', 'Hamstring', 'Quad',
  'Knee', 'Calf', 'Shin', 'Ankle', 'Foot', 'Side / obliques', 'Other'
];

export const WORSE_AFTER = ['bowling', 'batting', 'lifting', 'fielding', 'rest', 'other'];

export const MEDITATIONS = [
  { id: 'breath', name: 'Breathing reset', desc: '4s in, 4s hold, 6s out. Settle the nervous system.', durations: [3, 7, 15] },
  { id: 'bodyscan', name: 'Body scan', desc: 'Move attention slowly from feet to head, releasing tension at each point.', durations: [7, 15, 20] },
  { id: 'matchprep', name: 'Match visualization', desc: 'Rehearse your routines: walking in, first ball, bowling your first over, staying calm between deliveries.', durations: [7, 15] },
  { id: 'stillness', name: 'Open stillness', desc: 'Sit, eyes closed, no technique. When the mind wanders, return to the breath.', durations: [7, 15, 20, 30] }
];

// The original hardcoded plan, converted into seed data for a user's first custom program.
export function defaultProgramSeed() {
  const map = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  return Object.entries(PROGRAM).map(([day, p]) => ({
    day_of_week: map[day],
    title: p.title,
    subtitle: p.subtitle || '',
    day_type: p.type,
    exercises: (p.exercises || (p.blocks || []).map((b) => ({ name: b, target: '' }))).map((ex, i) => ({
      name: ex.name || ex, target: ex.target || '', sort: i
    }))
  }));
}

export function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
