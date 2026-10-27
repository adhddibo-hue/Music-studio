import React, { useEffect, useMemo, useRef, useState } from 'react';

const STEPS = 16;
const DRUMS = [
  { id: 'kick', label: 'KICK', color: '#ffdd57' },
  { id: 'snare', label: 'SNARE', color: '#ff8a5b' },
  { id: 'hat', label: 'HAT', color: '#73e4ff' },
  { id: 'clap', label: 'CLAP', color: '#ff6ccf' },
  { id: 'perc', label: 'PERC', color: '#7af6b5' },
];

const NOTES = [
  { name: 'C3', freq: 130.81 },
  { name: 'D3', freq: 146.83 },
  { name: 'E3', freq: 164.81 },
  { name: 'G3', freq: 196.0 },
  { name: 'A3', freq: 220.0 },
  { name: 'B3', freq: 246.94 },
  { name: 'C4', freq: 261.63 },
  { name: 'D4', freq: 293.66 },
  { name: 'E4', freq: 329.63 },
  { name: 'G4', freq: 392.0 },
  { name: 'A4', freq: 440.0 },
  { name: 'B4', freq: 493.88 },
];

const PRESETS = {
  'Neon Bounce': [
    [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0],
  ],
  'Night Drive': [
    [1,0,0,0,0,0,1,0,1,0,0,1,0,0,1,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,1,0,1,0,0,1,1,0,1,0,1,0,0,1],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
  ],
  'Warehouse': [
    [1,0,0,1,0,0,0,1,1,0,0,1,0,0,1,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],
  ],
};

function makeEmptyDrumGrid(length = STEPS) {
  return DRUMS.map(() => Array.from({ length }, () => false));
}

function makeEmptySynthGrid(length = STEPS) {
  return NOTES.map(() => Array.from({ length }, () => false));
}

function makePatternFromPreset(name) {
  const preset = PRESETS[name] || PRESETS['Neon Bounce'];
  return DRUMS.map((_, row) => Array.from({ length: STEPS }, (_, step) => !!preset[row]?.[step]));
}

function StudioMark({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 160 160" aria-hidden="true">
      <circle className="mark-orbit-outer" cx="80" cy="80" r="62" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle className="mark-orbit-inner" cx="80" cy="80" r="48" fill="none" stroke="currentColor" strokeWidth="1" />
      <path className="mark-monogram" d="M42 116V44h20l36 54V44h20v72H98L62 62v54H42Z" fill="currentColor" stroke="none" />
      <path d="M42 116V44h20l36 54V44h20v72H98L62 62v54H42Z" fill="none" stroke="#fff3f9" strokeWidth="1.5" opacity=".25" />
    </svg>
  );
}

function createSeedMelody() {
  const melody = makeEmptySynthGrid();
  const pattern = [0, 3, 5, 7, 10, 7, 5, 3, 0, 3, 5, 7, 9, 7, 5, 3];
  pattern.forEach((noteIndex, step) => {
    melody[noteIndex % NOTES.length][step] = true;
  });
  return melody;
}

