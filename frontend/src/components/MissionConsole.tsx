import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ArrowLeft,
  SlidersHorizontal,
  RotateCcw,
  FileText,
  HeartPulse,
  Stethoscope,
  Moon,
  Activity,
  ShieldAlert,
  ShieldCheck,
  Package,
  Radiation,
  Dumbbell,
  Eye,
  Download,
  ScanLine,
  Database,
  Info,
  UserRound,
  ClipboardList,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
} from 'recharts';
import { history, type Crew, type Equipment } from '../data/fixtures';
import { getScenario } from '../data/scenarios';
import {
  formatInvestigationView,
  type ScenarioResponse,
} from '../types/scenario';
import {
  partInfo,
  type AnatomyLayerMode,
  type AnatomyModelStatus,
  type AnatomySex,
} from '../data/anatomy';
import { BodyViewer } from './BodyViewer';
import '../console.css';

type Props = {
  crew: Crew;
  profiles: Crew[];
  onSelectCrew: (id: string) => void;
  inventory: Equipment[];
  flags: boolean[];
  setFlags: (f: boolean[]) => void;
  page: number;
  go: (p: number) => void;
};

const labels = [
  'BP monitor available',
  'BP record available',
  'Earth link online',
  'Manual emergency override',
];

const evidence = {
  readings: {
    title: 'Recorded observations',
    text: 'HR, sleep, radiation, and exercise vs. baseline.',
    links: ['known', 'next'],
  },
  bp: {
    title: 'Missing measurements',
    text: 'Unmeasured values stay Unknown.',
    links: ['unknown', 'resource', 'next'],
  },
  resources: {
    title: 'Equipment dependency',
    text: 'Unavailable equipment blocks dependent checks only.',
    links: ['resource', 'next'],
  },
  next: {
    title: 'Next check',
    text: 'Selected from approved checklists.',
    links: ['known', 'unknown', 'resource', 'next'],
  },
};

