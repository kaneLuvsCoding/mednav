import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Check, RotateCcw, AlertCircle } from 'lucide-react';
import { symptomOptions } from '../data/fixtures';

export type ParsedVoiceCheckIn = {
  symptoms?: string[];
  clearSymptoms?: boolean;
  hr?: string | null;
  sleep?: string | null;
  sys?: string | null;
  dia?: string | null;
};

type Props = {
  onApply: (parsed: ParsedVoiceCheckIn) => void;
};

const VOICE_API_BASE = 'http://127.0.0.1:8000';

const WORD_ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};

const WORD_TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

function normalizeSpokenNumbers(raw: string): string {
  let s = raw
    .toLowerCase()
    .replace(/\bheart-rate\b/g, 'heart rate')
    .replace(/\bb\.p\.\b/g, 'bp')
    .replace(/\band a half\b/g, '.5')
    .replace(/\bslash\b/g, '/');

  // "one hundred twenty", "one twenty", "eighty-eight", "eighty eight"
  s = s.replace(
    /\b(?:(one)\s+(?:hundred\s+(?:and\s+)?)?)?(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[-\s]+(one|two|three|four|five|six|seven|eight|nine))?\b/g,
    (_, hundred, tens, ones) => {
      const val =
        (hundred ? 100 : 0) +
        WORD_TENS[tens] +
        (ones ? WORD_ONES[ones] : 0);
      return String(val);
    }
  );

  s = s.replace(
    /\b(one)\s+hundred\s+(?:and\s+)?(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/g,
    (_, _h, unit) => String(100 + WORD_ONES[unit])
  );

  s = s.replace(
    /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/g,
    (w) => String(WORD_ONES[w])
  );

  s = s.replace(/\b(\d+)\s+point\s+(\d+)\b/g, '$1.$2');
  return s;
}

export function parseTranscriptToCheckIn(text: string): ParsedVoiceCheckIn {
  const lower = normalizeSpokenNumbers(text);
  const result: ParsedVoiceCheckIn = {};

  if (/\b(no symptoms|none reported|feeling fine|no symptom)\b/.test(lower)) {
    result.clearSymptoms = true;
    result.symptoms = [];
  } else {
    const matched = symptomOptions.filter((sym) => {
      const s = sym.toLowerCase();
      if (s === 'headache') {
        return /\b(headache|head ache|headaches|migraine)\b/.test(lower);
      }
      if (s === 'dizziness') {
        return /\b(dizziness|dizzy|dizzyness|lightheaded|vertigo)\b/.test(lower);
      }
      if (s === 'fatigue') {
        return /\b(fatigue|fatigued|tired|exhausted|exhaustion)\b/.test(lower);
      }
      if (s === 'nausea') {
        return /\b(nausea|nauseous|queasy)\b/.test(lower);
      }
      if (s === 'muscle discomfort') {
        return (
          lower.includes('muscle discomfort') ||
          lower.includes('muscle ache') ||
          lower.includes('muscle pain') ||
          lower.includes('soreness') ||
          lower.includes('muscle sore')
        );
      }
      return lower.includes(s);
    });
    if (matched.length > 0) {
      result.symptoms = matched;
    }
  }

  if (/\b(heart rate|pulse|hr)\s+(is\s+)?(unknown|missing|not measured|none)\b/.test(lower)) {
    result.hr = '';
  } else {
    const hrMatch =
      lower.match(/\b(?:heart rate|pulse|hr)\s*(?:is|of|at)?\s*(\d{2,3})\b/) ||
      lower.match(/\b(\d{2,3})\s*(?:bpm|beats per minute)\b/);
    if (hrMatch) {
      result.hr = hrMatch[1];
    }
  }

  if (/\b(sleep|slept)\s+(is\s+)?(unknown|missing|not measured)\b/.test(lower)) {
    result.sleep = '';
  } else {
    const sleepMatch =
      lower.match(
        /\b(?:sleep|slept|sleep duration)\s*(?:is|of|for|was)?\s*(\d{1,2}(?:\.\d+)?)\s*(?:hours|hrs|hour|h)?\b/
      ) ||
      lower.match(/\b(\d{1,2}(?:\.\d+)?)\s*(?:hours|hrs)\s*(?:of\s+sleep)?\b/);
    if (sleepMatch) {
      const val = Number(sleepMatch[1]);
      if (val >= 0 && val <= 24) {
        result.sleep = sleepMatch[1];
      }
    }
  }

  if (
    /\b(blood pressure|bp)\s+(is\s+)?(unknown|missing|not measured|unavailable)\b/.test(
      lower
    )
  ) {
    result.sys = '';
    result.dia = '';
  } else {
    const bpPair =
      lower.match(
        /\b(?:blood pressure|bp)?\s*(?:is|of|at)?\s*(\d{2,3})\s*(?:over|\/|by)\s*(\d{2,3})\b/
      ) ||
      lower.match(
        /\bsystolic\s*(?:is|of)?\s*(\d{2,3}).*?\bdiastolic\s*(?:is|of)?\s*(\d{2,3})\b/
      );
    if (bpPair) {
      result.sys = bpPair[1];
      result.dia = bpPair[2];
    }
  }

  return result;
}

function encodeWav16kMono(samples: Float32Array, sampleRate = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function VoiceCheckIn({ onApply }: Props) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopRecordingCleanup();
    };
  }, []);

  const stopRecordingCleanup = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  const startRecording = async () => {
    setError('');
    setApplied(false);
    chunksRef.current = [];
    setSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx({ sampleRate: 16000 });
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(input));
      };

      source.connect(processor);
      const silentGain = ctx.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(ctx.destination);

      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setError('Microphone unavailable. Please use the form below.');
    }
  };

  const stopAndTranscribe = async () => {
    setRecording(false);
    const actualSampleRate = audioCtxRef.current?.sampleRate ?? 16000;
    stopRecordingCleanup();

    const totalLen = chunksRef.current.reduce((acc, c) => acc + c.length, 0);
    if (totalLen < 1600) {
      setError('Hold or speak for at least 1 second.');
      return;
    }

    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const chunk of chunksRef.current) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const wavBlob = encodeWav16kMono(merged, actualSampleRate);
    await sendAudioToWhisper(wavBlob);
  };

  const sendAudioToWhisper = async (wavBlob: Blob) => {
    setTranscribing(true);
    setError('');
    try {
      const res = await fetch(`${VOICE_API_BASE}/api/v1/voice/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: wavBlob,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { text: string };
      setTranscript(data.text || 'No speech detected.');
    } catch {
      setError('Voice service unavailable.');
    } finally {
      setTranscribing(false);
    }
  };

  const parsed = transcript ? parseTranscriptToCheckIn(transcript) : {};
  const hasExtracted =
    (parsed.symptoms && parsed.symptoms.length > 0) ||
    parsed.clearSymptoms ||
    parsed.hr !== undefined ||
    parsed.sleep !== undefined ||
    parsed.sys !== undefined;

  return (
    <div className="voice-checkin-box" role="region" aria-label="Voice check-in">
      <div className="voice-controls-row">
        <div>
          <strong>Voice Check-In</strong>
          <p className="voice-hint">
            Speak symptoms, heart rate, sleep, or blood pressure.
          </p>
        </div>

        {!recording ? (
          <button
            type="button"
            className="primary"
            onClick={startRecording}
            disabled={transcribing}
          >
            <Mic size={16} />
            {transcribing ? 'Transcribing…' : 'Record Voice'}
          </button>
        ) : (
          <button
            type="button"
            className="voice-stop-btn"
            onClick={stopAndTranscribe}
          >
            <Square size={15} />
            Stop ({seconds}s)
          </button>
        )}
      </div>

      {error && (
        <div className="voice-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {transcript && (
        <div className="voice-transcript-review">
          <input
            aria-label="Voice transcript"
            value={transcript}
            onChange={(e) => {
              setTranscript(e.target.value);
              setApplied(false);
            }}
          />

          <div className="extracted-tags">
            {parsed.clearSymptoms && (
              <span className="ext-tag">Symptoms: None</span>
            )}
            {parsed.symptoms && parsed.symptoms.length > 0 && (
              <span className="ext-tag">
                Symptoms: {parsed.symptoms.join(', ')}
              </span>
            )}
            {parsed.hr !== undefined && (
              <span className={`ext-tag ${parsed.hr === '' ? 'amber' : ''}`}>
                HR: {parsed.hr === '' ? 'Unknown' : `${parsed.hr} bpm`}
              </span>
            )}
            {parsed.sleep !== undefined && (
              <span className={`ext-tag ${parsed.sleep === '' ? 'amber' : ''}`}>
                Sleep: {parsed.sleep === '' ? 'Unknown' : `${parsed.sleep} hrs`}
              </span>
            )}
            {parsed.sys !== undefined && (
              <span className={`ext-tag ${parsed.sys === '' ? 'amber' : ''}`}>
                BP: {parsed.sys === '' ? 'Unknown' : `${parsed.sys}/${parsed.dia}`}
              </span>
            )}
          </div>

          <div className="voice-confirm-actions">
            <button
              type="button"
              className="primary"
              disabled={!hasExtracted}
              onClick={() => {
                onApply(parsed);
                setApplied(true);
              }}
            >
              <Check size={16} />
              {applied ? 'Applied' : 'Apply to Form'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setTranscript('');
                setApplied(false);
                setError('');
              }}
            >
              <RotateCcw size={14} /> Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
