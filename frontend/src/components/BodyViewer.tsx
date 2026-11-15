import { useEffect, useRef, useState } from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  FREQUENT_PARTS,
  MODES,
  formatPartKey,
  type AnatomyLayerMode,
  type AnatomyModelStatus,
  type AnatomySex,
} from '../data/anatomy';
import {
  mountAnatomy,
  type AnatomyController,
} from '../three/anatomyScene';

type BodyViewerProps = {
  selectedPart: string;
  setSelectedPart: (part: string) => void;
  layerMode: AnatomyLayerMode;
  setLayerMode: (mode: AnatomyLayerMode) => void;
  autoRotate: boolean;
  setAutoRotate: (rotate: boolean) => void;
  sex: AnatomySex;
  setSex: (sex: AnatomySex) => void;
  modelStatus: AnatomyModelStatus;
  setModelStatus: (status: AnatomyModelStatus) => void;
};

export function BodyViewer({
  selectedPart,
  setSelectedPart,
  layerMode,
  setLayerMode,
  autoRotate,
  setAutoRotate,
  sex,
  setSex,
  modelStatus,
  setModelStatus,
}: BodyViewerProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<AnatomyController | null>(null);
  const [hoverName, setHoverName] = useState('');

  useEffect(() => {
    if (!canvasRef.current) return;
    const stage = mountAnatomy(canvasRef.current, {
      onSelect: setSelectedPart,
      onStatus: setModelStatus,
      onHover: setHoverName,
      initialSex: sex,
    });
    stageRef.current = stage;
    stage.setMode(layerMode);
    stage.setAutoRotate(autoRotate);
    stage.setActive(selectedPart);
    return () => {
      stage.dispose();
      stageRef.current = null;
    };
    // mount once; later props are forwarded by effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    stageRef.current?.setMode(layerMode);
  }, [layerMode]);

  useEffect(() => {
    stageRef.current?.setActive(selectedPart);
  }, [selectedPart]);

  useEffect(() => {
    stageRef.current?.setAutoRotate(autoRotate);
  }, [autoRotate]);

  // mountAnatomy already starts the initial model; only switch on subsequent updates.
  const firstSexRef = useRef(true);
  useEffect(() => {
    if (firstSexRef.current) {
      firstSexRef.current = false;
      return;
    }
    void stageRef.current?.setSex(sex);
  }, [sex]);

  return (
    <section
      className="body-stage"
      aria-label="Interactive 3D anatomy explorer"
    >
      <div className="stage-stars" aria-hidden="true" />
      <div className="stage-halo" aria-hidden="true" />

      <div className="stage-head">
        <div>
          <div className="wide-planetary-label left-aligned">
            A N A T O M Y &nbsp; T E L E M E T R Y
          </div>
          <h2>
            Crew Anatomy <span className="beta">3D</span>
          </h2>
        </div>

        <div className="live-demo">
          {modelStatus === 'detailed'
            ? '3D ACTIVE'
            : modelStatus === 'loading'
            ? 'LOADING'
            : 'SCHEMATIC'}
        </div>
      </div>

      <div className="mode-controls" role="group" aria-label="Anatomy layers">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`mode-btn ${layerMode === m.id ? 'active' : ''}`}
            onClick={() => setLayerMode(m.id)}
          >
            {m.name}
          </button>
        ))}
      </div>

      <div className="body-canvas" ref={canvasRef} />

      <div className="side-axis" aria-hidden="true">
        <span>H</span>
        <div />
        <span>F</span>
      </div>

      <div className="floating-label floating-label-top">
        <span className="crosshair">+</span> NEURAL / MUSCULOSKELETAL
      </div>
      <div className="floating-label floating-label-mid">
        <span className="crosshair">+</span> RADIATION &amp; MICROGRAVITY
      </div>

      {hoverName && (
        <div className="hover-part">
          <ScanLine size={14} />
          {hoverName}
        </div>
      )}

      <div className="viewer-tools" aria-label="3D controls">
        <button
          type="button"
          title="Zoom in"
          aria-label="Zoom in"
          onClick={() => stageRef.current?.zoom(0.84)}
        >
          <ZoomIn size={18} />
        </button>
        <button
          type="button"
          title="Zoom out"
          aria-label="Zoom out"
          onClick={() => stageRef.current?.zoom(1.18)}
        >
          <ZoomOut size={18} />
        </button>
        <button
          type="button"
          title="Reset camera"
          aria-label="Reset camera"
          onClick={() => stageRef.current?.reset()}
        >
          <RotateCcw size={18} />
        </button>
        <button
          type="button"
          title={autoRotate ? 'Pause rotation' : 'Auto rotate'}
          aria-label={autoRotate ? 'Pause rotation' : 'Auto rotate'}
          className={autoRotate ? 'tool-active' : ''}
          onClick={() => setAutoRotate(!autoRotate)}
        >
          {autoRotate ? <Pause size={18} /> : <Play size={18} />}
        </button>
      </div>

      <div className="model-person">
        <span>MODEL</span>
        <div className="sex-select">
          <button
            type="button"
            className={sex === 'male' ? 'sex-on' : ''}
            onClick={() => setSex('male')}
          >
            M
          </button>
          <button
            type="button"
            className={sex === 'female' ? 'sex-on' : ''}
            onClick={() => setSex('female')}
          >
            F
          </button>
        </div>
      </div>

      <div className="stage-bottom">
        <div className="quick-parts">
          {FREQUENT_PARTS.map((key) => (
            <button
              key={key}
              type="button"
              className={selectedPart === key ? 'quick-active' : ''}
              onClick={() => {
                setSelectedPart(key);
                if (layerMode === 'surface') {
                  setLayerMode(
                    key === 'spine' || key === 'femur_l' ? 'skeleton' : 'organs'
                  );
                } else if (
                  (key === 'spine' || key === 'femur_l') &&
                  layerMode === 'organs'
                ) {
                  setLayerMode('skeleton');
                }
              }}
            >
              {formatPartKey(key)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
