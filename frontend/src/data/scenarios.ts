import type { ScenarioResponse } from '../types/scenario';

// Synthetic responses keyed by: monitor, BP record, Earth link, override.
// Not medical advice.
const authored = {
  blocked: {
    status: 'needs_review',
    next_check: {
      id: 'repeat_symptom_and_hr_recheck_15m',
      label: 'Recheck symptoms and HR in 15 min',
      title: 'Recheck symptoms and HR in 15 min',
      requires_equipment: ['pulse_ox_or_hr_sensor'],
      equipment: ['Crew check-in tablet'],
      prototype_only: true,
    },
    explanation: {
      selected:
        'BP unknown. BP monitor unavailable. HR recheck selected.',
      excluded:
        'BP check excluded: monitor unavailable.',
    },
  },
  insufficient: {
    status: 'insufficient_evidence',
    next_check: null,
    explanation: {
      selected:
        'Insufficient evidence. BP and monitor unavailable.',
      excluded:
        'No next check. Missing data flagged for officer review.',
    },
  },
  measure: {
    status: 'needs_review',
    next_check: {
      id: 'record_bp_observation',
      label: 'Record blood pressure',
      title: 'Record blood pressure',
      requires_equipment: ['bp_monitor'],
      equipment: ['Blood-pressure monitor'],
      prototype_only: true,
    },
    explanation: {
      selected:
        'BP missing. Monitor available. Record BP.',
      excluded:
        'Record review excluded: BP missing.',
    },
  },
  review: {
    status: 'needs_review',
    next_check: {
      id: 'review_observation_record',
      label: 'Officer review of observations',
      title: 'Officer review of observations',
      requires_equipment: ['crew_tablet'],
      equipment: ['Crew check-in tablet'],
      prototype_only: true,
    },
    explanation: {
      selected:
        'BP recorded. Send to officer review.',
      excluded:
        'Missing-data check excluded: BP present.',
    },
  },
  escalation: {
    status: 'escalate',
    next_check: null,
    explanation: {
      selected:
        'Emergency override active. Follow emergency protocol. Contact medical officer.',
      excluded:
        'Routine checks bypassed. No treatment generated.',
    },
  },
} as const;

const keys: Record<string, keyof typeof authored> = {
  '0000': 'blocked',
  '0010': 'insufficient',
  '0100': 'review',
  '0110': 'review',
  '1000': 'measure',
  '1010': 'measure',
  '1100': 'review',
  '1110': 'review',
  '0001': 'escalation',
  '0011': 'escalation',
  '0101': 'escalation',
  '0111': 'escalation',
  '1001': 'escalation',
  '1011': 'escalation',
  '1101': 'escalation',
  '1111': 'escalation',
};

export const scenarioFixtures: Record<string, ScenarioResponse> =
  Object.fromEntries(
    Object.entries(keys).map(([key, name]) => [
      key,
      {
        id: `MN-${key}`,
        ...authored[name],
        observations: { bp: key[1] === '1' ? '120 / 80' : null },
        missing_data:
          key[1] === '1'
            ? []
            : ['systolic_bp_mm_hg', 'diastolic_bp_mm_hg'],
        resource_constraints:
          key[0] === '1' ? [] : ['bp_monitor unavailable'],
        safety_flags:
          name === 'escalation'
            ? ['Manual emergency override']
            : ['No automated clinical assessment'],
        requires_medical_officer_review: true,
        evidence_sources: [
          { id: 'MEDNAV-UI-FIXTURES', kind: 'scripted-demo', version: '1.0' },
        ],
        diagnosis: null,
      },
    ])
  );

export function getScenario(flags: boolean[]) {
  return scenarioFixtures[flags.map(Number).join('')] ?? null;
}
