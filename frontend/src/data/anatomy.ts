import type { Crew } from './fixtures';

export type AnatomyLayerMode = 'xray' | 'organs' | 'skeleton' | 'surface';
export type AnatomySex = 'male' | 'female';
export type AnatomyModelStatus = 'loading' | 'detailed' | 'fallback';

export const MODES: readonly { id: AnatomyLayerMode; name: string }[] = [
  { id: 'xray', name: 'X-RAY' },
  { id: 'organs', name: 'ORGANS' },
  { id: 'skeleton', name: 'BONES' },
  { id: 'surface', name: 'SKIN' },
];

export const FREQUENT_PARTS = [
  'brain',
  'eye_l',
  'heart',
  'lung_l',
  'spine',
  'femur_l',
  'liver',
  'kidney_l',
] as const;

type PartDefinition = {
  label: string;
  system: string;
  description: string;
  metric: string;
  value: string | ((crew: Crew, currentBp: string | null) => string);
  note?: string | ((crew: Crew) => string);
};

export interface ResolvedPartInfo {
  label: string;
  system: string;
  description: string;
  metric: string;
  value: string;
  note?: string;
}

const neuroValue = (c: Crew) =>
  c.sleep !== null ? `${c.sleep} hrs (Baseline ${c.sleepBaseline}h)` : 'Unknown';

const neuroNote = (c: Crew) =>
  `Reported symptoms: ${c.symptoms.join(', ') || 'None reported'}`;

const cardioValue = (c: Crew, currentBp: string | null) =>
  `HR: ${c.hr !== null ? `${c.hr} bpm` : 'Unknown'} · BP: ${currentBp ?? 'Unknown'}`;

const skeletalDef = (label: string, description: string): PartDefinition => ({
  label,
  system: 'Skeletal (Microgravity Unloading)',
  description: `${description} Weight-bearing skeletal structure tracked for microgravity bone mineral unloading and ARED resistive exercise countermeasures.`,
  metric: 'μG Countermeasure (ARED)',
  value: (c) =>
    c.countermeasureMin !== null
      ? `${c.countermeasureMin} / ${c.countermeasureTargetMin} min`
      : 'Unknown',
  note: 'Target daily resistive protocol: 120 min (synthetic demo baseline).',
});

const muscularDef = (label: string, description: string): PartDefinition => ({
  label,
  system: 'Musculoskeletal (Microgravity)',
  description,
  metric: 'Body Mass (SLAMMD)',
  value: (c) =>
    c.bodyMassKg !== null
      ? `${c.bodyMassKg} kg (Baseline ${c.baselineMassKg} kg)`
      : 'Unknown',
  note: 'Synthetic countermeasure and body-mass tracking only.',
});

