export type Crew = {
  id: string;
  role: string;
  hr: number | null;
  sleep: number | null;
  bp: string | null;
  baseline: number;
  sleepBaseline: number;
  symptoms: string[];
  /* Space Radiation & Microgravity Measurements (Synthetic Demo Data) */
  radiationDailyMsv: number | null;
  radiationCumulativeMsv: number | null;
  radiationBaselineMsv: number;
  countermeasureMin: number | null;
  countermeasureTargetMin: number;
  ocularCheck: string | null;
  bodyMassKg: number | null;
  baselineMassKg: number;
};

export type Equipment = {
  name: string;
  category: string;
  quantity: number;
  available: boolean;
};

export const crews: Crew[] = [
  {
    id: 'Crew A',
    role: 'Mission specialist',
    hr: 88,
    sleep: 4.2,
    bp: null,
    baseline: 70,
    sleepBaseline: 7.3,
    symptoms: ['Headache', 'Dizziness', 'Fatigue'],
    radiationDailyMsv: 0.68,
    radiationCumulativeMsv: 106.4,
    radiationBaselineMsv: 0.55,
    countermeasureMin: 75,
    countermeasureTargetMin: 120,
    ocularCheck: null,
    bodyMassKg: 73.8,
    baselineMassKg: 75.2,
  },
  {
    id: 'Crew B',
    role: 'Flight engineer',
    hr: 72,
    sleep: 7.1,
    bp: '118 / 76',
    baseline: 68,
    sleepBaseline: 7.5,
    symptoms: [],
    radiationDailyMsv: 0.54,
    radiationCumulativeMsv: 98.2,
    radiationBaselineMsv: 0.55,
    countermeasureMin: 120,
    countermeasureTargetMin: 120,
    ocularCheck: 'Optic sheath 5.1 mm (Recorded)',
    bodyMassKg: 68.4,
    baselineMassKg: 68.8,
  },
  {
    id: 'Crew C',
    role: 'Research specialist',
    hr: null,
    sleep: 6.4,
    bp: null,
    baseline: 74,
    sleepBaseline: 7.2,
    symptoms: ['Fatigue'],
    radiationDailyMsv: null,
    radiationCumulativeMsv: 101.5,
    radiationBaselineMsv: 0.55,
    countermeasureMin: 90,
    countermeasureTargetMin: 120,
    ocularCheck: null,
    bodyMassKg: null,
    baselineMassKg: 64.0,
  },
];

export const equipment: Equipment[] = [
  { name: 'Blood-pressure monitor', category: 'Monitoring', quantity: 1, available: false },
  { name: 'Personal radiation dosimeter', category: 'Monitoring', quantity: 4, available: true },
  { name: 'Wrist heart-rate sensor', category: 'Monitoring', quantity: 3, available: true },
  { name: 'Digital thermometer', category: 'Monitoring', quantity: 2, available: true },
  { name: 'Crew check-in tablet', category: 'Documentation', quantity: 2, available: true },
  { name: 'Ultrasound unit', category: 'Imaging', quantity: 1, available: false },
  { name: 'ARED resistance telemetry', category: 'Monitoring', quantity: 1, available: true },
  { name: 'Medical supply kit', category: 'Supplies', quantity: 2, available: true },
];

export const history = [174, 175, 176, 177, 178, 179, 180].map((day, i) => ({
  day: `D${day}`,
  a: [72, 76, 74, 80, 78, 84, 88][i],
  b: [69, 71, 70, 73, 70, 71, 72][i],
  c: [74, 76, 73, 75, 77, 76, null][i],
  sa: [7.2, 6.8, 7, 5.9, 6.1, 5.2, 4.2][i],
  sb: [7.4, 7.2, 7.5, 7, 7.3, 7.2, 7.1][i],
  sc: [7.1, 7, 6.8, 7.2, 6.9, 6.7, 6.4][i],
  ra: [0.54, 0.56, 0.55, 0.61, 0.63, 0.66, 0.68][i],
  rb: [0.53, 0.55, 0.54, 0.56, 0.55, 0.54, 0.54][i],
  rc: [0.55, 0.54, 0.56, 0.57, 0.56, 0.55, null][i],
  ca: [120, 115, 110, 95, 90, 80, 75][i],
  cb: [120, 120, 115, 120, 120, 118, 120][i],
  cc: [115, 110, 105, 100, 95, 95, 90][i],
}));

export const results = {
  missing: {
    title: 'Review measurement availability',
    explanation:
      'This authored example pauses at the missing blood-pressure record. Confirm available resources with the medical officer.',
    equipment: 'Crew check-in tablet',
    excluded:
      'Instrument-based blood-pressure check is omitted in this fixture because the monitor is unavailable.',
  },
  measure: {
    title: 'Preview a blood-pressure recording workflow',
    explanation:
      'This authored example shows the documentation workflow when a monitor is available and a record is missing. Medical-officer review is required.',
    equipment: 'Blood-pressure monitor',
    excluded: 'Ground consultation is not represented as an onboard measurement.',
  },
  review: {
    title: 'Review the completed observation record',
    explanation:
      'This authored example includes a blood-pressure record for review alongside symptoms and personal history.',
    equipment: 'Crew check-in tablet',
    excluded:
      'Repeating the missing-record workflow is omitted because this fixture includes a record.',
  },
  emergency: {
    title: 'Simulated escalation — officer review required',
    explanation:
      'The manually selected emergency fixture suppresses next-check suggestions. No emergency is inferred from measurements.',
    equipment: 'No ranked next check',
    excluded:
      'All next-check previews are suppressed by the explicit demonstration override.',
  },
};

export type Result = typeof results.missing;

export const symptomOptions = [
  'Headache',
  'Dizziness',
  'Fatigue',
  'Nausea',
  'Muscle discomfort',
  'Cephalad fluid fullness',
  'Visual acuity change',
];
