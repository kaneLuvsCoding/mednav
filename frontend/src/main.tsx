import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight,
  Check,
  Menu,
  X,
  RotateCcw,
  LayoutDashboard,
  ClipboardList,
  Microscope,
  SlidersHorizontal,
  Package,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Activity,
  ScanLine,
  Search,
  RefreshCw,
  Mic,
  ShieldCheck,
} from 'lucide-react';
import { MissionConsole } from './components/MissionConsole';
import { VoiceCheckIn } from './components/VoiceCheckIn';
import { Panel, Badge } from './components/ui';
import {
  crews,
  equipment,
  symptomOptions,
  type Crew,
  type Equipment,
} from './data/fixtures';
import './styles.css';

const navItems = [
  { label: 'Dashboard', page: 0, icon: LayoutDashboard },
  { label: 'Health Check-In', page: 1, icon: ClipboardList },
  { label: 'Investigation', page: 2, icon: Microscope },
  { label: 'What-If Lab', page: 3, icon: SlidersHorizontal },
  { label: 'Medical Inventory', page: 4, icon: Package },
  { label: 'Incident Report', page: 5, icon: FileText },
];

const value = (v: number | string | null, unit = '') =>
  v === null ? 'Unknown' : `${v}${unit}`;

function App() {
  const [page, setPage] = useState(0);
  const [crewId, setCrewId] = useState('Crew A');
  const [profiles, setProfiles] = useState(crews);
  const [inventory, setInventory] = useState(equipment);
  const [mobile, setMobile] = useState(false);
  const [, setActivity] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [flags, setFlags] = useState([false, false, false, false]);

  const crew = profiles.find((c) => c.id === crewId)!;

  const go = (p: number) => {
    setPage(p);
    setMobile(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCrew = (nextId: string) => {
    setCrewId(nextId);
    const nextCrew = profiles.find((c) => c.id === nextId)!;
    setFlags((f) => [f[0], nextCrew.bp !== null, f[2], f[3]]);
  };

  const isConsolePage = [0, 2, 3, 5].includes(page);

  return (
    <div className="app-shell">
      <a href="#main" className="skip">
        Skip to content
      </a>

      {/* LEFT VERTICAL SIDEBAR SHELL (PORTED FROM FRONTEND2 IN ORBITAL VOID PALETTE) */}
      <aside className={`sidebar ${mobile ? 'sidebar-open' : ''}`}>
        <div className="side-identity">
          <div className="logo-orbit" aria-hidden="true">
            <span />
            <i />
          </div>
          <div className="side-brand">
            MEDNAV<sup>™</sup>
          </div>
          <div className="side-tagline">
            ASTRONAUT HEALTH
            <br />
            MONITORING SYSTEM
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className={`nav-item ${page === item.page ? 'nav-current' : ''}`}
                onClick={() => go(item.page)}
                aria-current={page === item.page ? 'page' : undefined}
              >
                <Icon size={20} strokeWidth={1.8} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="side-bottom">
          <div className="program-logo">
            <div className="nasa-ish">M</div>
            <div>
              <strong>MEDNAV</strong>
              <small>
                Space Health Program
                <br />
                Offline Telemetry
              </small>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN AREA WITH TOPBAR & WORKSPACE */}
      <div className="main-area">
        <header className="topbar">
          <button
            type="button"
            className="mobile-menu-btn"
            aria-label="Toggle navigation"
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div className="brand-divider" aria-hidden="true" />
          <div className="header-subtitle">Astronaut Health Monitoring</div>

          <div className="topbar-right">
            <label className="crew-select-inline">
              <span>CREW</span>
              <select
                value={crewId}
                onChange={(e) => handleSelectCrew(e.target.value)}
              >
                {profiles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
              </select>
            </label>

            <div className="prototype-label">
              Synthetic Telemetry · Non-Diagnostic
            </div>
          </div>
        </header>

        <main id="main">
        {isConsolePage && (
          <MissionConsole
            key={page}
            crew={crew}
            profiles={profiles}
            onSelectCrew={handleSelectCrew}
            inventory={inventory}
            flags={flags}
            setFlags={(f) => {
              setFlags(f);
              setInventory((v) =>
                v.map((e) =>
                  e.name === 'Blood-pressure monitor'
                    ? { ...e, available: f[0] }
                    : e
                )
              );
            }}
            page={page}
            go={go}
          />
        )}

        {page === 1 && (
          <CheckIn
            key={crew.id}
            crew={crew}
            save={(c) => {
              setProfiles((p) => p.map((x) => (x.id === c.id ? c : x)));
              setFlags((f) => [f[0], c.bp !== null, f[2], f[3]]);
              setActivity((a) => [`${c.id} · Check-in saved`, ...a]);
            }}
            investigate={() => go(2)}
          />
        )}

        {page === 4 && (
          <MedicalInventory
            inventory={inventory}
            setInventory={setInventory}
            flags={flags}
            setFlags={setFlags}
            search={search}
            setSearch={setSearch}
            category={category}
            setCategory={setCategory}
          />
        )}

        <footer>
          <span>MEDNAV · ASTRONAUT HEALTH MONITORING</span>
          <span>SYNTHETIC TELEMETRY · OFFLINE</span>
        </footer>
        </main>
      </div>
    </div>
  );
}

function Observation({ crew }: { crew: Crew }) {
  return (
    <dl className="hairline-telemetry-list">
      {[
        ['Heart Rate:', value(crew.hr, ' bpm')],
        ['Sleep Duration:', value(crew.sleep, ' hours')],
        ['Blood Pressure:', value(crew.bp, ' mmHg')],
        ['Space Radiation (Daily):', value(crew.radiationDailyMsv, ' mSv/day')],
        ['Microgravity Exercise (ARED):', value(crew.countermeasureMin, ' min')],
        ['Body Mass (SLAMMD):', value(crew.bodyMassKg, ' kg')],
        ['Ocular / SANS Check:', crew.ocularCheck ?? 'Unknown'],
        ['Reported Symptoms:', crew.symptoms.join(', ') || 'None reported'],
      ].map(([k, v]) => (
        <div className="telemetry-kv-row" key={k}>
          <dt>{k}</dt>
          <dd className={v === 'Unknown' ? 'unknown-val' : ''}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function CheckIn({
  crew,
  save,
  investigate,
}: {
  crew: Crew;
  save: (c: Crew) => void;
  investigate: () => void;
}) {
  const [symptoms, setSymptoms] = useState(crew.symptoms);
  const [hr, setHr] = useState(crew.hr?.toString() || '');
  const [sleep, setSleep] = useState(crew.sleep?.toString() || '');
  const [sys, setSys] = useState(crew.bp?.split(' / ')[0] || '');
  const [dia, setDia] = useState(crew.bp?.split(' / ')[1] || '');
  const [rad, setRad] = useState(crew.radiationDailyMsv?.toString() || '');
  const [ared, setAred] = useState(crew.countermeasureMin?.toString() || '');
  const [mass, setMass] = useState(crew.bodyMassKg?.toString() || '');
  const [review, setReview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [syncedNotice, setSyncedNotice] = useState(false);

  const syncSensors = () => {
    setHr(crew.hr !== null ? String(crew.hr) : String(crew.baseline));
    setSleep(
      crew.sleep !== null ? String(crew.sleep) : String(crew.sleepBaseline)
    );
    setRad(
      crew.radiationDailyMsv !== null
        ? String(crew.radiationDailyMsv)
        : String(crew.radiationBaselineMsv)
    );
    setAred(
      crew.countermeasureMin !== null
        ? String(crew.countermeasureMin)
        : String(crew.countermeasureTargetMin)
    );
    setMass(
      crew.bodyMassKg !== null
        ? String(crew.bodyMassKg)
        : String(crew.baselineMassKg)
    );
    setSyncedNotice(true);
  };

  const stepValue = (
    val: string,
    setter: (v: string) => void,
    delta: number,
    min = 0,
    decimals = 0
  ) => {
    const base = val === '' ? 0 : Number(val);
    const next = Math.max(min, Number((base + delta).toFixed(decimals)));
    setter(String(next));
  };

  const draft: Crew = {
    ...crew,
    symptoms,
    hr: hr === '' ? null : Number(hr),
    sleep: sleep === '' ? null : Number(sleep),
    bp: sys && dia ? `${sys} / ${dia}` : null,
    radiationDailyMsv: rad === '' ? null : Number(rad),
    countermeasureMin: ared === '' ? null : Number(ared),
    bodyMassKg: mass === '' ? null : Number(mass),
  };

  return (
    <div className="space-subpage">
      <div className="asymmetric-workspace-grid">
        <section className="left-telemetry-column">
          <div className="wide-planetary-label left-aligned">
            H E A L T H &nbsp; C H E C K - I N &nbsp; · &nbsp; {crew.id.toUpperCase()}
          </div>
          <h1 className="section-sans-headline">
            {saved
              ? 'Health Check-In Saved'
              : review
              ? 'Review Recorded Observations'
              : `Health Check-In for ${crew.id}`}
          </h1>

          {saved ? (
            <div className="checkin-saved-box">
              <p role="status" className="status-success">
                <Check size={18} /> Saved to local health log for {crew.id}.
              </p>
              <button className="ghost-rect-cta" onClick={investigate}>
                <span>Open Investigation</span>
                <ArrowUpRight size={18} />
              </button>
            </div>
          ) : review ? (
            <div>
              <Observation crew={draft} />
              <div className="review-actions">
                <button
                  className="hairline-pill-btn"
                  onClick={() => setReview(false)}
                >
                  Edit Observations
                </button>
                <button
                  className="ghost-rect-cta"
                  onClick={() => {
                    save(draft);
                    setSaved(true);
                  }}
                >
                  <span>Save Check-In</span>
                  <ArrowUpRight size={18} />
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (Boolean(sys) !== Boolean(dia)) {
                  setError(
                    'Enter both blood-pressure values or leave both Unknown.'
                  );
                  return;
                }
                setError('');
                setReview(true);
              }}
            >
              {/* Confirm-First Quick-Action Bar */}
              <div className="checkin-quick-bar">
                <button
                  type="button"
                  className="quick-nominal-btn"
                  onClick={() => {
                    setSymptoms([]);
                    setError('');
                    if (Boolean(sys) !== Boolean(dia)) {
                      setSys('');
                      setDia('');
                    }
                    setReview(true);
                  }}
                >
                  <ShieldCheck size={16} />
                  <span>All Nominal · No Symptoms</span>
                </button>

                <button
                  type="button"
                  className="hairline-pill-btn"
                  onClick={syncSensors}
                >
                  <RefreshCw size={14} />
                  <span>
                    {syncedNotice ? 'Sensors Synced' : 'Sync Station Sensors'}
                  </span>
                </button>

                <button
                  type="button"
                  className={`hairline-pill-btn ${voiceOpen ? 'active' : ''}`}
                  aria-expanded={voiceOpen}
                  onClick={() => setVoiceOpen((v) => !v)}
                >
                  <Mic size={14} />
                  <span>{voiceOpen ? 'Hide Voice' : 'Hands-Free Voice'}</span>
                </button>
              </div>

              {voiceOpen && (
                <VoiceCheckIn
                  onApply={(parsed) => {
                    if (parsed.clearSymptoms) {
                      setSymptoms([]);
                    } else if (parsed.symptoms && parsed.symptoms.length > 0) {
                      setSymptoms(parsed.symptoms);
                    }
                    if (parsed.hr !== undefined && parsed.hr !== null) {
                      setHr(parsed.hr);
                    }
                    if (parsed.sleep !== undefined && parsed.sleep !== null) {
                      setSleep(parsed.sleep);
                    }
                    if (parsed.sys !== undefined && parsed.sys !== null) {
                      setSys(parsed.sys);
                    }
                    if (parsed.dia !== undefined && parsed.dia !== null) {
                      setDia(parsed.dia);
                    }
                  }}
                />
              )}

              <fieldset>
                <div className="fieldset-header">
                  <legend>1 · Symptoms (Tap to Toggle)</legend>
                  <button
                    type="button"
                    className={`hairline-pill-btn ${
                      symptoms.length === 0 ? 'active' : ''
                    }`}
                    onClick={() => setSymptoms([])}
                  >
                    None Reported
                  </button>
                </div>
                <div className="symptom-options">
                  {symptomOptions.map((s) => (
                    <label key={s}>
                      <input
                        type="checkbox"
                        checked={symptoms.includes(s)}
                        onChange={() =>
                          setSymptoms((v) =>
                            v.includes(s)
                              ? v.filter((x) => x !== s)
                              : [...v, s]
                          )
                        }
                      />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="vitals-section-head">
                <strong>2 · Sensor Telemetry &amp; Manual Measurements</strong>
                <span>Confirm synced values or mark Unknown</span>
              </div>

              <div className="form-grid">
                {[
                  {
                    id: 0,
                    label: 'Heart rate (bpm)',
                    val: hr,
                    set: setHr,
                    step: 1,
                    min: 1,
                    decimals: 0,
                    source: 'WEARABLE',
                  },
                  {
                    id: 1,
                    label: 'Sleep (hours)',
                    val: sleep,
                    set: setSleep,
                    step: 0.5,
                    min: 0,
                    decimals: 1,
                    source: 'WEARABLE',
                  },
                  {
                    id: 4,
                    label: 'Space radiation (mSv/day)',
                    val: rad,
                    set: setRad,
                    step: 0.05,
                    min: 0.01,
                    decimals: 2,
                    source: 'DOSIMETER',
                  },
                  {
                    id: 5,
                    label: 'ARED exercise (min)',
                    val: ared,
                    set: setAred,
                    step: 10,
                    min: 0,
                    decimals: 0,
                    source: 'STATION',
                  },
                  {
                    id: 6,
                    label: 'Body mass SLAMMD (kg)',
                    val: mass,
                    set: setMass,
                    step: 0.2,
                    min: 1,
                    decimals: 1,
                    source: 'STATION',
                  },
                ].map((f) => {
                  const isUnknown = f.val === '';
                  return (
                    <div
                      className={`field-card ${isUnknown ? 'is-unknown' : ''}`}
                      key={f.label}
                    >
                      <div className="field-card-head">
                        <label htmlFor={`field-${f.id}`}>{f.label}</label>
                        <div className="field-badge-group">
                          <span
                            className={`source-chip ${
                              isUnknown ? 'unknown' : 'sensor'
                            }`}
                          >
                            {isUnknown ? 'UNKNOWN' : f.source}
                          </span>
                          <button
                            type="button"
                            className="unknown-option"
                            aria-pressed={isUnknown}
                            onClick={() => f.set('')}
                          >
                            Unknown
                          </button>
                        </div>
                      </div>
                      <div className="field-stepper-input">
                        <button
                          type="button"
                          className="field-step-btn"
                          aria-label={`Decrease ${f.label}`}
                          onClick={() =>
                            stepValue(f.val, f.set, -f.step, f.min, f.decimals)
                          }
                        >
                          -
                        </button>
                        <input
                          id={`field-${f.id}`}
                          type="number"
                          min={f.min}
                          max={f.id === 1 ? 24 : undefined}
                          step="any"
                          value={f.val}
                          placeholder="Unknown"
                          onChange={(e) => f.set(e.target.value)}
                        />
                        <button
                          type="button"
                          className="field-step-btn"
                          aria-label={`Increase ${f.label}`}
                          onClick={() =>
                            stepValue(f.val, f.set, f.step, f.min, f.decimals)
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Manual Blood Pressure Pair Card */}
                <div
                  className={`field-card bp-pair-card ${
                    !sys && !dia ? 'is-unknown' : ''
                  }`}
                >
                  <div className="field-card-head">
                    <label htmlFor="field-2">Blood pressure (mmHg)</label>
                    <div className="field-badge-group">
                      <span
                        className={`source-chip ${
                          !sys && !dia ? 'unknown' : 'sensor'
                        }`}
                      >
                        {!sys && !dia ? 'UNKNOWN' : 'MANUAL'}
                      </span>
                      <button
                        type="button"
                        className="unknown-option"
                        aria-pressed={!sys && !dia}
                        onClick={() => {
                          setSys('');
                          setDia('');
                        }}
                      >
                        Unknown
                      </button>
                    </div>
                  </div>
                  <div className="bp-dual-inputs">
                    <input
                      id="field-2"
                      type="number"
                      min={1}
                      step="any"
                      value={sys}
                      placeholder="Systolic"
                      aria-label="Systolic (mmHg)"
                      onChange={(e) => setSys(e.target.value)}
                    />
                    <span className="bp-slash">/</span>
                    <input
                      id="field-3"
                      type="number"
                      min={1}
                      step="any"
                      value={dia}
                      placeholder="Diastolic"
                      aria-label="Diastolic (mmHg)"
                      onChange={(e) => setDia(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}

              <div className="form-submit-row">
                <button className="ghost-rect-cta" type="submit">
                  <span>Review Check-In</span>
                  <ArrowUpRight size={18} />
                </button>
              </div>
            </form>
          )}
        </section>

        <aside className="right-frosted-sheet">
          <div className="wide-planetary-label left-aligned">
            C H E C K - I N &nbsp; S U M M A R Y
          </div>
          <h3>{crew.id} · {crew.role}</h3>
          <Observation crew={draft} />
          <div className="sheet-divider" />
          <p className="sheet-footnote">
            Missing values remain <b>Unknown</b> and are never assumed normal.
          </p>
        </aside>
      </div>
    </div>
  );
}

const inventoryCategories = [
  'Monitoring',
  'Documentation',
  'Imaging',
  'Supplies',
];

function CategoryIcon({ category }: { category: string }) {
  if (category === 'Monitoring') return <Activity size={16} />;
  if (category === 'Documentation') return <FileText size={16} />;
  if (category === 'Imaging') return <ScanLine size={16} />;
  return <Package size={16} />;
}

function MedicalInventory({
  inventory,
  setInventory,
  flags,
  setFlags,
  search,
  setSearch,
  category,
  setCategory,
}: {
  inventory: Equipment[];
  setInventory: React.Dispatch<React.SetStateAction<Equipment[]>>;
  flags: boolean[];
  setFlags: React.Dispatch<React.SetStateAction<boolean[]>>;
  search: string;
  setSearch: (s: string) => void;
  category: string;
  setCategory: (c: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'usable' | 'unavailable'>('all');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Monitoring');
  const [newQty, setNewQty] = useState('1');
  const [newAvailable, setNewAvailable] = useState(true);
  const [formError, setFormError] = useState('');

  const [editingName, setEditingName] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('Monitoring');
  const [editQty, setEditQty] = useState('1');
  const [editAvailable, setEditAvailable] = useState(true);
  const [editError, setEditError] = useState('');

  const syncBpFlag = (nextInventory: Equipment[]) => {
    const bpMonitor = nextInventory.find(
      (item) => item.name === 'Blood-pressure monitor'
    );
    setFlags((f) => [bpMonitor ? bpMonitor.available : false, f[1], f[2], f[3]]);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setFormError('Enter an item name.');
      return;
    }
    if (
      inventory.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setFormError('Item already exists.');
      return;
    }
    const qty = Math.max(0, Number(newQty) || 0);
    const next = [
      ...inventory,
      { name: trimmed, category: newCategory, quantity: qty, available: newAvailable },
    ];
    setInventory(next);
    syncBpFlag(next);
    setNewName('');
    setNewQty('1');
    setNewAvailable(true);
    setFormError('');
  };

  const startEdit = (item: Equipment) => {
    setEditingName(item.name);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditQty(String(item.quantity));
    setEditAvailable(item.available);
    setEditError('');
  };

  const handleSaveEdit = (originalName: string) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError('Name is required.');
      return;
    }
    if (
      trimmed.toLowerCase() !== originalName.toLowerCase() &&
      inventory.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setEditError('Item name already exists.');
      return;
    }
    const qty = Math.max(0, Number(editQty) || 0);
    const next = inventory.map((item) =>
      item.name === originalName
        ? {
            name: trimmed,
            category: editCategory,
            quantity: qty,
            available: editAvailable,
          }
        : item
    );
    setInventory(next);
    syncBpFlag(next);
    setEditingName(null);
    setEditError('');
  };

  const handleDelete = (name: string) => {
    const next = inventory.filter((item) => item.name !== name);
    setInventory(next);
    syncBpFlag(next);
    if (editingName === name) setEditingName(null);
  };

  const adjustQuantity = (name: string, delta: number) => {
    const next = inventory.map((item) =>
      item.name === name
        ? { ...item, quantity: Math.max(0, item.quantity + delta) }
        : item
    );
    setInventory(next);
  };

  const usableCount = inventory.filter((e) => e.available).length;
  const readinessPct = inventory.length
    ? Math.round((usableCount / inventory.length) * 100)
    : 0;

  const filtered = inventory.filter((e) => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = category === 'All' || e.category === category;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'usable' ? e.available : !e.available);
    return matchesSearch && matchesCat && matchesStatus;
  });

  return (
    <div className="space-subpage">
      <div className="asymmetric-workspace-grid">
        <section className="left-telemetry-column">
          <div className="wide-planetary-label left-aligned">
            M E D I C A L &nbsp; I N V E N T O R Y &nbsp; · &nbsp; D A Y &nbsp; 1 8 0
          </div>
          <h1 className="section-sans-headline">Onboard Medical Equipment</h1>
          <p className="telemetry-summary-copy">
            Manage onboard devices and consumables. Unavailable items are
            excluded from check routing.
          </p>

          <div className="inventory-toolbar">
            <div className="inventory-filter-top">
              <div
                className="preset-hairline-row"
                role="group"
                aria-label="Filter by category"
              >
                {['All', ...inventoryCategories].map((c) => {
                  const count =
                    c === 'All'
                      ? inventory.length
                      : inventory.filter((item) => item.category === c).length;
                  return (
                    <button
                      key={c}
                      type="button"
                      className={`hairline-pill-btn ${
                        category === c ? 'active' : ''
                      }`}
                      onClick={() => setCategory(c)}
                    >
                      {c} <span className="pill-count">{count}</span>
                    </button>
                  );
                })}
              </div>

              <div
                className="status-segment-row"
                role="group"
                aria-label="Filter by availability"
              >
                {(
                  [
                    ['all', 'All'],
                    ['usable', 'Usable'],
                    ['unavailable', 'Unavailable'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`status-seg-btn ${
                      statusFilter === key ? 'active' : ''
                    }`}
                    onClick={() => setStatusFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filters">
              <label className="search-input-wrap">
                <Search size={15} className="search-icon" aria-hidden="true" />
                <input
                  aria-label="Search equipment"
                  placeholder="Filter by equipment name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <Badge>
                {usableCount} / {inventory.length} USABLE
              </Badge>
            </div>
          </div>

          <div className="equipment-grid">
            {filtered.length === 0 ? (
              <p className="inventory-empty">No matching medical items.</p>
            ) : (
              filtered.map((e) =>
                editingName === e.name ? (
                  <div
                    className="equipment-hairline-row editing"
                    key={e.name}
                  >
                    <div className="equip-card-head">
                      <span className="micro-label">EDIT EQUIPMENT</span>
                    </div>
                    <div className="equip-edit-grid">
                      <label className="edit-field-label">
                        <span>Name</span>
                        <input
                          aria-label="Edit equipment name"
                          value={editName}
                          onChange={(ev) => setEditName(ev.target.value)}
                        />
                      </label>
                      <label className="edit-field-label">
                        <span>Category</span>
                        <select
                          aria-label="Edit equipment category"
                          value={editCategory}
                          onChange={(ev) => setEditCategory(ev.target.value)}
                        >
                          {inventoryCategories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="edit-field-label">
                        <span>Qty</span>
                        <input
                          aria-label="Edit equipment quantity"
                          type="number"
                          min={0}
                          value={editQty}
                          onChange={(ev) => setEditQty(ev.target.value)}
                        />
                      </label>
                    </div>
                    <label className="equip-check-inline">
                      <input
                        type="checkbox"
                        checked={editAvailable}
                        onChange={(ev) => setEditAvailable(ev.target.checked)}
                      />
                      <span>Usable on station</span>
                    </label>
                    {editError && (
                      <p role="alert" className="error">
                        {editError}
                      </p>
                    )}
                    <div className="equip-card-footer">
                      <button
                        type="button"
                        className="hairline-pill-btn active"
                        onClick={() => handleSaveEdit(e.name)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="hairline-pill-btn"
                        onClick={() => setEditingName(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <article
                    className={`equipment-hairline-row ${
                      e.available ? 'is-usable' : 'is-unavailable'
                    }`}
                    key={e.name}
                  >
                    <div className="equip-card-meta">
                      <span className="equip-cat-chip">
                        <CategoryIcon category={e.category} />
                        <span>{e.category}</span>
                      </span>
                      <span
                        className={`equip-status-pill ${
                          e.available ? 'usable' : 'unavailable'
                        }`}
                      >
                        {e.available ? 'Usable' : 'Unavailable'}
                      </span>
                    </div>

                    <strong className="equip-card-title">{e.name}</strong>

                    <div className="equip-card-footer">
                      <div
                        className="qty-stepper"
                        aria-label={`Quantity controls for ${e.name}`}
                      >
                        <button
                          type="button"
                          className="icon-step-btn"
                          aria-label={`Decrease quantity for ${e.name}`}
                          disabled={e.quantity <= 0}
                          onClick={() => adjustQuantity(e.name, -1)}
                        >
                          -
                        </button>
                        <span className="qty-readout">Qty {e.quantity}</span>
                        <button
                          type="button"
                          className="icon-step-btn"
                          aria-label={`Increase quantity for ${e.name}`}
                          onClick={() => adjustQuantity(e.name, 1)}
                        >
                          +
                        </button>
                      </div>

                      <div className="equip-row-actions">
                        <button
                          type="button"
                          className="equip-action-btn"
                          onClick={() => {
                            const next = inventory.map((x) =>
                              x.name === e.name
                                ? { ...x, available: !x.available }
                                : x
                            );
                            setInventory(next);
                            syncBpFlag(next);
                          }}
                        >
                          Mark {e.available ? 'Unavailable' : 'Usable'}
                        </button>
                        <button
                          type="button"
                          className="equip-icon-btn"
                          aria-label={`Edit ${e.name}`}
                          onClick={() => startEdit(e)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="equip-icon-btn danger-btn"
                          aria-label={`Delete ${e.name}`}
                          onClick={() => handleDelete(e.name)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                )
              )
            )}
          </div>
        </section>

        <aside className="right-frosted-sheet">
          <div className="wide-planetary-label left-aligned">
            E Q U I P M E N T &nbsp; R E A D I N E S S
          </div>

          <div className="readiness-meter-block">
            <div className="readiness-meter-head">
              <span>Station Readiness</span>
              <strong>{readinessPct}%</strong>
            </div>
            <div className="readiness-meter-track" aria-hidden="true">
              <div
                className="readiness-meter-fill"
                style={{ width: `${readinessPct}%` }}
              />
            </div>
          </div>

          <dl className="hairline-telemetry-list compact-list">
            <div className="telemetry-kv-row compact">
              <dt>Tracked Medical Items:</dt>
              <dd>{inventory.length} Items</dd>
            </div>
            <div className="telemetry-kv-row compact">
              <dt>Currently Usable:</dt>
              <dd>{usableCount} Available</dd>
            </div>
            <div className="telemetry-kv-row compact">
              <dt>Blood-Pressure Monitor:</dt>
              <dd className={!flags[0] ? 'unknown-val' : ''}>
                {flags[0] ? 'Available' : 'Unavailable'}
              </dd>
            </div>
          </dl>

          <div className="sheet-divider" />

          <div className="wide-planetary-label left-aligned">
            A D D &nbsp; M E D I C A L &nbsp; I T E M
          </div>
          <form className="inventory-add-form" onSubmit={handleAdd}>
            <label>
              Item Name
              <input
                aria-label="New equipment name"
                placeholder="e.g. Glucometer"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <div className="inventory-add-row">
              <label>
                Category
                <select
                  aria-label="New equipment category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                >
                  {inventoryCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quantity
                <input
                  aria-label="New equipment quantity"
                  type="number"
                  min={0}
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                />
              </label>
            </div>
            <label className="equip-check-inline">
              <input
                type="checkbox"
                checked={newAvailable}
                onChange={(e) => setNewAvailable(e.target.checked)}
              />
              <span>Usable on station</span>
            </label>
            {formError && (
              <p role="alert" className="error">
                {formError}
              </p>
            )}
            <button type="submit" className="ghost-rect-cta full-width">
              <Plus size={16} />
              <span>Add Item</span>
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

export { Panel };

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