export const PARTS: Record<string, PartDefinition> = {
  brain: {
    label: 'Brain',
    system: 'Neurological & Vestibular',
    description:
      'Coordinates cognition, movement, sensory processing, and autonomic adaptation to microgravity.',
    metric: 'Sleep & Neuro Log',
    value: neuroValue,
    note: neuroNote,
  },
  brainstem: {
    label: 'Brainstem',
    system: 'Neurological & Vestibular',
    description:
      'Connects the brain to the spinal cord and supports core autonomic regulation.',
    metric: 'Sleep & Neuro Log',
    value: neuroValue,
    note: neuroNote,
  },
  cerebellum: {
    label: 'Cerebellum',
    system: 'Neurological & Vestibular',
    description:
      'Contributes to posture, balance, and neuro-vestibular coordination in altered gravity.',
    metric: 'Sleep & Neuro Log',
    value: neuroValue,
    note: neuroNote,
  },
  cranial_nerves: {
    label: 'Cranial Neural Pathways',
    system: 'Neurological & Vestibular',
    description:
      'Illustrative cranial neural tracts monitored alongside sleep disturbance and symptom logs.',
    metric: 'Sleep & Neuro Log',
    value: neuroValue,
    note: neuroNote,
  },
  spinal_cord: {
    label: 'Spinal Cord',
    system: 'Neurological & Vestibular',
    description:
      'Central neural pathway transmitting sensory and motor signals through the vertebral column.',
    metric: 'Sleep & Neuro Log',
    value: neuroValue,
    note: neuroNote,
  },
  eye_l: {
    label: 'Ocular Structure (SANS · L)',
    system: 'Microgravity Fluid Shift / Ocular',
    description:
      'Monitored for Spaceflight-Associated Neuro-ocular Syndrome (SANS) and cephalad fluid shifts in microgravity.',
    metric: 'Ocular / SANS Check',
    value: (c) => c.ocularCheck ?? 'Unknown (Unmeasured)',
    note: 'Never inferred from vital signs; requires verified imaging record.',
  },
  eye_r: {
    label: 'Ocular Structure (SANS · R)',
    system: 'Microgravity Fluid Shift / Ocular',
    description:
      'Monitored for Spaceflight-Associated Neuro-ocular Syndrome (SANS) and cephalad fluid shifts in microgravity.',
    metric: 'Ocular / SANS Check',
    value: (c) => c.ocularCheck ?? 'Unknown (Unmeasured)',
    note: 'Never inferred from vital signs; requires verified imaging record.',
  },
  eyes: {
    label: 'Ocular Structure (SANS)',
    system: 'Microgravity Fluid Shift / Ocular',
    description:
      'Monitored for Spaceflight-Associated Neuro-ocular Syndrome (SANS) and cephalad fluid shifts in microgravity.',
    metric: 'Ocular / SANS Check',
    value: (c) => c.ocularCheck ?? 'Unknown (Unmeasured)',
    note: 'Never inferred from vital signs; requires verified imaging record.',
  },
  heart: {
    label: 'Heart',
    system: 'Cardiovascular',
    description:
      'Pumps blood through systemic and pulmonary circulation; experiences vascular deconditioning in microgravity.',
    metric: 'Heart Rate & BP',
    value: cardioValue,
    note: (c) => `Resting HR baseline: ${c.baseline} bpm (synthetic sample).`,
  },
  aorta: {
    label: 'Aorta',
    system: 'Cardiovascular',
    description:
      'Primary arterial trunk distributing oxygenated blood; paired with blood-pressure and resting HR observations.',
    metric: 'Heart Rate & BP',
    value: cardioValue,
  },
  veins: {
    label: 'Systemic Veins',
    system: 'Cardiovascular',
    description:
      'Venous return pathways affected by headward fluid shifts in microgravity.',
    metric: 'Heart Rate & BP',
    value: cardioValue,
  },
  chest: {
    label: 'Thorax / Chest',
    system: 'Cardiovascular',
    description:
      'Protects the heart, lungs, and major mediastinal vessels.',
    metric: 'Heart Rate & BP',
    value: cardioValue,
  },
  lung_l: {
    label: 'Left Lung',
    system: 'Respiratory & Cardiopulmonary',
    description:
      'Performs pulmonary gas exchange and oxygen transport under closed-cabin environmental conditions.',
    metric: 'Resting HR vs Baseline',
    value: (c) =>
      c.hr !== null ? `${c.hr} bpm (Baseline ${c.baseline} bpm)` : 'Unknown',
  },
  lung_r: {
    label: 'Right Lung',
    system: 'Respiratory & Cardiopulmonary',
    description:
      'Performs pulmonary gas exchange and oxygen transport under closed-cabin environmental conditions.',
    metric: 'Resting HR vs Baseline',
    value: (c) =>
      c.hr !== null ? `${c.hr} bpm (Baseline ${c.baseline} bpm)` : 'Unknown',
  },
  lungs: {
    label: 'Lungs',
    system: 'Respiratory & Cardiopulmonary',
    description:
      'Perform pulmonary gas exchange and carbon dioxide clearance.',
    metric: 'Resting HR vs Baseline',
    value: (c) =>
      c.hr !== null ? `${c.hr} bpm (Baseline ${c.baseline} bpm)` : 'Unknown',
  },
  spine: skeletalDef('Spine', 'Provides axial structural support and protects the spinal cord.'),
  spine_cervical: skeletalDef('Cervical Spine', 'Supports the head and upper cervical segments.'),
  spine_thoracic: skeletalDef('Thoracic Spine', 'Supports the thorax and articulates with the rib cage.'),
  spine_lumbar: skeletalDef('Lumbar Spine', 'Supports lower trunk loading; commonly elongates in microgravity.'),
  rib_cage: skeletalDef('Rib Cage', 'Protects thoracic viscera and assists respiration mechanics.'),
  sternum: skeletalDef('Sternum', 'Anterior thoracic wall structure.'),
  pelvis: skeletalDef('Pelvis', 'Transmits axial load to the lower extremities.'),
  skull: skeletalDef('Skull / Cranium', 'Protects the brain and ocular orbits.'),
  femur_l: skeletalDef('Left Femur', 'Primary weight-bearing thigh bone sensitive to microgravity unloading.'),
  femur_r: skeletalDef('Right Femur', 'Primary weight-bearing thigh bone sensitive to microgravity unloading.'),
  tibia_l: skeletalDef('Left Tibia', 'Primary lower-leg weight-bearing bone.'),
  tibia_r: skeletalDef('Right Tibia', 'Primary lower-leg weight-bearing bone.'),
  humerus_l: skeletalDef('Left Humerus', 'Upper-arm long bone.'),
  humerus_r: skeletalDef('Right Humerus', 'Upper-arm long bone.'),
  radius_l: skeletalDef('Left Forearm (Radius)', 'Forearm skeletal structure.'),
  radius_r: skeletalDef('Right Forearm (Radius)', 'Forearm skeletal structure.'),
  chest_muscles_l: muscularDef(
    'Left Pectoral Musculature',
    'Upper-torso muscle group trained during onboard resistive countermeasure sessions.'
  ),
  chest_muscles_r: muscularDef(
    'Right Pectoral Musculature',
    'Upper-torso muscle group trained during onboard resistive countermeasure sessions.'
  ),
  quadriceps_l: muscularDef(
    'Left Quadriceps',
    'Anti-gravity thigh extensor muscle group susceptible to microgravity atrophy without ARED loading.'
  ),
  quadriceps_r: muscularDef(
    'Right Quadriceps',
    'Anti-gravity thigh extensor muscle group susceptible to microgravity atrophy without ARED loading.'
  ),
  arm_l: muscularDef('Left Upper Limb', 'Upper-limb musculature and connective tissue.'),
  arm_r: muscularDef('Right Upper Limb', 'Upper-limb musculature and connective tissue.'),
  leg_l: muscularDef('Left Lower Limb', 'Anti-gravity lower-limb musculature.'),
  leg_r: muscularDef('Right Lower Limb', 'Anti-gravity lower-limb musculature.'),
  skin: {
    label: 'Skin & External Boundary',
    system: 'Integumentary & Radiation Dosimetry',
    description:
      'External tissue boundary tracked for galactic cosmic ray (GCR) and solar particle event (SPE) personal dosimetry.',
    metric: 'Space Radiation Dose',
    value: (c) =>
      c.radiationDailyMsv !== null
        ? `${c.radiationDailyMsv} mSv/d (${c.radiationCumulativeMsv ?? 'Unknown'} mSv 180d)`
        : 'Unknown',
    note: (c) => `Transit baseline: ${c.radiationBaselineMsv} mSv/day (synthetic demo).`,
  },
  head: {
    label: 'Head & Cranial Region',
    system: 'Integumentary & Radiation Dosimetry',
    description:
      'Houses cranial sensory and neural structures; tracked alongside personal dosimetry and symptom reports.',
    metric: 'Space Radiation Dose',
    value: (c) =>
      c.radiationDailyMsv !== null
        ? `${c.radiationDailyMsv} mSv/d (${c.radiationCumulativeMsv ?? 'Unknown'} mSv 180d)`
        : 'Unknown',
    note: neuroNote,
  },
  liver: {
    label: 'Liver',
    system: 'Digestive & Metabolic',
    description:
      'Supports metabolism, nutrient processing, and bile production.',
    metric: 'Onboard Sensor Feed',
    value: 'Unknown (No sensor linked)',
  },
  stomach: {
    label: 'Stomach',
    system: 'Digestive',
    description:
      'Processes ingested nutrients along the upper gastrointestinal tract.',
    metric: 'Onboard Sensor Feed',
    value: 'Unknown (No sensor linked)',
  },
  intestine_small: {
    label: 'Small Intestine',
    system: 'Digestive',
    description:
      'Performs primary nutrient and fluid absorption.',
    metric: 'Onboard Sensor Feed',
    value: 'Unknown (No sensor linked)',
  },
  kidney_l: {
    label: 'Left Kidney',
    system: 'Renal',
    description:
      'Filters blood and regulates fluid and electrolyte balance in spaceflight.',
    metric: 'Onboard Sensor Feed',
    value: 'Unknown (No sensor linked)',
  },
  kidney_r: {
    label: 'Right Kidney',
    system: 'Renal',
    description:
      'Filters blood and regulates fluid and electrolyte balance in spaceflight.',
    metric: 'Onboard Sensor Feed',
    value: 'Unknown (No sensor linked)',
  },
};

export function formatPartKey(key: string): string {
  if (!key) return 'Human Body';
  if (PARTS[key]) return PARTS[key].label;
  return key
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\bL\b$/, '(L)')
    .replace(/\bR\b$/, '(R)');
}

export function partInfo(
  key: string,
  crew: Crew,
  currentBp: string | null = crew.bp
): ResolvedPartInfo {
  const def = PARTS[key] ?? {
    label: formatPartKey(key),
    system: 'Anatomical Structure',
    description:
      'Selectable 3D anatomical structure. Missing onboard measurements are kept explicitly Unknown and never inferred.',
    metric: 'Onboard Sensor Feed',
    value: 'Unknown (No sensor linked)',
  };

  return {
    label: def.label,
    system: def.system,
    description: def.description,
    metric: def.metric,
    value: typeof def.value === 'function' ? def.value(crew, currentBp) : def.value,
    note: typeof def.note === 'function' ? def.note(crew) : def.note,
  };
}