function App() {
  const [projectName, setProjectName] = useState('Midnight Session');
  const [bpm, setBpm] = useState(118);
  const [swing, setSwing] = useState(14);
  const [master, setMaster] = useState(78);
  const [bars, setBars] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState('Neon Bounce');
  const [grid, setGrid] = useState(() => makePatternFromPreset('Neon Bounce'));
  const [synthGrid, setSynthGrid] = useState(() => createSeedMelody());
  const [recordings, setRecordings] = useState([]);
  const [recording, setRecording] = useState(false);
  const [recordingError, setRecordingError] = useState('');
  const [toast, setToast] = useState('');
  const [mixer, setMixer] = useState([80, 72, 68, 74, 76]);
  const [muteState, setMuteState] = useState([]);
  const [metronome, setMetronome] = useState(true);
  const [activeNotes, setActiveNotes] = useState([]);
  const [showIntro, setShowIntro] = useState(true);
  const [introClosing, setIntroClosing] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileName, setProfileName] = useState('Midnight Artist');

  const audioRef = useRef(null);
  const stepRef = useRef(0);
  const intervalRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const bufferMapRef = useRef(new Map());
  const clipSourcesRef = useRef([]);

  const totalSteps = bars * STEPS;
  const stepDuration = (60 / bpm) * 1000 / 4;

  const changeBars = (nextBars) => {
    const nextSteps = nextBars * STEPS;
    setBars(nextBars);
    setGrid((prev) => prev.map((row) => Array.from({ length: nextSteps }, (_, step) => Boolean(row[step]))));
    setSynthGrid((prev) => prev.map((row) => Array.from({ length: nextSteps }, (_, step) => Boolean(row[step]))));
    stepRef.current = 0;
    setCurrentStep(0);
  };

  const ensureAudio = () => {
    if (!audioRef.current) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) throw new Error('Web Audio is not available in this browser.');
      audioRef.current = new AudioCtor();
    }
    if (audioRef.current.state === 'suspended') {
      audioRef.current.resume();
    }
    return audioRef.current;
  };

  const notify = (message) => {
    setToast(message);
    window.clearTimeout(notify.timeoutId);
    notify.timeoutId = window.setTimeout(() => setToast(''), 1800);
  };

  const clampStep = (value) => Math.max(0, Math.min(totalSteps - 1, value));

  const playTone = (frequency, duration = 0.22, gainValue = 0.15, type = 'triangle') => {
    const ctx = ensureAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    filter.type = 'lowpass';
    filter.frequency.value = type === 'sawtooth' ? 2200 : 1800;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(gainValue, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  };

  const triggerKick = () => {
    const ctx = ensureAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(42, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  };

  const triggerSnare = () => {
    const ctx = ensureAudio();
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
    const channelData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i += 1) {
      channelData[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = 1800;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + 0.2);
  };

  const triggerHat = () => {
    const ctx = ensureAudio();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + 0.09);
  };

  const triggerClap = () => {
    const ctx = ensureAudio();
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(420, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  };

  const triggerPerc = () => {
    playTone(180, 0.15, 0.1, 'sawtooth');
  };

  const playDrum = (drumIndex) => {
    const list = [triggerKick, triggerSnare, triggerHat, triggerClap, triggerPerc];
    list[drumIndex]?.();
  };

  const toggleCell = (rowIndex, stepIndex) => {
    setGrid((prev) => prev.map((row, rowPos) => {
      if (rowPos !== rowIndex) return row;
      return row.map((cell, cellIndex) => (cellIndex === stepIndex ? !cell : cell));
    }));
  };

  const toggleSynthCell = (noteIndex, stepIndex) => {
    setSynthGrid((prev) => prev.map((row, rowPos) => {
      if (rowPos !== noteIndex) return row;
      return row.map((cell, cellIndex) => (cellIndex === stepIndex ? !cell : cell));
    }));
  };

  const applyPreset = (name) => {
    setSelectedPreset(name);
    setGrid(makePatternFromPreset(name));
    notify(`${name} loaded`);
  };

  const randomizePattern = () => {
    const next = DRUMS.map((_, rowIndex) => Array.from({ length: totalSteps }, (_, stepIndex) => {
      if (rowIndex === 0) return stepIndex % 4 === 0 && Math.random() > 0.28;
      if (rowIndex === 1) return stepIndex % 4 === 2 && Math.random() > 0.38;
      if (rowIndex === 2) return Math.random() > 0.55;
      if (rowIndex === 3) return stepIndex % 8 === 4 && Math.random() > 0.55;
      return Math.random() > 0.75;
    }));
    setGrid(next);
    notify('Random groove generated');
  };

  const clearPattern = () => {
    setGrid(makeEmptyDrumGrid(totalSteps));
    setSynthGrid(makeEmptySynthGrid(totalSteps));
    notify('Pattern cleared');
  };

  const generateMelody = () => {
    const pattern = [0, 3, 5, 7, 3, 5, 8, 7, 5, 3, 6, 8, 10, 7, 5, 3];
    const next = makeEmptySynthGrid(totalSteps);
    pattern.forEach((noteIndex, step) => {
      const target = noteIndex % NOTES.length;
      next[target][step] = true;
    });
    setSynthGrid(next);
    notify('New melodic sequence generated');
  };

  const setVolumeForTrack = (trackIndex, value) => {
    setMixer((prev) => prev.map((entry, index) => (index === trackIndex ? value : entry)));
  };

  const toggleMute = (trackIndex) => {
    setMuteState((prev) =>
      prev.includes(trackIndex) ? prev.filter((entry) => entry !== trackIndex) : [...prev, trackIndex]
    );
  };

  const tick = () => {
    const step = stepRef.current;
    const effectiveStep = step % totalSteps;
    setCurrentStep(effectiveStep);

    if (metronome && effectiveStep % 4 === 0) {
      const ctx = ensureAudio();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(effectiveStep === 0 ? 900 : 560, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    }

    DRUMS.forEach((_, drumIndex) => {
      if (!muteState.includes(drumIndex) && grid[drumIndex][effectiveStep]) {
        playDrum(drumIndex);
      }
    });

    NOTES.forEach((note, noteIndex) => {
      if (synthGrid[noteIndex][effectiveStep]) {
        const voiceGain = noteIndex % 2 === 0 ? 0.12 : 0.09;
        playTone(note.freq, 0.24, voiceGain, noteIndex % 3 === 0 ? 'sawtooth' : 'triangle');
        setActiveNotes((prev) => [...prev.filter((entry) => entry !== note.name), note.name]);
        window.clearTimeout(activeNotes.timeoutId);
        activeNotes.timeoutId = window.setTimeout(() => setActiveNotes((items) => items.filter((entry) => entry !== note.name)), 180);
      }
    });

    stepRef.current = (effectiveStep + 1) % totalSteps;
  };

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return undefined;
    }

    const swingBoost = swing > 0 ? (swing / 100) * stepDuration * 0.8 : 0;
    intervalRef.current = window.setInterval(tick, stepDuration + swingBoost);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [playing, bpm, swing, grid, synthGrid, bars, muteState, metronome]);

  useEffect(() => {
    const project = {
      projectName,
      bpm,
      swing,
      master,
      bars,
      grid,
      synthGrid,
      mixer,
      muteState,
      recordings,
    };
    localStorage.setItem('nightshift-project', JSON.stringify(project));
  }, [projectName, bpm, swing, master, bars, grid, synthGrid, mixer, muteState, recordings]);

  useEffect(() => {
    const existing = localStorage.getItem('nightshift-project');
    if (!existing) return;
    try {
      const data = JSON.parse(existing);
      if (data.projectName) setProjectName(data.projectName);
      if (data.bpm) setBpm(data.bpm);
      if (data.swing !== undefined) setSwing(data.swing);
      if (data.master) setMaster(data.master);
      if (data.bars) setBars(data.bars);
      if (Array.isArray(data.grid) && data.grid.length === DRUMS.length) setGrid(data.grid);
      if (Array.isArray(data.synthGrid) && data.synthGrid.length === NOTES.length) setSynthGrid(data.synthGrid);
      if (Array.isArray(data.mixer)) setMixer(data.mixer);
      if (Array.isArray(data.muteState)) setMuteState(data.muteState);
      if (Array.isArray(data.recordings)) setRecordings(data.recordings);
    } catch (error) {
      console.error('Could not restore previous project.', error);
    }
  }, []);

  const startRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      setRecordingError('');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const audioUrl = URL.createObjectURL(blob);
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        const item = {
          id: String(Date.now()),
          name: `Take ${recordings.length + 1}`,
          url: audioUrl,
          dataUrl,
          step: stepRef.current,
        };
        setRecordings((prev) => [...prev, item]);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.onerror = () => {
        setRecordingError('Recording failed. Check microphone permission and try again.');
        setRecording(false);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingError('');
      notify('Recording started');
    } catch (error) {
      setRecordingError('Microphone access is required for live recording.');
      console.error(error);
    }
  };

  const saveProject = () => {
    const fileName = `${projectName.trim().toLowerCase().replace(/\s+/g, '-') || 'midnight-session'}.json`;
    const payload = JSON.stringify({
      projectName,
      bpm,
      swing,
      master,
      bars,
      grid,
      synthGrid,
      mixer,
      muteState,
      recordings,
    }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    notify('Project saved as JSON');
  };

  const importProject = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.projectName) setProjectName(data.projectName);
      if (data.bpm) setBpm(data.bpm);
      if (data.swing !== undefined) setSwing(data.swing);
      if (data.master) setMaster(data.master);
      if (data.bars) setBars(data.bars);
      if (Array.isArray(data.grid) && data.grid.length === DRUMS.length) setGrid(data.grid);
      if (Array.isArray(data.synthGrid) && data.synthGrid.length === NOTES.length) setSynthGrid(data.synthGrid);
      if (Array.isArray(data.mixer)) setMixer(data.mixer);
      if (Array.isArray(data.muteState)) setMuteState(data.muteState);
      if (Array.isArray(data.recordings)) setRecordings(data.recordings);
      notify('Project imported');
    } catch (error) {
      setRecordingError('Could not import that project file.');
      console.error(error);
    } finally {
      event.target.value = '';
    }
  };

  const exportWav = () => {
    const sampleRate = 44100;
    const durationSeconds = (60 / bpm) * 4 * bars;
    const totalSamples = Math.floor(sampleRate * durationSeconds);
    const mixed = new Float32Array(totalSamples);

    const addSilence = (start, amount) => {
      for (let i = 0; i < amount; i += 1) {
        mixed[start + i] = mixed[start + i] || 0;
      }
    };

    const renderTone = (startSample, frequency, duration, volume, type = 'triangle') => {
      const sampleCount = Math.min(totalSamples - startSample, Math.floor(sampleRate * duration));
      for (let i = 0; i < sampleCount; i += 1) {
        const t = i / sampleRate;
        const sin = Math.sin(2 * Math.PI * frequency * t);
        const saw = 2 * (t * frequency - Math.floor(t * frequency + 0.5));
        const wave = type === 'sawtooth' ? saw : sin;
        const envelope = Math.exp(-8 * t);
        mixed[startSample + i] += wave * envelope * volume;
      }
    };

    const renderNoise = (startSample, duration, volume) => {
      const sampleCount = Math.min(totalSamples - startSample, Math.floor(sampleRate * duration));
      for (let i = 0; i < sampleCount; i += 1) {
        const envelope = 1 - i / sampleCount;
        mixed[startSample + i] += (Math.random() * 2 - 1) * envelope * volume;
      }
    };

    for (let step = 0; step < totalSteps; step += 1) {
      const offset = Math.floor((step / STEPS) * bars * sampleRate * (60 / bpm) * 4);
      const start = Math.floor((step / totalSteps) * totalSamples);
      const stepTune = step * (60 / bpm) * 4;
      const stepStart = Math.floor(stepTune * sampleRate);

      DRUMS.forEach((drum, drumIndex) => {
        if (!grid[drumIndex][step] || muteState.includes(drumIndex)) return;
        if (drum.id === 'kick') {
          renderTone(stepStart, 56, 0.25, 0.8, 'sine');
        }
        if (drum.id === 'snare') {
          renderNoise(stepStart, 0.14, 0.45);
        }
        if (drum.id === 'hat') {
          renderNoise(stepStart, 0.08, 0.18);
        }
        if (drum.id === 'clap') {
          renderTone(stepStart, 260, 0.1, 0.16, 'square');
        }
        if (drum.id === 'perc') {
          renderTone(stepStart, 180, 0.12, 0.12, 'sawtooth');
        }
      });

      NOTES.forEach((note, noteIndex) => {
        if (!synthGrid[noteIndex][step]) return;
        renderTone(stepStart, note.freq, 0.3, 0.12, noteIndex % 3 === 0 ? 'sawtooth' : 'triangle');
      });
    }

    recordings.forEach((clip) => {
      const buffer = bufferMapRef.current.get(clip.id);
      if (!buffer) return;
      const startSample = Math.floor((clip.step / STEPS) * sampleRate * (60 / bpm) * 4 * bars);
      const clipLength = Math.min(buffer.length, totalSamples - startSample);
      for (let i = 0; i < clipLength; i += 1) {
        const sourceIndex = Math.floor(i * (buffer.length / clipLength));
        const value = buffer[sourceIndex] || 0;
        mixed[startSample + i] += value * 0.7;
      }
    });

    const wavBuffer = new ArrayBuffer(44 + mixed.length * 2);
    const view = new DataView(wavBuffer);
    const writeString = (offset, text) => {
      for (let i = 0; i < text.length; i += 1) {
        view.setUint8(offset + i, text.charCodeAt(i));
      }
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + mixed.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, mixed.length * 2, true);

    let offset = 44;
    for (let i = 0; i < mixed.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, mixed[i] * (master / 100)));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }

    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName.trim().toLowerCase().replace(/\s+/g, '-') || 'nightshift-session'}-mix.wav`;
    link.click();
    URL.revokeObjectURL(url);
    notify('WAV export created');
  };

  useEffect(() => {
    const handler = (event) => {
      if (event.key.toLowerCase() === ' ') {
        event.preventDefault();
        setPlaying((state) => !state);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const stepLabels = useMemo(
    () => Array.from({ length: totalSteps }, (_, index) => ((index + 1) % 4 === 0 ? '•' : String(index + 1).padStart(2, '0'))),
    [totalSteps]
  );

  const closeIntro = () => {
    if (introClosing) return;
    setIntroClosing(true);
    window.setTimeout(() => { setShowIntro(false); setIntroClosing(false); }, 500);
  };

  return (
    <div className="studio-shell">
      {showIntro ? (
        <div className={`intro-screen ${introClosing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-label="Nightshift Studio logo">
          <div className="intro-grain" />
          <div className="intro-blueprint" aria-hidden="true">
            <span className="blueprint-ring ring-one" /><span className="blueprint-ring ring-two" /><span className="blueprint-ring ring-three" />
            <span className="blueprint-sweep" /><span className="blueprint-orbit orbit-wide" /><span className="blueprint-orbit orbit-tall" />
            <span className="blueprint-cross cross-one" /><span className="blueprint-cross cross-two" />
            <span className="blueprint-label label-top">NS-001 / AUDIO SYSTEMS</span>
            <span className="blueprint-label label-bottom">NIGHT FREQUENCY · 44.1 KHZ</span>
          </div>
          <div className="intro-content">
            <div className="intro-brand-lockup">
              <div className="intro-mark-wrap"><span className="intro-mark-aura" /><StudioMark className="intro-mark-svg" /></div>
              <span className="intro-kicker">GENEB PRODUCTIONS · VERSION 6.3</span>
              <h1>NIGHTSHIFT <span>STUDIO</span></h1>
              <p className="intro-tagline">Build beats. Shape ideas. Make sound.</p>
            </div>
            <div className="intro-equalizer" aria-hidden="true">
              {Array.from({ length: 42 }, (_, index) => <i key={index} style={{ '--bar-index': index, '--bar-height': `${14 + ((index * 17 + index * index * 3) % 64)}%` }} />)}
            </div>
            <div className="intro-loading">
              <div className="intro-loading-copy"><span>PREPARING YOUR SOUND SPACE</span><span>READY WHEN YOU ARE</span></div>
              <div className="intro-progress"><span /></div>
              <div className="intro-footer"><span>DRUMS · KEYS · IDEAS</span><button onClick={closeIntro}>ENTER STUDIO <svg className="footer-arrow-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13 13 3M5 3h8v8" /></svg></button></div>
            </div>
          </div>
        </div>
      ) : null}

      <header className="topbar">
        <div className="branding">
          <div className="brand-badge"><StudioMark className="brand-mark-svg" /></div>
          <div>
            <div className="brand-kicker">Nightshift</div>
            <strong>STUDIO</strong>
          </div>
        </div>

        <input
          className="project-name"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          aria-label="Project name"
        />

        <div className="actions">
          <button onClick={saveProject}>SAVE</button>
          <button onClick={() => fileInputRef.current?.click()}>IMPORT</button>
          <button className="primary" onClick={exportWav}>EXPORT WAV</button>
          <button className="profile-button account-badge" onClick={() => setShowProfile((state) => !state)} aria-label="Open profile">
            {profileName}
          </button>
          {showProfile ? (
            <div className="profile-menu">
              <div className="profile-heading">
                <span className="profile-avatar large">M</span>
                <div><strong>{profileName}</strong><small>Producer profile</small></div>
              </div>
              <label>
                <span>DISPLAY NAME</span>
                <input value={profileName} onChange={(event) => setProfileName(event.target.value)} />
              </label>
              <button onClick={() => { setShowIntro(true); setShowProfile(false); }}>SHOW INTRO</button>
              <button onClick={() => setShowProfile(false)}>CLOSE PROFILE</button>
            </div>
          ) : null}
          <input ref={fileInputRef} type="file" accept=".json,application/json" hidden onChange={importProject} />
        </div>
      </header>

      <main className="app-grid">
        <section className="panel transport-panel">
          <div className="panel-head">
            <div>
              <span className="index">01</span>
              <strong>TRANSPORT</strong>
            </div>
          </div>

          <div className="transport-strip">
            <button className="play-toggle" onClick={() => setPlaying((state) => !state)}>
              {playing ? '■' : '▶'}
            </button>
            <button className="mini-button" onClick={() => { setPlaying(false); stepRef.current = 0; setCurrentStep(0); }}>STOP</button>

            <label className="tempo-box">
              <span>TEMPO</span>
              <input type="number" min="60" max="180" value={bpm} onChange={(event) => setBpm(Number(event.target.value) || 118)} />
            </label>

            <label className="tempo-box">
              <span>SWING</span>
              <input type="range" min="0" max="35" value={swing} onChange={(event) => setSwing(Number(event.target.value))} />
            </label>

            <label className="tempo-box small">
              <span>BARS</span>
              <select value={bars} onChange={(event) => changeBars(Number(event.target.value))}>
                {[2, 4, 8, 16, 32].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <div className="transport-time">{String(Math.floor(currentStep / 4) + 1).padStart(2, '0')} : {String((currentStep % 4) + 1).padStart(2, '0')}</div>
            <button className={`metro-button ${metronome ? 'on' : ''}`} onClick={() => setMetronome((state) => !state)}>CLK</button>
          </div>
        </section>

        <section className="panel drum-panel">
          <div className="panel-head">
            <div>
              <span className="index">02</span>
              <strong>DRUM GRID</strong>
            </div>
            <div className="panel-tools">
              <select value={selectedPreset} onChange={(event) => applyPreset(event.target.value)}>
                {Object.keys(PRESETS).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <button className="mini-button" onClick={randomizePattern}>RANDOM</button>
              <button className="mini-button" onClick={clearPattern}>CLEAR</button>
            </div>
          </div>

          <div className="sequencer-wrap">
            <div className="drum-labels">
              {DRUMS.map((drum, index) => (
                <div className="drum-row" key={drum.id}>
                  <button className="row-preview" onClick={() => playDrum(index)} style={{ color: drum.color }}>
                    ▶
                  </button>
                  <div className="drum-meta">
                    <strong>{drum.label}</strong>
                    <small>{drum.id.toUpperCase()}</small>
                  </div>
                  <button className="mute-btn" onClick={() => toggleMute(index)}>
                    {muteState.includes(index) ? 'M' : 'S'}
                  </button>
                </div>
              ))}
            </div>

            <div className="grid-scroll">
              <div className="drum-grid" style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(28px, 1fr))` }}>
                {stepLabels.map((label, stepIndex) => (
                  <div key={`label-${stepIndex}`} className={`grid-number ${stepIndex % 4 === 0 ? 'accent' : ''}`}>
                    {label}
                  </div>
                ))}

                {DRUMS.map((drum, rowIndex) => (
                  <React.Fragment key={drum.id}>
                    {Array.from({ length: totalSteps }, (_, stepIndex) => (
                      <button
                        key={`${drum.id}-${stepIndex}`}
                        className={`cell ${grid[rowIndex][stepIndex] ? 'active' : ''} ${currentStep === stepIndex ? 'current' : ''}`}
                        onClick={() => toggleCell(rowIndex, stepIndex)}
                        style={{ '--cell-color': drum.color }}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="panel synth-panel">
          <div className="panel-head">
            <div>
              <span className="index">03</span>
              <strong>MELODY</strong>
            </div>
            <div className="panel-tools">
              <button className="mini-button" onClick={generateMelody}>GENERATE</button>
            </div>
          </div>

          <div className="piano-strip">
            {NOTES.map((note, noteIndex) => (
              <button
                key={note.name}
                className={`piano-key ${activeNotes.includes(note.name) ? 'active' : ''}`}
                onClick={() => playTone(note.freq, 0.23, 0.14, 'triangle')}
              >
                {note.name}
              </button>
            ))}
          </div>

          <div className="melody-grid-wrap">
            <div className="melody-grid" style={{ gridTemplateColumns: `92px repeat(${totalSteps}, minmax(30px, 1fr))` }}>
              <div className="grid-header blank">NOTE</div>
              {stepLabels.map((label, stepIndex) => (
                <div key={`melody-label-${stepIndex}`} className={`grid-number ${stepIndex % 4 === 0 ? 'accent' : ''}`}>
                  {label}
                </div>
              ))}

              {NOTES.map((note, noteIndex) => (
                <React.Fragment key={note.name}>
                  <div className="note-name">{note.name}</div>
                  {Array.from({ length: totalSteps }, (_, stepIndex) => (
                    <button
                      key={`${note.name}-${stepIndex}`}
                      className={`cell melody ${synthGrid[noteIndex][stepIndex] ? 'active' : ''} ${currentStep === stepIndex ? 'current' : ''}`}
                      onClick={() => toggleSynthCell(noteIndex, stepIndex)}
                    />
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        <section className="panel record-panel">
          <div className="panel-head">
            <div>
              <span className="index">04</span>
              <strong>VOICE / RECORD</strong>
            </div>
          </div>

          <div className="recorder-bar">
            <button className={`record-button ${recording ? 'recording' : ''}`} onClick={startRecording}>
              {recording ? 'STOP' : 'RECORD'}
            </button>
            <div className="live-meter"><span /></div>
          </div>

          {recordingError ? <div className="record-error">{recordingError}</div> : null}

          <div className="take-list">
            {recordings.length === 0 ? (
              <div className="empty-state">No takes yet. Press record and capture your vocal or instrument.</div>
            ) : (
              recordings.map((clip) => (
                <div key={clip.id} className="take-card">
                  <button className="row-preview" onClick={() => new Audio(clip.url).play()}>▶</button>
                  <div className="take-name-wrap">
                    <strong>{clip.name}</strong>
                    <small>step {clip.step + 1}</small>
                  </div>
                  <audio controls src={clip.url} />
                  <button className="remove-take" onClick={() => {
                    setRecordings((prev) => prev.filter((item) => item.id !== clip.id));
                    URL.revokeObjectURL(clip.url);
                  }}>×</button>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="panel mixer-panel">
          <div className="panel-head">
            <div>
              <span className="index">05</span>
              <strong>MIXER</strong>
            </div>
          </div>

          <div className="mixer-grid">
            {DRUMS.map((drum, index) => (
              <div key={drum.id} className="mixer-channel">
                <div className="meters">
                  <span style={{ height: `${mixer[index]}%` }} />
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={mixer[index]}
                  onChange={(event) => setVolumeForTrack(index, Number(event.target.value))}
                  orient="vertical"
                />
                <strong>{drum.label}</strong>
              </div>
            ))}
            <div className="mixer-channel master-channel">
              <div className="meters">
                <span style={{ height: `${master}%` }} />
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={master}
                onChange={(event) => setMaster(Number(event.target.value))}
                orient="vertical"
              />
              <strong>MASTER</strong>
            </div>
          </div>
        </aside>
      </main>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

export default App;