function waveformPoints(base = 0, pulse = false) {
  const n = 64;
  return Array.from({ length: n }, (_, i) => {
    const x = (i / (n - 1)) * 180;
    let y = 20 + Math.sin(i * 0.35 + base) * 2.5 + Math.sin(i * 0.09) * 1.5;
    if (pulse) {
      const phase = (i + base) % 22;
      y += phase === 11 ? -15 : phase === 10 || phase === 12 ? 7 : 0;
    }
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function MiniWave({
  tone = 'cobalt',
  pulse = false,
  seed = 0,
}: {
  tone?: 'cobalt' | 'amber' | 'coral';
  pulse?: boolean;
  seed?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`miniwave wave-${tone}`}
      viewBox="0 0 180 42"
      preserveAspectRatio="none"
    >
      <line x1="0" y1="20" x2="180" y2="20" stroke="currentColor" opacity="0.14" />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={waveformPoints(seed, pulse)}
      />
    </svg>
  );
}

function SleepBars() {
  const heights = [34, 48, 28, 60, 44, 38, 56, 72, 46, 64, 42, 54];
  return (
    <div className="sleep-bars" aria-label="Illustrative sleep trend">
      {heights.map((h, i) => (
        <i key={i} style={{ height: `${h}%`, opacity: 0.55 + (i % 3) * 0.16 }} />
      ))}
    </div>
  );
}

function AstronautBadge() {
  return (
    <div className="astronaut-badge" aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <defs>
          <linearGradient id="mednav-helmet-g" x1="0" x2="1" y1="0" y2="1">
            <stop stopColor="#5b9bd5" />
            <stop offset="1" stopColor="#1e4d8c" />
          </linearGradient>
        </defs>
        <path
          d="M25 47Q20 17 50 14Q80 17 75 47L83 81Q50 92 17 81Z"
          fill="#e2e8f0"
          opacity="0.95"
        />
        <path
          d="M31 46Q25 24 50 24Q75 24 69 46Q65 65 50 66Q35 65 31 46"
          fill="#0a0a0c"
          stroke="url(#mednav-helmet-g)"
          strokeWidth="4"
        />
        <path
          d="M35 32Q47 23 59 30"
          stroke="#5b9bd5"
          strokeWidth="3.5"
          fill="none"
          opacity="0.65"
        />
        <path d="M24 74Q50 60 76 74L80 84Q50 94 20 84Z" fill="#3f4b5e" />
        <circle cx="26" cy="74" r="4.5" fill="#f5a623" />
        <circle cx="74" cy="74" r="4.5" fill="#5b9bd5" />
      </svg>
    </div>
  );
}

function downloadJSON(
  crew: Crew,
  inventory: Equipment[],
  response: ScenarioResponse | null
) {
  const sample = {
    project: 'MEDNAV',
    dataset_type: 'synthetic',
    exported_at: new Date().toISOString(),
    subject: crew,
    inventory,
    investigation_response: response,
    note: 'All fields are synthetic demonstration values, not clinical data or diagnosis.',
  };
  const blob = new Blob([JSON.stringify(sample, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mednav-demo-${crew.id.toLowerCase().replace(/\s+/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function MissionConsole({
  crew,
  profiles,
  onSelectCrew,
  inventory,
  flags,
  setFlags,
  page,
  go,
}: Props) {
  const [selected, setSelected] = useState<keyof typeof evidence>('bp');
  const [drawer, setDrawer] = useState(false);
  const [dayIndex, setDayIndex] = useState(history.length - 1);
  const [trendMode, setTrendMode] = useState<'hr' | 'rad' | 'ug'>('hr');
  const [selectedPart, setSelectedPart] = useState('brain');
  const [layerMode, setLayerMode] = useState<AnatomyLayerMode>('xray');
  const [autoRotate, setAutoRotate] = useState(false);
  const [sex, setSex] = useState<AnatomySex>('male');
  const [modelStatus, setModelStatus] = useState<AnatomyModelStatus>('loading');

  // Purely render the engine/fixture response — no separate medical decision logic in the frontend.
  const response = getScenario(flags);
  const view = formatInvestigationView(response);

  const focus = evidence[selected];
  const bp = flags[1] ? (crew.bp ?? view.observationsBp ?? null) : null;
  const monitor = flags[0];

  const dosimeterAvailable =
    inventory.find((e) => e.name === 'Personal radiation dosimeter')?.available ?? true;
  const ultrasoundAvailable =
    inventory.find((e) => e.name === 'Ultrasound unit')?.available ?? false;

  const part = useMemo(
    () => partInfo(selectedPart, crew, bp),
    [crew, selectedPart, bp]
  );

  const focusPart = (partKey: string, preferredMode?: AnatomyLayerMode) => {
    setSelectedPart(partKey);
    if (preferredMode) setLayerMode(preferredMode);
  };

  const missing = [
    crew.hr === null ? 'Heart rate' : null,
    crew.sleep === null ? 'Sleep' : null,
    crew.radiationDailyMsv === null ? 'Daily radiation dose' : null,
    crew.ocularCheck === null ? 'Microgravity ocular check' : null,
    ...(response?.missing_data ?? ['No scenario record']),
  ].filter(Boolean);

  const toggleFlag = (i: number) =>
    setFlags(flags.map((v, j) => (j === i ? !v : v)));

  const knownVitalsCount =
    (crew.hr !== null ? 1 : 0) +
    (crew.sleep !== null ? 1 : 0) +
    (bp !== null ? 1 : 0);

  const usableEquipCount = inventory.filter((e) =>
    e.name === 'Blood-pressure monitor' ? monitor : e.available
  ).length;

  const crewKey = crew.id.slice(-1).toLowerCase() as 'a' | 'b' | 'c';
  const activeHistoryDay = history[dayIndex] ?? history[history.length - 1];
  const dayHr = activeHistoryDay[crewKey];
  const daySleep = activeHistoryDay[`s${crewKey}` as 'sa' | 'sb' | 'sc'];
  const dayRad = activeHistoryDay[`r${crewKey}` as 'ra' | 'rb' | 'rc'];
  const dayCounter = activeHistoryDay[`c${crewKey}` as 'ca' | 'cb' | 'cc'];

  // ---------------------------------------------------------------------------
  // VIEW 0: ASTRONAUT HEALTH OVERVIEW (WITH SPACE RADIATION & MICROGRAVITY)
  // ---------------------------------------------------------------------------
  if (page === 0) {
    const trendDataKey =
      trendMode === 'hr'
        ? crewKey
        : trendMode === 'rad'
        ? (`r${crewKey}` as const)
        : (`c${crewKey}` as const);
    const trendColor =
      trendMode === 'hr'
        ? '#5B9BD5'
        : trendMode === 'rad'
        ? '#F5A623'
        : '#9D7BFF';

    const recordedCount = [
      crew.hr,
      crew.sleep,
      bp,
      crew.radiationDailyMsv,
      crew.radiationCumulativeMsv,
      crew.countermeasureMin,
      crew.ocularCheck,
      crew.bodyMassKg,
    ].filter((v) => v !== null).length;

    const blockedBySensorCount =
      (bp === null && !monitor ? 1 : 0) +
      (crew.radiationDailyMsv === null && !dosimeterAvailable ? 1 : 0) +
      (crew.ocularCheck === null && !ultrasoundAvailable ? 1 : 0);
    const unknownOnlyCount = Math.max(0, 8 - recordedCount - blockedBySensorCount);

    const recordedPct = Math.round((recordedCount / 8) * 100);
    const unknownOnlyPct = Math.round((unknownOnlyCount / 8) * 100);
    const blockedPct = Math.max(0, 100 - recordedPct - unknownOnlyPct);

    return (
      <div className="space-home">
        {/* OVERVIEW 3-COLUMN INTERACTIVE 3D COMMAND CENTER */}
        <section
          className="overview-dashboard-section"
          aria-label="Crew health status dashboard"
        >
          <div className="dashboard-header-bar">
            <div className="dash-title-group">
              <div className="wide-planetary-label left-aligned">
                C R E W &nbsp; H E A L T H &nbsp; · &nbsp; D A Y &nbsp; 1 8 0
              </div>
              <h1 className="section-sans-headline">
                {crew.id} · {crew.role}
              </h1>
            </div>

            <div className="dash-workflow-controls">
              <div
                className="crew-tabs"
                role="region"
                aria-label="Select active crew member"
              >
                {profiles.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`crew-tab ${c.id === crew.id ? 'active' : ''}`}
                    onClick={() => onSelectCrew(c.id)}
                    aria-pressed={c.id === crew.id}
                  >
                    {c.id}
                  </button>
                ))}
              </div>

              <div className="dashboard-header-actions">
                <button
                  type="button"
                  className="hairline-pill-btn"
                  onClick={() => go(1)}
                >
                  Health Check-In
                </button>
                <button
                  type="button"
                  className="hairline-pill-btn active"
                  onClick={() => go(2)}
                >
                  Investigate <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="mednav-3d-dashboard-grid">
            {/* LEFT STACK: VITALS & SYMPTOMS */}
            <div className="left-stack">
              <article className="command-card vitals-card">
                <header className="command-card-header">
                  <div className="command-card-title">
                    <HeartPulse size={18} />
                    <span>Vitals &amp; Telemetry</span>
                  </div>
                  <span className="realtime-tag">
                    {knownVitalsCount}/3 Vitals
                  </span>
                </header>

                <div className="vital-list">
                  <button
                    type="button"
                    className="vital-row rail-reading"
                    onClick={() => focusPart('heart', 'organs')}
                  >
                    <HeartPulse className="vital-icon coral-txt" size={20} />
                    <div className="vital-copy">
                      <small>Heart Rate</small>
                      <strong className={crew.hr === null ? 'unknown-val' : ''}>
                        {crew.hr ?? 'Unknown'}
                        {crew.hr !== null && <sub> bpm</sub>}
                      </strong>
                    </div>
                    <MiniWave
                      tone={crew.hr === null ? 'amber' : 'coral'}
                      pulse={crew.hr !== null}
                      seed={4}
                    />
                  </button>

                  <button
                    type="button"
                    className="vital-row rail-reading"
                    onClick={() => focusPart('heart', 'organs')}
                  >
                    <Stethoscope className="vital-icon ok-txt" size={20} />
                    <div className="vital-copy">
                      <small>Blood Pressure</small>
                      <strong className={!bp ? 'unknown-val bp-number' : 'bp-number'}>
                        {bp ?? 'Unknown'}
                        {bp && <sub> mmHg</sub>}
                      </strong>
                    </div>
                    <MiniWave tone={!bp ? 'amber' : 'cobalt'} seed={7} />
                  </button>

                  <button
                    type="button"
                    className="vital-row rail-reading"
                    onClick={() => focusPart('brain', 'organs')}
                  >
                    <Moon className="vital-icon ok-txt" size={20} />
                    <div className="vital-copy">
                      <small>Sleep</small>
                      <strong className={crew.sleep === null ? 'unknown-val' : ''}>
                        {crew.sleep ?? 'Unknown'}
                        {crew.sleep !== null && <sub> h</sub>}
                      </strong>
                    </div>
                    <SleepBars />
                  </button>

                  <button
                    type="button"
                    className="hazard-row-btn"
                    onClick={() => focusPart('skin', 'surface')}
                  >
                    <Radiation size={16} className="amber-text" />
                    <div className="hazard-row-copy">
                      <small>Radiation</small>
                      <strong
                        className={
                          crew.radiationDailyMsv === null ? 'unknown-val' : ''
                        }
                      >
                        {crew.radiationDailyMsv !== null
                          ? `${crew.radiationDailyMsv} mSv/d`
                          : 'Unknown'}
                      </strong>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="hazard-row-btn"
                    onClick={() => focusPart('femur_l', 'skeleton')}
                  >
                    <Dumbbell size={16} className="ok-txt" />
                    <div className="hazard-row-copy">
                      <small>ARED Exercise</small>
                      <strong
                        className={
                          crew.countermeasureMin === null ? 'unknown-val' : ''
                        }
                      >
                        {crew.countermeasureMin !== null
                          ? `${crew.countermeasureMin}/${crew.countermeasureTargetMin} min`
                          : 'Unknown'}
                      </strong>
                    </div>
                  </button>
                </div>
              </article>

              <article className="command-card symptoms-card">
                <header className="command-card-header">
                  <div className="command-card-title">
                    <ClipboardList size={18} />
                    <span>Symptoms</span>
                  </div>
                  <button
                    type="button"
                    className="mini-action-link"
                    onClick={() => go(1)}
                  >
                    Edit
                  </button>
                </header>

                <div className="symptoms-compact-list">
                  {crew.symptoms.length > 0 ? (
                    crew.symptoms.map((sym) => (
                      <div className="symptom-line" key={sym}>
                        <span>{sym}</span>
                        <span className="kpi-status-pill coral">ACTIVE</span>
                      </div>
                    ))
                  ) : (
                    <div className="symptom-line">
                      <span>None reported</span>
                      <span className="kpi-status-pill ok">CLEAR</span>
                    </div>
                  )}
                </div>
              </article>
            </div>

            {/* CENTER STAGE: INTERACTIVE 3D HUMAN ANATOMY */}
            <BodyViewer
              selectedPart={selectedPart}
              setSelectedPart={setSelectedPart}
              layerMode={layerMode}
              setLayerMode={setLayerMode}
              autoRotate={autoRotate}
              setAutoRotate={setAutoRotate}
              sex={sex}
              setSex={setSex}
              modelStatus={modelStatus}
              setModelStatus={setModelStatus}
            />

            {/* RIGHT STACK: NEXT CHECK & SELECTED ANATOMY */}
            <div className="right-stack">
              <article className="command-card next-check-status-card compact-nc">
                <div className="nc-card-header">
                  <span className="wide-planetary-label left-aligned">
                    N E X T &nbsp; C H E C K
                  </span>
                  <span className={`kpi-status-pill ${view.statusTone}`}>
                    {view.statusBadge}
                  </span>
                </div>

                <h3>{view.nextCheckTitle}</h3>
                <p>{view.selectedExplanation}</p>

                <div className="nc-status-chips">
                  <div className="nc-chip">
                    <Package size={14} />
                    <span>
                      Usable: <b>{usableEquipCount}/{inventory.length}</b>
                    </span>
                  </div>
                  <div className="nc-chip">
                    <ShieldAlert size={14} />
                    <span>
                      BP Mon:{' '}
                      <b className={!monitor ? 'unknown-val' : ''}>
                        {monitor ? 'Ready' : 'Blocked'}
                      </b>
                    </span>
                  </div>
                </div>

                <div className="slide-action-pill-track">
                  <button
                    type="button"
                    className="slide-pill-secondary"
                    onClick={() => go(1)}
                  >
                    Check-In
                  </button>
                  <button
                    type="button"
                    className="slide-pill-thumb"
                    onClick={() => go(2)}
                    aria-label="Open Health Investigation"
                  >
                    <span>Investigate</span>
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              </article>

              <article className="command-card selected-card">
                <header className="command-card-header">
                  <div className="command-card-title">
                    <ScanLine size={18} />
                    <span>Selected Region</span>
                  </div>
                  <span className="kpi-status-pill ok">{part.system}</span>
                </header>

                <div className="selected-top">
                  <div className="selected-organ-icon">
                    <UserRound size={20} />
                  </div>
                  <div className="selected-title-wrap">
                    <h3>{part.label}</h3>
                  </div>
                </div>

                <div className="selected-metric">
                  <span>{part.metric}</span>
                  <strong
                    className={
                      part.value.includes('Unknown') ? 'unknown-val' : ''
                    }
                  >
                    {part.value}
                  </strong>
                </div>
              </article>
            </div>
          </div>

          {/* 7-DAY TELEMETRY TREND CARD */}
          <div className="dashboard-below-trend">
            <article className="orbital-trend-card">
              <div className="trend-card-head">
                <div>
                  <span className="wide-planetary-label left-aligned">
                    7 - D A Y &nbsp; T R E N D
                  </span>
                  <span className="trend-sub-val">
                    {crew.id} · D174–D180
                  </span>
                </div>

                <div className="trend-mode-pills">
                  <button
                    type="button"
                    className={`hairline-pill-btn ${
                      trendMode === 'hr' ? 'active' : ''
                    }`}
                    onClick={() => setTrendMode('hr')}
                  >
                    Heart Rate
                  </button>
                  <button
                    type="button"
                    className={`hairline-pill-btn ${
                      trendMode === 'rad' ? 'active' : ''
                    }`}
                    onClick={() => setTrendMode('rad')}
                  >
                    Radiation
                  </button>
                  <button
                    type="button"
                    className={`hairline-pill-btn ${
                      trendMode === 'ug' ? 'active' : ''
                    }`}
                    onClick={() => setTrendMode('ug')}
                  >
                    μG Exercise
                  </button>
                </div>
              </div>

              <div className="trend-chart-wrap" onClick={() => go(2)}>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="cobaltGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor={trendColor}
                          stopOpacity={0.45}
                        />
                        <stop
                          offset="100%"
                          stopColor={trendColor}
                          stopOpacity={0.0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="day"
                      stroke="rgba(255,255,255,0.35)"
                      tick={{ fill: '#A1A1AA', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Area
                      isAnimationActive={false}
                      type="monotone"
                      dataKey={trendDataKey}
                      stroke={trendColor}
                      strokeWidth={2}
                      fill="url(#cobaltGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW 5: INCIDENT REPORT
  // ---------------------------------------------------------------------------
  if (page === 5) {
    return (
      <div className="mission-console space-subpage">
        <div className="subpage-top-bar">
          <button
            type="button"
            className="hairline-pill-btn"
            onClick={() => go(2)}
          >
            <ArrowLeft size={16} /> Back to Investigation
          </button>
          <div className="wide-planetary-label">
            I N C I D E N T &nbsp; R E P O R T
          </div>
          <span className="hairline-status-tag">
            PENDING GROUND REVIEW · OFFLINE
          </span>
        </div>

        <div className="asymmetric-workspace-grid">
          <section className="left-telemetry-column">
            <h1 className="section-sans-headline">
              {view.id} / {crew.id}
            </h1>
            <p className="telemetry-summary-copy">
              {view.selectedExplanation}
            </p>

            <dl className="hairline-telemetry-list">
              {[
                ['Heart rate:', crew.hr === null ? 'Unknown' : `${crew.hr} bpm`],
                ['Sleep:', crew.sleep === null ? 'Unknown' : `${crew.sleep} hours`],
                ['Blood pressure:', bp ?? 'Unknown'],
                [
                  'Space radiation (daily):',
                  crew.radiationDailyMsv === null
                    ? 'Unknown'
                    : `${crew.radiationDailyMsv} mSv/day (Baseline ${crew.radiationBaselineMsv} mSv/day)`,
                ],
                [
                  'Space radiation (180d cumulative):',
                  crew.radiationCumulativeMsv === null
                    ? 'Unknown'
                    : `${crew.radiationCumulativeMsv} mSv`,
                ],
                [
                  'Microgravity exercise (ARED):',
                  crew.countermeasureMin === null
                    ? 'Unknown'
                    : `${crew.countermeasureMin} / ${crew.countermeasureTargetMin} min`,
                ],
                [
                  'Microgravity body mass (SLAMMD):',
                  crew.bodyMassKg === null
                    ? 'Unknown'
                    : `${crew.bodyMassKg} kg (Baseline ${crew.baselineMassKg} kg)`,
                ],
                [
                  'Microgravity ocular check (SANS):',
                  crew.ocularCheck ?? 'Unknown',
                ],
                ['Symptoms:', crew.symptoms.join(', ') || 'None reported'],
                [
                  'Missing information:',
                  missing.join(', ') || 'No missing form readings',
                ],
                ['BP monitor:', monitor ? 'Available' : 'Unavailable'],
                [
                  'Ultrasound unit:',
                  ultrasoundAvailable ? 'Available' : 'Unavailable',
                ],
                ['Earth link:', flags[2] ? 'Online (simulated)' : 'Offline'],
                ['Status:', view.status],
                [
                  'Next check:',
                  view.hasNextCheck ? view.nextCheckTitle : 'None',
                ],
              ].map(([k, v]) => (
                <div className="telemetry-kv-row" key={k}>
                  <dt>{k}</dt>
                  <dd className={v === 'Unknown' ? 'unknown-val' : ''}>{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <aside className="right-frosted-sheet">
            <div className="wide-planetary-label left-aligned">
              C H E C K L I S T &nbsp; R A T I O N A L E
            </div>
            <h3>Selection Rationale</h3>
            <p>{view.selectedExplanation}</p>
            <p>{view.excludedExplanation}</p>

            <div className="sheet-divider" />

            <div className="telemetry-kv-row compact">
              <dt>Data Source:</dt>
              <dd>Synthetic Telemetry</dd>
            </div>
            <div className="telemetry-kv-row compact">
              <dt>Clinical Scope:</dt>
              <dd>Non-Diagnostic Navigation</dd>
            </div>

            <button
              type="button"
              className="ghost-rect-cta full-width export-json-btn"
              onClick={() => downloadJSON(crew, inventory, response)}
            >
              <Download size={16} />
              <span>Export JSON</span>
            </button>
          </aside>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW 3: MISSION WHAT-IF LAB
  // ---------------------------------------------------------------------------
  if (page === 3) {
    return (
      <div className="mission-console space-subpage">
        <div className="subpage-top-bar">
          <button
            type="button"
            className="hairline-pill-btn"
            onClick={() => go(0)}
          >
            <ArrowLeft size={16} /> Overview
          </button>
          <div className="wide-planetary-label">
            W H A T - I F &nbsp; S C E N A R I O &nbsp; L A B
          </div>
          <button
            type="button"
            className="hairline-pill-btn"
            onClick={() => setFlags([false, false, false, false])}
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>

        <div className="asymmetric-workspace-grid">
          <section className="left-telemetry-column" aria-label="What-if controls">
            <h1 className="section-sans-headline">
              Simulate Conditions
            </h1>
            <p className="telemetry-summary-copy">
              Toggle measurement, equipment, and override states to preview
              next-check routing.
            </p>

            <div className="preset-hairline-row">
              <button
                type="button"
                className="hairline-pill-btn"
                onClick={() => setFlags([false, false, false, false])}
              >
                Needs Review (Monitor Blocked)
              </button>
              <button
                type="button"
                className="hairline-pill-btn"
                onClick={() => setFlags([false, false, true, false])}
              >
                Insufficient Evidence (next_check: null)
              </button>
              <button
                type="button"
                className="hairline-pill-btn"
                onClick={() => setFlags([true, false, false, false])}
              >
                BP Monitor Ready
              </button>
              <button
                type="button"
                className="hairline-pill-btn"
                onClick={() => setFlags([false, true, false, false])}
              >
                BP Recorded
              </button>
              <button
                type="button"
                className="hairline-pill-btn"
                onClick={() => setFlags([false, false, false, true])}
              >
                Escalate (Emergency Override)
              </button>
            </div>

            <div className="hairline-telemetry-list">
              {labels.map((l, i) => (
                <button
                  key={l}
                  role="switch"
                  aria-checked={flags[i]}
                  aria-label={l}
                  onClick={() => toggleFlag(i)}
                  className={`telemetry-switch-row ${flags[i] ? 'active' : ''}`}
                >
                  <span>{l}</span>
                  <span className="switch-state-indicator">
                    {flags[i] ? 'ACTIVE ◆' : 'INACTIVE —'}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <aside className="right-frosted-sheet" aria-label="Decision trace">
            <div className="wide-planetary-label left-aligned">
              {view.statusBadge}
            </div>

            <h2>{view.nextCheckTitle}</h2>

            <dl className="hairline-telemetry-list compact-list">
              <div className="telemetry-kv-row compact">
                <dt>Status:</dt>
                <dd>{view.status}</dd>
              </div>
              <div className="telemetry-kv-row compact">
                <dt>Blood Pressure:</dt>
                <dd className={!bp ? 'unknown-val' : ''}>
                  {bp ? `${bp} mmHg` : 'Unknown'}
                </dd>
              </div>
              <div className="telemetry-kv-row compact">
                <dt>BP Monitor:</dt>
                <dd>{monitor ? 'Available' : 'Unavailable'}</dd>
              </div>
              <div className="telemetry-kv-row compact">
                <dt>Required Equipment:</dt>
                <dd>
                  {view.nextCheckEquipment.length > 0
                    ? view.nextCheckEquipment.join(', ')
                    : 'None'}
                </dd>
              </div>
              <div className="telemetry-kv-row compact">
                <dt>Scenario ID:</dt>
                <dd>{view.id}</dd>
              </div>
            </dl>

            <div className="trace-copy-block">
              <span className="micro-label">WHY SELECTED</span>
              <p>{view.selectedExplanation}</p>
            </div>

            <div className="trace-copy-block">
              <span className="micro-label">WHY EXCLUDED</span>
              <p>{view.excludedExplanation}</p>
            </div>

            <button
              type="button"
              className="ghost-rect-cta full-width"
              onClick={() => go(5)}
            >
              <span>View Incident Report</span>
              <ArrowUpRight size={18} />
            </button>
          </aside>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW 2: HEALTH INVESTIGATION (EVIDENCE & NEXT-CHECK NAVIGATION)
  // ---------------------------------------------------------------------------
  return (
    <div className="mission-console space-subpage">
      <div className="subpage-top-bar">
        <button
          type="button"
          className="hairline-pill-btn"
          onClick={() => go(0)}
        >
          <ArrowLeft size={15} /> Overview
        </button>

        <div className="wide-planetary-label">
          H E A L T H &nbsp; I N V E S T I G A T I O N &nbsp; · &nbsp;{' '}
          {crew.id.toUpperCase()}
        </div>

        <button
          type="button"
          className="hairline-pill-btn"
          aria-expanded={drawer}
          onClick={() => setDrawer(!drawer)}
        >
          <SlidersHorizontal size={15} />
          {drawer ? 'Close What-If' : 'What-If Controls'}
        </button>
      </div>

      {drawer && (
        <section className="orbital-scenario-drawer" aria-label="What-if controls">
          <div className="drawer-switches-grid">
            {labels.map((l, i) => (
              <button
                key={l}
                role="switch"
                aria-checked={flags[i]}
                aria-label={l}
                onClick={() => toggleFlag(i)}
                className={`telemetry-switch-row ${flags[i] ? 'active' : ''}`}
              >
                <strong>{l}</strong>
                <span className="switch-state-indicator">
                  {flags[i] ? 'ON ◆' : 'OFF —'}
                </span>
              </button>
            ))}
          </div>
          <div className="drawer-reset-bar">
            <button
              type="button"
              className="hairline-pill-btn"
              onClick={() => setFlags([false, false, false, false])}
            >
              Reset to original
            </button>
          </div>
        </section>
      )}

      {/* Crew Snapshot Strip */}
      <section className="inv-snapshot-grid" aria-label="Crew telemetry summary">
        <div className="inv-stat-card">
          <span className="inv-stat-label">CREW MEMBER</span>
          <strong>{crew.id}</strong>
          <small>{crew.role}</small>
        </div>
        <div className="inv-stat-card">
          <span className="inv-stat-label">HEART RATE</span>
          <strong className={crew.hr === null ? 'unknown-val' : ''}>
            {crew.hr !== null ? `${crew.hr} bpm` : 'Unknown'}
          </strong>
          <small>Baseline {crew.baseline} bpm</small>
        </div>
        <div className="inv-stat-card">
          <span className="inv-stat-label">BLOOD PRESSURE</span>
          <strong className={!bp ? 'unknown-val' : ''}>
            {bp ? `${bp} mmHg` : 'Unknown'}
          </strong>
          <small>{monitor ? 'Monitor available' : 'Monitor unavailable'}</small>
        </div>
        <div className="inv-stat-card">
          <span className="inv-stat-label">RADIATION / ARED</span>
          <strong className={crew.radiationDailyMsv === null ? 'unknown-val' : ''}>
            {crew.radiationDailyMsv !== null
              ? `${crew.radiationDailyMsv} mSv/d`
              : 'Unknown'}
          </strong>
          <small>
            Exercise{' '}
            {crew.countermeasureMin !== null
              ? `${crew.countermeasureMin}/${crew.countermeasureTargetMin} min`
              : 'Unknown'}
          </small>
        </div>
      </section>

      {/* Main Investigation Workspace */}
      <div className="asymmetric-workspace-grid inv-workspace">
        <section className="left-telemetry-column" aria-label="Evidence tiers">
          <div className="inv-section-head">
            <h1 className="section-sans-headline">Evidence &amp; Routing</h1>
            <p className="telemetry-summary-copy">
              Select any tier to inspect how recorded observations, missing data,
              and equipment constraints shape the next check.
            </p>
          </div>

          <div className="orbital-evidence-stack">
            <div
              className={`evidence-stage-card ${
                focus.links.includes('known') ? 'linked' : ''
              }`}
            >
              <div className="stage-card-head">
                <span>01 · KNOWN OBSERVATIONS</span>
                <span>RECORDED</span>
              </div>
              <button
                type="button"
                className={`evidence-item ${
                  selected === 'readings' ? 'chosen' : ''
                }`}
                onClick={() => setSelected('readings')}
                aria-pressed={selected === 'readings'}
              >
                <span>
                  <strong>
                    Vitals, radiation dosimetry &amp; microgravity load
                  </strong>
                  <small>
                    HR {crew.hr ?? 'Unknown'} · Sleep {crew.sleep ?? 'Unknown'}{' '}
                    · Rad{' '}
                    {crew.radiationDailyMsv !== null
                      ? `${crew.radiationDailyMsv} mSv/d`
                      : 'Unknown'}{' '}
                    · ARED{' '}
                    {crew.countermeasureMin !== null
                      ? `${crew.countermeasureMin}m`
                      : 'Unknown'}
                  </small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            </div>

            <div
              className={`evidence-stage-card missing-stage ${
                focus.links.includes('unknown') ? 'linked' : ''
              }`}
            >
              <div className="stage-card-head">
                <span>02 · MISSING &amp; EQUIPMENT</span>
                <span>{missing.length ? 'INCOMPLETE' : 'COMPLETE'}</span>
              </div>
              <button
                type="button"
                className={`evidence-item ${selected === 'bp' ? 'chosen' : ''}`}
                onClick={() => setSelected('bp')}
                aria-pressed={selected === 'bp'}
              >
                <span>
                  <strong>Blood pressure &amp; microgravity ocular check</strong>
                  <small className={!bp || !crew.ocularCheck ? 'unknown-val' : ''}>
                    BP: {bp ? `${bp} mmHg` : 'Unknown'} · Ocular:{' '}
                    {crew.ocularCheck ?? 'Unknown'}
                  </small>
                </span>
                <ArrowUpRight size={16} />
              </button>

              <button
                type="button"
                className={`resource-link ${monitor ? 'available ' : ''}${
                  selected === 'resources' ? 'chosen' : ''
                }`}
                onClick={() => setSelected('resources')}
                aria-pressed={selected === 'resources'}
              >
                <span>
                  {monitor
                    ? 'BP monitor available'
                    : 'Blocked: BP monitor unavailable'}{' '}
                  · Ultrasound:{' '}
                  {ultrasoundAvailable ? 'Available' : 'Unavailable'}
                </span>
                <ArrowUpRight size={15} />
              </button>
            </div>

            <div
              className={`evidence-stage-card next-stage ${
                view.status === 'escalate' ? 'escalation ' : ''
              }${focus.links.includes('next') ? 'linked' : ''}`}
            >
              <div className="stage-card-head">
                <span>03 · RECOMMENDED NEXT CHECK</span>
                <span>
                  {view.status === 'escalate'
                    ? 'ESCALATED'
                    : view.hasNextCheck
                    ? 'FEASIBLE'
                    : 'NO CHECK'}
                </span>
              </div>
              <button
                type="button"
                className={`evidence-item ${
                  selected === 'next' ? 'chosen' : ''
                }`}
                onClick={() => setSelected('next')}
                aria-pressed={selected === 'next'}
              >
                <span>
                  <strong>{view.nextCheckTitle}</strong>
                  <small>
                    Status: {view.status} ·{' '}
                    {view.status === 'escalate'
                      ? 'Manual emergency override'
                      : 'Medical officer review required'}
                  </small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            </div>
          </div>
        </section>

        <aside className="right-frosted-sheet decision-trace inv-decision-panel" aria-label="Decision trace">
          <div className="trace-header-line">
            <span className="wide-planetary-label left-aligned">
              D E C I S I O N &nbsp; T R A C E
            </span>
            <span
              className={
                'trace-status ' +
                (view.status === 'escalate' ? 'escalation' : '')
              }
            >
              {view.statusBadge}
            </span>
          </div>

          <h2>{view.nextCheckTitle}</h2>

          <div className="selection-context" aria-live="polite">
            <strong>{focus.title}</strong>
            <p>{focus.text}</p>
          </div>

          <div className="trace-section">
            <span className="micro-label">WHY SELECTED</span>
            <p>{view.selectedExplanation}</p>
          </div>

          <div className="trace-section">
            <span className="micro-label">WHY EXCLUDED</span>
            <p>{view.excludedExplanation}</p>
          </div>

          <div className="trace-section">
            <span className="micro-label">REQUIRED EQUIPMENT</span>
            <p>
              {view.nextCheckEquipment.length > 0
                ? view.nextCheckEquipment.join(', ')
                : 'None'}
            </p>
          </div>

          <button
            type="button"
            className="ghost-rect-cta full-width inv-report-cta"
            onClick={() => go(5)}
          >
            <FileText size={16} />
            <span>Open Incident Report</span>
            <ArrowUpRight size={16} />
          </button>
        </aside>
      </div>
    </div>
  );
}
