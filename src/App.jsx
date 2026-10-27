import React, { useEffect, useRef, useState } from 'react';

const STEPS = 16;
const INITIAL_BARS = 4;
const MAX_BARS = 64;
const DRUMS = [
  { name: 'KICK', key: 'C1', color: '#ff2e93' },
  { name: 'SNARE', key: 'D1', color: '#ff6bb5' },
  { name: 'CLOSED HAT', key: 'F#1', color: '#ff49a7' },
  { name: 'OPEN HAT', key: 'A#1', color: '#e92d8e' },
  { name: 'CLAP', key: 'D#1', color: '#ff8ac5' }
];
const NOTES = ['C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3', 'C4', 'C#4', 'D4', 'D#4']
  .map((name, index) => ({ name, frequency: 130.81 * 2 ** (index / 12) }));
const NOTE_KEYS = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p'];
const INTRO_TAGLINES = [
  'Make something that feels like 2 a.m.',
  'Turn the quiet into a hook.',
  'One more loop. One more idea.',
  'Find your after-hours sound.',
  'Let the beat lead somewhere new.',
  'Small idea. Full-volume feeling.',
  'Your next favorite sound starts here.',
  'Stay up for the good part.',
  'Build a world one beat at a time.',
  'Made for the hours after dark.'
];

function chooseIntroTagline(previous) {
  const choices = INTRO_TAGLINES.filter(tagline => tagline !== previous);
  return choices[Math.floor(Math.random() * choices.length)];
}

function StudioMark({ className = '' }) {
  return <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <circle className="mark-orbit mark-orbit-outer" cx="50" cy="50" r="44" />
    <circle className="mark-orbit mark-orbit-inner" cx="50" cy="50" r="35" />
    <path className="mark-crosshair" d="M50 2v12M50 86v12M2 50h12M86 50h12" />
    <path className="mark-diamond" d="M50 17 78 33v34L50 83 22 67V33L50 17Z" />
    <path className="mark-index" d="M47 25h6M47 75h6M29 47v6M71 47v6" />
    <path className="mark-monogram" d="M38 65V35l24 30V35" />
    <circle className="mark-node" cx="50" cy="11" r="2.2" />
    <circle className="mark-node" cx="89" cy="50" r="2.2" />
    <circle className="mark-node" cx="50" cy="89" r="2.2" />
    <circle className="mark-node" cx="11" cy="50" r="2.2" />
  </svg>;
}

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });
  } catch (error) {
    throw new Error(`Could not reach the Nightshift server: ${error.message}`);
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('The server did not return JSON. Browser-local song saving still works without the Nightshift API server.');
  }
  if (!response.ok) {
    const error = new Error(result.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result;
}

function readBrowserSongs() {
  try {
    const songs = JSON.parse(localStorage.getItem('nightshift-songs') || '[]');
    if (Array.isArray(songs)) return songs;
    throw new Error('Saved songs must be a list.');
  } catch (error) {
    console.error('Could not read songs saved in this browser.', error);
    return [];
  }
}

const patterns = {
  kick: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
  snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
  hat1: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
  hat2: [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
  clap: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0]
};

const initialGrid = DRUMS.map((drum, i) => patterns[Object.keys(patterns)[i]].map(Boolean));
const PRESETS = {
  'Deep House': [[1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0],[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],[0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1],[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0]],
  'Trap Half': [[1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0],[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1],[1,0,1,0,1,0,1,0,1,0,1,1,1,0,1,0],[0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0],[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0]],
  'Four on Floor': [[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0]]
};

function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [introClosing, setIntroClosing] = useState(false);
  const [logoPinned, setLogoPinned] = useState(false);
  const [introTagline, setIntroTagline] = useState(() => chooseIntroTagline());
  const [serverUser, setServerUser] = useState(null);
  const [accountApiAvailable, setAccountApiAvailable] = useState(false);
  const [sharedTestAccount, setSharedTestAccount] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCredential, setRecoveryCredential] = useState(null);
  const [recoveryAction, setRecoveryAction] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [sessionResolved, setSessionResolved] = useState(false);
  const [operationLoading, setOperationLoading] = useState(null);
  const [operationClosing, setOperationClosing] = useState(false);
  const [grid, setGrid] = useState(() => initialGrid.map(row => Array.from({ length: INITIAL_BARS * STEPS }, (_, step) => row[step % STEPS])));
  const [synthGrid, setSynthGrid] = useState(() => NOTES.map(() => Array(INITIAL_BARS * STEPS).fill(false)));
  const [bpm, setBpm] = useState(124);
  const [playing, setPlaying] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [recording, setRecording] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [recordingError, setRecordingError] = useState('');
  const [kit, setKit] = useState('Studio 808');
  const [instrument, setInstrument] = useState('Synth');
  const [projectName, setProjectName] = useState('Untitled Session');
  const [songId, setSongId] = useState(null);
  const [songs, setSongs] = useState(readBrowserSongs);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [publicSongs, setPublicSongs] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState('');
  const [sharingSongId, setSharingSongId] = useState(null);
  const [libraryReady, setLibraryReady] = useState(false);
  const [master, setMaster] = useState(82);
  const [swing, setSwing] = useState(0);
  const [bars, setBars] = useState(INITIAL_BARS);
  const [channelVolumes, setChannelVolumes] = useState([82, 78, 76, 72, 80]);
  const [muted, setMuted] = useState([]);
  const [toast, setToast] = useState('');
  const [activeKeys, setActiveKeys] = useState([]);
  const masterRef = useRef(master);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const stepRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioBuffersRef = useRef(new Map());
  const clipSourcesRef = useRef([]);
  const fileInputRef = useRef(null);
  const recoveryFileInputRef = useRef(null);
  const songRef = useRef({ grid, synthGrid, muted, bars });
  const instrumentRef = useRef(instrument);
  const metronomeRef = useRef(metronome);
  const tapTimesRef = useRef([]);
  const introAutoTimerRef = useRef(null);
  const introExitTimerRef = useRef(null);
  const operationStartTimerRef = useRef(null);
  const operationExitTimerRef = useRef(null);
  const totalSteps = bars * STEPS;

  const closeIntro = () => {
    window.clearTimeout(introAutoTimerRef.current);
    window.clearTimeout(introExitTimerRef.current);
    setLogoPinned(false);
    setIntroClosing(true);
    introExitTimerRef.current = window.setTimeout(() => setShowIntro(false), 500);
  };

  const showStartingLogo = () => {
    window.clearTimeout(introAutoTimerRef.current);
    window.clearTimeout(introExitTimerRef.current);
    setIntroClosing(false);
    setLogoPinned(true);
    setShowIntro(true);
  };

  const runWithLoading = async (title, detail, work) => {
    const startedAt = performance.now();
    setOperationClosing(false);
    setOperationLoading({ title, detail });
    try {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await work();
    } catch (error) {
      console.error(`${title} failed.`, error);
      notify(`${title.charAt(0)}${title.slice(1).toLowerCase()} failed: ${error.message || 'Unexpected error'}`);
    } finally {
      const remaining = Math.max(0, 700 - (performance.now() - startedAt));
      operationStartTimerRef.current = window.setTimeout(() => {
        setOperationClosing(true);
        operationExitTimerRef.current = window.setTimeout(() => {
          setOperationLoading(null);
          setOperationClosing(false);
        }, 400);
      }, remaining);
    }
  };

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    introAutoTimerRef.current = window.setTimeout(closeIntro, reducedMotion ? 700 : 3200);
    const handleKeyDown = event => { if (event.key === 'Escape') closeIntro(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(introAutoTimerRef.current);
      window.clearTimeout(introExitTimerRef.current);
      window.clearTimeout(operationStartTimerRef.current);
      window.clearTimeout(operationExitTimerRef.current);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!showIntro || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const interval = window.setInterval(() => {
      setIntroTagline(previous => chooseIntroTagline(previous));
    }, 1900);
    return () => window.clearInterval(interval);
  }, [showIntro]);

  useEffect(() => {
    let cancelled = false;
    const restoreSession = async () => {
      try {
        const { user, sharedTestAccount: isSharedTestAccount = false } = await apiRequest('/api/session');
        if (!user) return;
        const { songs: serverSongs } = await apiRequest('/api/songs');
        if (!Array.isArray(serverSongs)) throw new Error('The saved song library is invalid.');
        if (!cancelled) {
          setAccountApiAvailable(true);
          setSharedTestAccount(isSharedTestAccount);
          setSongs(serverSongs);
          setLibraryReady(true);
          setServerUser(user);
        }
      } catch (error) {
        console.info(`Using browser-local songs because the hosted library is unavailable: ${error.message}`);
      } finally {
        if (!cancelled) setSessionResolved(true);
      }
    };
    restoreSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!sessionResolved) return undefined;
    if (!accountApiAvailable) {
      try {
        localStorage.setItem('nightshift-songs', JSON.stringify(songs));
      } catch (error) {
        console.error('Could not save songs in this browser.', error);
        setToast('Could not save songs in this browser');
      }
      return undefined;
    }
    if (!libraryReady || !serverUser) return undefined;
    const timeout = window.setTimeout(() => {
      apiRequest('/api/songs', { method: 'PUT', body: JSON.stringify({ songs }) })
        .catch(error => {
          console.error('Could not sync the shared song library.', error);
          if (error.status === 401) {
            setServerUser(null);
            setAccountApiAvailable(false);
            setSharedTestAccount(false);
            setSongs(readBrowserSongs());
            setLibraryReady(false);
            setToast('Your account session expired. Using browser-local songs.');
          } else {
            setToast(`Could not sync songs: ${error.message}`);
          }
        });
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [songs, libraryReady, serverUser, sessionResolved, accountApiAvailable]);

  useEffect(() => {
    songRef.current = { grid, synthGrid, muted, bars, recordings };
  }, [grid, synthGrid, muted, bars, recordings]);

  useEffect(() => {
    instrumentRef.current = instrument;
  }, [instrument]);

  useEffect(() => {
    metronomeRef.current = metronome;
  }, [metronome]);

  useEffect(() => {
    masterRef.current = master;
  }, [master]);

  const getAudio = () => {
    if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (audioRef.current.state === 'suspended') audioRef.current.resume();
    return audioRef.current;
  };

  const noiseBuffer = (ctx, duration = .5) => {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  };

  const playKick = (ctx) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(48, ctx.currentTime + .13);
    gain.gain.setValueAtTime(.9, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .4);
    osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .4);
  };
  const playNoise = (ctx, duration, frequency, gainAmount) => {
    const source = ctx.createBufferSource(); source.buffer = noiseBuffer(ctx, duration);
    const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = frequency;
    const gain = ctx.createGain(); gain.gain.setValueAtTime(gainAmount, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
    source.connect(filter).connect(gain).connect(ctx.destination); source.start();
  };
  const triggerDrum = (index) => {
    const ctx = getAudio();
    if (index === 0) playKick(ctx);
    if (index === 1) playNoise(ctx, .18, 900, .65);
    if (index === 2) playNoise(ctx, .08, 6500, .3);
    if (index === 3) playNoise(ctx, .55, 5000, .25);
    if (index === 4) playNoise(ctx, .16, 1200, .35);
  };

  const playMetronomeClick = (accent = false) => {
    const ctx = getAudio();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(accent ? 1320 : 880, ctx.currentTime);
    gain.gain.setValueAtTime(.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(accent ? .16 : .1, ctx.currentTime + .003);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .045);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + .05);
  };

  const stop = () => {
    clipSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (error) {
        if (error.name !== 'InvalidStateError') console.error('Could not stop an audio clip.', error);
      }
    });
    clipSourcesRef.current = [];
    clearInterval(timerRef.current); timerRef.current = null; setPlaying(false); setCurrentStep(-1); stepRef.current = 0;
  };
  const tick = () => {
    const step = stepRef.current;
    setCurrentStep(step);
    const { grid: currentGrid, synthGrid: currentSynthGrid, muted: mutedTracks, bars: songBars, recordings: audioClips } = songRef.current;
    if (metronomeRef.current && step % 4 === 0) playMetronomeClick(step % STEPS === 0);
    currentGrid.forEach((row, drum) => { if (row[step] && !mutedTracks.includes(drum)) triggerDrum(drum); });
    currentSynthGrid.forEach((row, note) => { if (row[step]) playNote(NOTES[note].frequency, NOTES[note].name); });
    audioClips.filter(clip => clip.startStep === step).forEach(clip => {
      const buffer = audioBuffersRef.current.get(clip.id);
      if (!buffer) return;
      const ctx = getAudio();
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.value = masterRef.current / 100;
      source.connect(gain).connect(ctx.destination);
      source.onended = () => { clipSourcesRef.current = clipSourcesRef.current.filter(active => active !== source); };
      source.start(ctx.currentTime + .01);
      clipSourcesRef.current.push(source);
    });
    stepRef.current = (step + 1) % (STEPS * songBars);
  };
  const play = () => {
    if (playing) return stop();
    getAudio(); setPlaying(true); tick();
    timerRef.current = setInterval(tick, 60000 / bpm / 4);
  };
  useEffect(() => {
    if (playing) { clearInterval(timerRef.current); timerRef.current = setInterval(tick, 60000 / bpm / 4); }
  }, [bpm]);
  useEffect(() => () => clearInterval(timerRef.current), []);

  const toggleCell = (row, col) => setGrid(value => value.map((line, r) => r === row ? line.map((cell, c) => c === col ? !cell : cell) : line));
  const toggleSynthCell = (note, step) => setSynthGrid(value => value.map((line, row) => row === note ? line.map((cell, col) => col === step ? !cell : cell) : line));
  const resizeSong = nextBars => {
    const nextLength = nextBars * STEPS;
    const resizeRows = rows => rows.map(row => Array.from({ length: nextLength }, (_, step) => row[step] ?? (row.length ? row[step % Math.min(row.length, STEPS)] : false)));
    setGrid(resizeRows(grid));
    setSynthGrid(resizeRows(synthGrid));
    setRecordings(items => items.map(item => ({ ...item, startStep: Math.min(item.startStep || 0, nextLength - 1) })));
    setBars(nextBars);
    if (stepRef.current >= nextLength) stepRef.current = 0;
    if (currentStep >= nextLength) setCurrentStep(-1);
  };
  const notify = message => { setToast(message); window.clearTimeout(window.nightshiftToast); window.nightshiftToast = window.setTimeout(() => setToast(''), 2200); };
  const applyPreset = name => {
    setGrid(PRESETS[name].map(row => Array.from({ length: totalSteps }, (_, step) => Boolean(row[step % STEPS]))));
    notify(`${name} loaded`);
  };
  const clearPattern = () => setGrid(DRUMS.map(() => Array(bars * STEPS).fill(false)));
  const randomizePattern = () => setGrid(DRUMS.map((_, drum) => Array.from({ length: bars * STEPS }, (_, step) => drum === 0 ? step % 4 === 0 && Math.random() > .18 : Math.random() > (drum === 2 ? .48 : .8))));
  const generateMelody = () => {
    const scale = [0, 2, 4, 5, 7, 9, 11, 12, 14];
    const melody = NOTES.map(() => Array(totalSteps).fill(false));
    let note = 0;
    for (let step = 0; step < totalSteps; step += 2) {
      if (step % STEPS === 0) note = [0, 4, 2, 5][Math.floor(step / STEPS) % 4];
      else if (Math.random() < .7) note = Math.max(0, Math.min(scale.length - 1, note + Math.floor(Math.random() * 5) - 2));
      if (Math.random() < .78) melody[scale[note]][step] = true;
    }
    setSynthGrid(melody);
    notify('New melody generated in C major');
  };
  const tapTempo = () => {
    const now = performance.now();
    const previous = tapTimesRef.current;
    const taps = previous.length && now - previous[previous.length - 1] <= 2000 ? [...previous, now].slice(-5) : [now];
    tapTimesRef.current = taps;
    if (taps.length < 2) {
      notify('Keep tapping to set tempo');
      return;
    }
    const intervals = taps.slice(1).map((time, index) => time - taps[index]);
    const average = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    setBpm(Math.min(240, Math.max(40, Math.round(60000 / average))));
  };
  const toggleMute = index => setMuted(items => items.includes(index) ? items.filter(item => item !== index) : [...items, index]);

  const playNote = (frequency, key) => {
    const ctx = getAudio(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); const filter = ctx.createBiquadFilter();
    const piano = instrumentRef.current === 'Piano';
    osc.type = piano ? 'sine' : 'triangle'; osc.frequency.value = frequency; filter.type = 'lowpass'; filter.frequency.value = piano ? 2600 : 1800;
    gain.gain.setValueAtTime(.0001, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(piano ? .2 : .16, ctx.currentTime + (piano ? .008 : .02)); gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + (piano ? .32 : .42));
    osc.connect(filter).connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .45); setActiveKeys(keys => [...keys, key]);
    window.setTimeout(() => setActiveKeys(keys => keys.filter(item => item !== key)), 180);
  };

  const startRecording = async () => {
    if (recording) { mediaRecorderRef.current?.stop(); setRecording(false); return; }
    try {
      setRecordingError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const clipStartStep = playing ? stepRef.current : 0;
      chunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onerror = event => {
        console.error('Audio recording failed.', event.error);
        setRecordingError(`Recording failed: ${event.error?.message || 'check microphone access and try again'}`);
        setRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        const id = window.crypto?.randomUUID ? window.crypto.randomUUID() : String(Date.now());
        try {
          const data = await blob.arrayBuffer();
          const audioBuffer = await getAudio().decodeAudioData(data);
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('Could not prepare the recording for saving.'));
            reader.readAsDataURL(blob);
          });
          audioBuffersRef.current.set(id, audioBuffer);
          setRecordings(items => [...items, {
            id,
            name: `Take ${items.length + 1}`,
            url: URL.createObjectURL(blob),
            audioData: dataUrl,
            startStep: Math.min(clipStartStep, Math.max(0, bars * STEPS - 1))
          }]);
          notify('Recording saved. Choose its bar and step in the timeline.');
        } catch (error) {
          console.error('Could not prepare recorded audio.', error);
          setRecordingError(`Could not prepare recording: ${error.message}`);
        } finally {
          stream.getTracks().forEach(track => track.stop());
        }
      };
      mediaRecorderRef.current = recorder; recorder.start(); setRecording(true); notify('Recording started');
    } catch (error) {
      console.error('Could not start microphone recording.', error);
      setRecordingError(`Microphone unavailable: ${error.message || 'allow microphone access and try again'}`);
    }
  };

  const playRecording = (recordingItem) => {
    const audio = new Audio(recordingItem.url);
    audio.volume = master / 100;
    audio.play().catch(error => {
      console.error(`Could not play ${recordingItem.name}.`, error);
      notify(`Could not play ${recordingItem.name}: ${error.message}`);
    });
  };
  const setRecordingPosition = (recordingId, startStep) => {
    setRecordings(items => items.map(item => item.id === recordingId
      ? { ...item, startStep: Math.max(0, Math.min(bars * STEPS - 1, startStep)) }
      : item));
  };
  const removeRecording = recordingId => {
    const clip = recordings.find(item => item.id === recordingId);
    if (clip?.url) URL.revokeObjectURL(clip.url);
    audioBuffersRef.current.delete(recordingId);
    setRecordings(items => items.filter(item => item.id !== recordingId));
  };
  const hydrateRecordings = async (clips, maxBars = bars) => Promise.all((Array.isArray(clips) ? clips : []).map(async (clip, index) => {
    if (typeof clip.audioData !== 'string' || !clip.audioData.startsWith('data:audio/')) return null;
    try {
      const response = await fetch(clip.audioData);
      const blob = await response.blob();
      const audioBuffer = await getAudio().decodeAudioData(await blob.arrayBuffer());
      const id = clip.id || `take-${Date.now()}-${index}`;
      audioBuffersRef.current.set(id, audioBuffer);
      return {
        id,
        name: typeof clip.name === 'string' ? clip.name : `Take ${index + 1}`,
        audioData: clip.audioData,
        url: URL.createObjectURL(blob),
        startStep: Math.min(maxBars * STEPS - 1, Math.max(0, Number(clip.startStep) || 0))
      };
    } catch (error) {
      console.error(`Could not load recorded clip ${clip.name || index + 1}.`, error);
      return null;
    }
  })).then(items => items.filter(Boolean));

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.repeat || event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      const noteIndex = NOTE_KEYS.indexOf(event.key.toLowerCase());
      if (noteIndex !== -1) playNote(NOTES[noteIndex].frequency, NOTES[noteIndex].name);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getSongData = () => ({
    projectName: projectName.trim() || 'Untitled Session',
    grid, synthGrid, bpm, kit, instrument, swing, bars, channelVolumes, master,
    recordings: recordings.map(({ id, name, audioData, startStep }) => ({ id, name, audioData, startStep }))
  });
  const saveSong = () => {
    const id = songId || (window.crypto?.randomUUID ? window.crypto.randomUUID() : String(Date.now()));
    const song = { id, ...getSongData(), isPublic: libraryReady && songs.find(item => item.id === id)?.isPublic === true, updatedAt: new Date().toISOString() };
    setSongs(items => [song, ...items.filter(item => item.id !== id)]);
    setSongId(id);
    notify('Song saved to your library');
  };
  const loadSong = (song, isCopy = false) => {
    setSongId(isCopy ? null : song.id);
    setProjectName(song.projectName || 'Untitled Session');
    const songBars = Math.min(MAX_BARS, Math.max(1, Number(song.bars) || INITIAL_BARS));
    const songLength = songBars * STEPS;
    const normalizeRows = (rows, count, fill) => Array.from({ length: count }, (_, row) => Array.from({ length: songLength }, (_, step) => rows?.[row]?.[step] ?? (rows?.[row]?.length ? rows[row][step % Math.min(rows[row].length, STEPS)] : fill)));
    setGrid(normalizeRows(song.grid, DRUMS.length, false));
    setSynthGrid(normalizeRows(song.synthGrid, NOTES.length, false));
    stop();
    recordings.forEach(clip => URL.revokeObjectURL(clip.url));
    audioBuffersRef.current.clear();
    setRecordings([]);
    hydrateRecordings(song.recordings, songBars).then(clips => {
      setRecordings(clips);
      notify(clips.length < (song.recordings || []).length
        ? 'Song loaded, but some audio clips could not be decoded'
        : `${song.projectName || 'Song'} loaded`);
    });
    setBpm(song.bpm || 124);
    setKit(song.kit || 'Studio 808');
    setInstrument(song.instrument || 'Synth');
    setSwing(song.swing || 0);
    setBars(songBars);
    setChannelVolumes(song.channelVolumes || [82, 78, 76, 72, 80]);
    setMaster(song.master ?? 82);
    setShowLibrary(false);
    setShowGallery(false);
  };
  const openPublicGallery = async () => {
    setShowLibrary(false);
    setShowGallery(true);
    setGalleryLoading(true);
    setGalleryError('');
    try {
      const { songs: sharedSongs } = await apiRequest('/api/public-songs');
      if (!Array.isArray(sharedSongs)) throw new Error('The public song gallery is invalid.');
      setPublicSongs(sharedSongs);
    } catch (error) {
      setGalleryError(error.message);
    } finally {
      setGalleryLoading(false);
    }
  };
  const setSongSharing = async (song, isPublic) => {
    setSharingSongId(song.id);
    try {
      await apiRequest('/api/song-sharing', {
        method: 'POST',
        body: JSON.stringify({ songId: song.id, isPublic })
      });
      setSongs(items => items.map(item => item.id === song.id ? { ...item, isPublic } : item));
      notify(isPublic ? 'Song published to the public gallery' : 'Song removed from the public gallery');
      if (showGallery) await openPublicGallery();
    } catch (error) {
      notify(`Could not update song sharing: ${error.message}`);
    } finally {
      setSharingSongId(null);
    }
  };
  const deleteSong = async id => {
    const song = songs.find(item => item.id === id);
    if (libraryReady && song?.isPublic) {
      setSharingSongId(id);
      try {
        await apiRequest('/api/song-sharing', {
          method: 'POST',
          body: JSON.stringify({ songId: id, isPublic: false })
        });
      } catch (error) {
        notify(`Could not remove song from the public gallery: ${error.message}`);
        setSharingSongId(null);
        return;
      }
      setSharingSongId(null);
    }
    setSongs(items => items.filter(song => song.id !== id));
    if (songId === id) setSongId(null);
    notify('Song removed from your library');
  };
  const newSong = () => {
    stop();
    recordings.forEach(clip => URL.revokeObjectURL(clip.url));
    audioBuffersRef.current.clear();
    setRecordings([]);
    setSongId(null);
    setProjectName('Untitled Session');
    setGrid(initialGrid.map(row => Array.from({ length: INITIAL_BARS * STEPS }, (_, step) => row[step % STEPS])));
    setSynthGrid(NOTES.map(() => Array(INITIAL_BARS * STEPS).fill(false)));
    setBpm(124);
    setKit('Studio 808');
    setInstrument('Synth');
    setSwing(0);
    setBars(4);
    setChannelVolumes([82, 78, 76, 72, 80]);
    setMaster(82);
    setShowLibrary(false);
  };
  const downloadProject = () => runWithLoading('EXPORTING PROJECT', 'Packing your session into a portable project file', () => {
    const blob = new Blob([JSON.stringify(getSongData(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName.replace(/\s+/g, '-').toLowerCase()}.nightshift.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Project exported');
  });

  const importProject = event => {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    runWithLoading('IMPORTING PROJECT', `Reading ${file.name}`, async () => {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.grid) || data.grid.length !== DRUMS.length || data.grid.some(row => !Array.isArray(row) || row.length < STEPS || row.length > MAX_BARS * STEPS)) throw new Error('That project file could not be read.');
      const importedBars = Math.min(MAX_BARS, Math.max(1, Number(data.bars) || Math.ceil(data.grid[0].length / STEPS)));
      const importedLength = importedBars * STEPS;
      const normalizeRows = (rows, count) => Array.from({ length: count }, (_, row) => Array.from({ length: importedLength }, (_, step) => Boolean(rows?.[row]?.[step % (rows?.[row]?.length || STEPS)])));
      setSongId(null);
      setProjectName(data.projectName || 'Imported Session');
      setGrid(normalizeRows(data.grid, DRUMS.length));
      setSynthGrid(normalizeRows(data.synthGrid, NOTES.length));
      setBpm(Number(data.bpm) || 124);
      setKit(data.kit || 'Studio 808');
      setInstrument(data.instrument || 'Synth');
      setSwing(Number(data.swing) || 0);
      setBars(importedBars);
      setChannelVolumes(data.channelVolumes || [82, 78, 76, 72, 80]);
      setMaster(data.master ?? 82);
      stop();
      recordings.forEach(clip => URL.revokeObjectURL(clip.url));
      audioBuffersRef.current.clear();
      setRecordings([]);
      const importedRecordings = await hydrateRecordings(data.recordings, importedBars);
      setRecordings(importedRecordings);
      notify(Array.isArray(data.recordings) && importedRecordings.length < data.recordings.length
        ? 'Project imported, but some audio clips could not be decoded'
        : 'Project imported');
    });
  };

  const exportWav = () => runWithLoading('RENDERING FULL SONG', `Mixing ${bars} bars, instruments, and ${recordings.length} audio clips`, async () => {
    const sampleRate = 44100; const secondsPerStep = 60 / bpm / 4;
    const length = Math.floor(sampleRate * secondsPerStep * STEPS * bars); const data = new Float32Array(length);
    const addKick = start => {
      for (let i = 0; i < sampleRate * .4 && start + i < length; i++) { const t = i / sampleRate; const freq = 150 * Math.exp(-18 * t) + 48; const phase = 2 * Math.PI * freq * t; data[start+i] += Math.sin(phase) * Math.exp(-8*t) * .8; }
    };
    const addNoise = (start, duration, amount, cutoffBias) => {
      let seed = 12345;
      for (let i=0; i < sampleRate*duration && start+i < length; i++) { seed = (seed*16807)%2147483647; const white = (seed/2147483647)*2-1; const envelope = Math.exp(-(cutoffBias*i)/(sampleRate*duration)); data[start+i] += white*envelope*amount; }
    };
    grid.forEach((row, drum) => row.forEach((on, step) => {
      if (!on || muted.includes(drum)) return; const start = Math.floor(step*secondsPerStep*sampleRate);
      if (drum===0) addKick(start); else addNoise(start, drum===3 ? .5 : .16, drum===1 ? .35 : .18, drum===2 ? 14 : 8);
    }));
    synthGrid.forEach((row, note) => row.forEach((on, step) => {
      if (!on) return;
      const start = Math.floor(step * secondsPerStep * sampleRate);
      const piano = instrument === 'Piano';
      const noteLength = Math.min(sampleRate * (piano ? .32 : .38), length - start);
      for (let i = 0; i < noteLength; i++) {
        const t = i / sampleRate;
        const fundamental = Math.sin(2 * Math.PI * NOTES[note].frequency * t);
        const overtone = piano ? 0 : Math.sin(4 * Math.PI * NOTES[note].frequency * t) * .24;
        data[start + i] += (fundamental + overtone) * Math.exp(-(piano ? 8 : 5) * t) * (piano ? .2 : .16);
      }
    }));
    for (const clip of recordings) {
      const clipBuffer = audioBuffersRef.current.get(clip.id);
      if (!clipBuffer) continue;
      const start = Math.floor((clip.startStep || 0) * secondsPerStep * sampleRate);
      const channelData = Array.from({ length: clipBuffer.numberOfChannels }, (_, channel) => clipBuffer.getChannelData(channel));
      const clipLength = Math.min(length - start, Math.ceil(clipBuffer.length * sampleRate / clipBuffer.sampleRate));
      for (let i = 0; i < clipLength; i++) {
        const sourcePosition = i * clipBuffer.sampleRate / sampleRate;
        const sourceIndex = Math.floor(sourcePosition);
        const fraction = sourcePosition - sourceIndex;
        let sample = 0;
        channelData.forEach(channel => {
          const first = channel[sourceIndex] || 0;
          const second = channel[sourceIndex + 1] || 0;
          sample += first + (second - first) * fraction;
        });
        data[start + i] += (sample / channelData.length) * .8;
      }
    }
    const buffer = new ArrayBuffer(44 + length*2); const view = new DataView(buffer);
    const write = (offset, text) => [...text].forEach((char,i) => view.setUint8(offset+i, char.charCodeAt(0)));
    write(0,'RIFF'); view.setUint32(4,36+length*2,true); write(8,'WAVE'); write(12,'fmt ');
    view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true);
    write(36,'data'); view.setUint32(40,length*2,true);
    for (let i=0;i<length;i++) { const sample=Math.max(-1,Math.min(1,data[i]*(master/100))); view.setInt16(44+i*2,sample<0?sample*32768:sample*32767,true); }
    const url=URL.createObjectURL(new Blob([view],{type:'audio/wav'})); const link=document.createElement('a'); link.href=url; link.download=`${projectName.replace(/\s+/g,'-').toLowerCase()}-mix.wav`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Full-song WAV exported');
  });

  const finishSignIn = async user => {
    const { songs: accountSongs } = await apiRequest('/api/songs');
    if (!Array.isArray(accountSongs)) throw new Error('The saved song library is invalid.');
    setSongs(accountSongs);
    setLibraryReady(true);
    setServerUser(user);
    setAuthPassword('');
    setAuthError('');
  };

  const submitAuth = async event => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    try {
      const endpoint = authMode === 'register' ? '/api/register' : '/api/login';
      const { user } = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ username: authUsername.trim(), password: authPassword })
      });
      await finishSignIn(user);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const recoverWithKeyFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAuthError('');
    try {
      const credential = JSON.parse(await file.text());
      if (
        credential?.app !== 'Nightshift Studio'
        || credential?.format !== 1
        || typeof credential.username !== 'string'
        || typeof credential.recoveryKey !== 'string'
      ) {
        throw new Error('Choose a valid Nightshift recovery-key file.');
      }
      setRecoveryCredential(credential);
      setRecoveryAction(null);
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      setAuthError(error instanceof SyntaxError ? 'That file is not valid recovery-key JSON.' : error.message);
    }
  };

  const signInWithRecoveryKey = async () => {
    if (!recoveryCredential) return;
    setAuthBusy(true);
    setAuthError('');
    try {
      const { user } = await apiRequest('/api/recover', {
        method: 'POST',
        body: JSON.stringify({
          username: recoveryCredential.username,
          recoveryKey: recoveryCredential.recoveryKey
        })
      });
      await finishSignIn(user);
      setAuthUsername(user.username);
      setRecoveryMode(false);
      setRecoveryCredential(null);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const changePasswordWithRecoveryKey = async event => {
    event.preventDefault();
    if (!recoveryCredential) return;
    if (newPassword !== confirmNewPassword) {
      setAuthError('The new passwords do not match.');
      return;
    }
    setAuthBusy(true);
    setAuthError('');
    try {
      const { user } = await apiRequest('/api/recover-password', {
        method: 'POST',
        body: JSON.stringify({
          username: recoveryCredential.username,
          recoveryKey: recoveryCredential.recoveryKey,
          newPassword
        })
      });
      await finishSignIn(user);
      setAuthUsername(user.username);
      setAuthPassword('');
      setRecoveryMode(false);
      setRecoveryCredential(null);
      setRecoveryAction(null);
      setNewPassword('');
      setConfirmNewPassword('');
      notify('Password changed. Generate a new recovery key from the studio.');
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const downloadRecoveryKey = async () => {
    if (!window.confirm('Generate a new recovery key file? This replaces any previous recovery file, which will stop working. Keep the download private.')) return;
    setAuthBusy(true);
    try {
      const { recoveryKey } = await apiRequest('/api/recovery-key', { method: 'POST', body: '{}' });
      const credential = {
        app: 'Nightshift Studio',
        format: 1,
        username: serverUser.username,
        recoveryKey,
        createdAt: new Date().toISOString()
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(credential, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `nightshift-${serverUser.username}-recovery-key.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Recovery key downloaded - keep it private');
    } catch (error) {
      notify(`Could not generate recovery key: ${error.message}`);
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    setAuthBusy(true);
    try {
      await apiRequest('/api/logout', { method: 'POST', body: '{}' });
      setServerUser(null);
      setAccountApiAvailable(false);
      setSharedTestAccount(false);
      setSongs(readBrowserSongs());
      setLibraryReady(false);
      setShowLibrary(false);
      setShowGallery(false);
      setPublicSongs([]);
      setAuthPassword('');
      setAuthError('');
      setToast('Signed out. Using browser-local songs.');
    } catch (error) {
      setToast(`Could not sign out: ${error.message}`);
    } finally {
      setAuthBusy(false);
    }
  };

  if (sessionResolved && accountApiAvailable && !serverUser) {
    return <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand"><span className="brand-mark"><StudioMark className="studio-mark-svg" /></span><span>NIGHTSHIFT <b>STUDIO</b></span></div>
        <span className="auth-kicker">YOUR PRIVATE SOUND SPACE</span>
        <h1>{recoveryMode ? 'Recover your account' : authMode === 'register' ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-description">{recoveryMode ? 'Upload your recovery-key file to sign in or change your password. Never send the key by email.' : authMode === 'register' ? 'Create an account to keep your song library private and available whenever you sign in.' : 'Sign in to open your private song library and studio.'}</p>
        {recoveryMode
          ? <div className="auth-form">
            {!recoveryCredential
              ? <>
                <span className="auth-hint">Choose the Nightshift recovery-key JSON file saved on your device.</span>
                <input ref={recoveryFileInputRef} hidden type="file" accept=".json,application/json" onChange={recoverWithKeyFile} disabled={authBusy} />
                <button className="auth-submit" type="button" onClick={() => recoveryFileInputRef.current?.click()} disabled={authBusy}>CHOOSE RECOVERY KEY FILE</button>
              </>
              : <>
                <div className="auth-key-selected">RECOVERY FILE READY · {recoveryCredential.username}</div>
                {recoveryAction === 'change-password'
                  ? <form className="auth-form" onSubmit={changePasswordWithRecoveryKey}>
                    <label>NEW PASSWORD<input autoComplete="new-password" type="password" minLength="10" maxLength="1024" value={newPassword} onChange={event => setNewPassword(event.target.value)} required /></label>
                    <label>CONFIRM NEW PASSWORD<input autoComplete="new-password" type="password" minLength="10" maxLength="1024" value={confirmNewPassword} onChange={event => setConfirmNewPassword(event.target.value)} required /></label>
                    <small className="auth-hint">Changing your password revokes the recovery file and other signed-in sessions.</small>
                    {authError && <div className="auth-error" role="alert">{authError}</div>}
                    <button className="auth-submit" type="submit" disabled={authBusy}>{authBusy ? 'CHANGING PASSWORD…' : 'CHANGE PASSWORD'}</button>
                  </form>
                  : <>
                    {authError && <div className="auth-error" role="alert">{authError}</div>}
                    <button className="auth-submit" type="button" onClick={signInWithRecoveryKey} disabled={authBusy}>{authBusy ? 'VERIFYING…' : 'SIGN IN WITH KEY'}</button>
                    <button className="auth-mode-toggle" type="button" onClick={() => {setRecoveryAction('change-password'); setAuthError('');}} disabled={authBusy}>CHANGE PASSWORD WITH KEY</button>
                  </>}
                <button className="auth-mode-toggle" type="button" onClick={() => {setRecoveryCredential(null); setRecoveryAction(null); setAuthError('');}} disabled={authBusy}>Choose a different file</button>
              </>}
            {authError && !recoveryAction && !recoveryCredential && <div className="auth-error" role="alert">{authError}</div>}
          </div>
          : <form className="auth-form" onSubmit={submitAuth}>
            <label>USERNAME<input autoComplete="username" name="username" minLength="3" maxLength="24" pattern={'[A-Za-z0-9_\\x2d]{3,24}'} value={authUsername} onChange={event => setAuthUsername(event.target.value)} required /></label>
            <label>PASSWORD<input autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} name="password" type="password" minLength={authMode === 'register' ? 10 : 1} maxLength="1024" value={authPassword} onChange={event => setAuthPassword(event.target.value)} required /></label>
            {authMode === 'register' && <small className="auth-hint">Username: 3–24 letters, numbers, _ or -. Password: at least 10 characters.</small>}
            {authError && <div className="auth-error" role="alert">{authError}</div>}
            <button className="auth-submit" type="submit" disabled={authBusy}>{authBusy ? 'PLEASE WAIT…' : authMode === 'register' ? 'CREATE ACCOUNT' : 'SIGN IN'}</button>
          </form>}
        {authMode === 'login' && <button className="auth-mode-toggle" onClick={() => {setRecoveryMode(value => !value); setAuthError('');}} disabled={authBusy}>
          {recoveryMode ? 'Back to password sign in' : 'Forgot your password? Upload a recovery key'}
        </button>}
        <button className="auth-mode-toggle" onClick={() => {setRecoveryMode(false); setAuthMode(mode => mode === 'register' ? 'login' : 'register'); setAuthError(''); setAuthPassword('');}} disabled={authBusy}>
          {authMode === 'register' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
        <a className="auth-help-button" href="mailto:lpo5467899@gmail.com?subject=Nightshift%20Studio%20account%20help&body=Please%20describe%20the%20issue.%20To%20change%20your%20password%2C%20upload%20your%20recovery%20key%20in%20Nightshift%20Studio%20and%20choose%20Change%20Password.%20Never%20send%20your%20password%20or%20recovery%20key%20by%20email.">ACCOUNT HELP · EMAIL SUPPORT</a>
        <p className="auth-security-note">To download a key: sign in, click <strong>RECOVERY KEY</strong> in the studio, and save the JSON file somewhere private. To change your password, choose “Forgot your password?”, upload that file, then choose “Change password with key.” Never email the key.</p>
      </div>
    </main>;
  }

  return <div className="studio">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><StudioMark className="studio-mark-svg" /></span><span>NIGHTSHIFT <b>STUDIO</b></span></div>
      <input className="project-name" value={projectName} onChange={e => setProjectName(e.target.value)} aria-label="Project name" />
      <div className="top-actions">
        {serverUser && <><span className="account-badge">{serverUser.username}{sharedTestAccount ? ' · SHARED' : ''}</span>{!sharedTestAccount && <><button className="icon-button recovery-key-button" onClick={downloadRecoveryKey} disabled={authBusy}>RECOVERY KEY</button><button className="icon-button" onClick={signOut} disabled={authBusy}>SIGN OUT</button></>}</>}
        <button className="icon-button save-song-button" title="Save this song in your library" onClick={saveSong}>SAVE SONG</button>
        <button className="icon-button" title="Browse saved songs" onClick={() => setShowLibrary(value => !value)}>MY SONGS ({songs.length})</button>
        {libraryReady && <button className="icon-button gallery-button" title="Browse songs their owners have published" onClick={openPublicGallery}>PUBLIC GALLERY</button>}
        <button className="icon-button" title="Start a new song" onClick={newSong}>NEW SONG</button>
        <button className="icon-button" title="View the Nightshift Studio starting logo" onClick={showStartingLogo}>VIEW LOGO</button>
        <button className="icon-button" title="Download project" onClick={downloadProject}>PROJECT</button>
        <button className="icon-button" onClick={() => fileInputRef.current.click()}>IMPORT</button>
        <input ref={fileInputRef} hidden type="file" accept=".json,.nightshift" onChange={importProject} />
        <button className="export-button" onClick={exportWav}>EXPORT WAV</button>
      </div>
    </header>

    <main className="workspace">
      <section className="transport">
        <button className={`play-button ${playing ? 'active' : ''}`} onClick={play} aria-label={playing ? 'Stop' : 'Play'}>
          {playing
            ? <svg className="transport-icon stop-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="1.5" /></svg>
            : <svg className="transport-icon play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.75c0-.7.77-1.13 1.37-.76l10.1 6.25a.9.9 0 0 1 0 1.52l-10.1 6.25A.9.9 0 0 1 8 18.25z" /></svg>}
        </button>
        <button className="transport-button" onClick={stop} title="Stop" aria-label="Stop"><svg className="transport-icon stop-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="1.5" /></svg></button>
        <div className="tempo"><span>TEMPO</span><input type="number" min="40" max="240" value={bpm} onChange={e => setBpm(Math.min(240,Math.max(40,Number(e.target.value)||40)))} /><small>BPM</small><button className="tap-tempo" onClick={tapTempo}>TAP</button></div>
        <button className={`metro-button ${metronome?'enabled':''}`} onClick={() => setMetronome(value => !value)} aria-pressed={metronome} title="Toggle metronome">METRONOME {metronome?'ON':'OFF'}</button>
        <div className="timecode">{String(currentStep < 0 ? 1 : Math.floor(currentStep / STEPS) + 1).padStart(2,'0')} : {String(currentStep < 0 ? 1 : Math.floor((currentStep % STEPS) / 4) + 1).padStart(2,'0')}</div>
        <span className="song-duration">LENGTH {Math.floor((bars * 240) / bpm / 60)}:{String(Math.floor((bars * 240) / bpm) % 60).padStart(2,'0')}</span>
        <label className="swing-control">SWING <input type="range" min="0" max="60" value={swing} onChange={e => setSwing(Number(e.target.value))} /><span>{swing}%</span></label>
        <label className="bars-control">BARS<select value={bars} onChange={e => resizeSong(Number(e.target.value))}>{[2, 4, 8, 16, 32, 64].map(count => <option key={count} value={count}>{count}</option>)}</select></label>
        <select value={kit} onChange={e => setKit(e.target.value)}><option>Studio 808</option><option>Analog Breaks</option><option>Trap Machine</option></select>
      </section>

      {showLibrary && <section className="song-library">
        <div className="panel-heading">
          <div><span className="panel-number">LIB</span><strong>YOUR SONGS</strong><span className="library-note">{libraryReady ? 'Private unless published' : 'Saved in this browser'}</span></div>
          <button className="library-close" onClick={() => setShowLibrary(false)} aria-label="Close song library">×</button>
        </div>
        {songs.length === 0
          ? <div className="library-empty">Your library is empty. Save a song to keep it here.</div>
          : <div className="song-list">{songs.map(song => <article className="song-card" key={song.id}>
            <div className="song-card-info"><strong>{song.projectName || 'Untitled Session'}</strong><span>{song.bpm || 124} BPM · {new Date(song.updatedAt || Date.now()).toLocaleDateString()}</span></div>
            <button onClick={() => loadSong(song)}>OPEN</button>
            {libraryReady && <button className="song-share" onClick={() => setSongSharing(song, !song.isPublic)} disabled={sharingSongId === song.id}>{sharingSongId === song.id ? '…' : song.isPublic ? 'UNPUBLISH' : 'PUBLISH'}</button>}
            <button className="song-delete" onClick={() => deleteSong(song.id)} disabled={sharingSongId === song.id} aria-label={`Delete ${song.projectName || 'song'}`}>×</button>
          </article>)}</div>}
      </section>}

      {showGallery && <section className="song-library public-gallery">
        <div className="panel-heading">
          <div><span className="panel-number">PUB</span><strong>PUBLIC GALLERY</strong><span className="library-note">Only songs owners chose to publish</span></div>
          <button className="library-close" onClick={() => setShowGallery(false)} aria-label="Close public gallery">×</button>
        </div>
        {galleryLoading
          ? <div className="library-empty" role="status">Loading the public gallery…</div>
          : galleryError
            ? <div className="library-empty gallery-error" role="alert">{galleryError}</div>
            : publicSongs.length === 0
              ? <div className="library-empty">No published songs yet. You can publish one from your library.</div>
              : <div className="song-list">{publicSongs.map(song => <article className="song-card" key={`${song.sharedBy}-${song.id}`}>
                <div className="song-card-info"><strong>{song.projectName || 'Untitled Session'}</strong><span>BY {song.sharedBy} · {song.bpm || 124} BPM</span></div>
                <button onClick={() => loadSong(song, true)}>OPEN COPY</button>
              </article>)}</div>}
      </section>}

      <section className="sequencer-panel">
        <div className="panel-heading"><div><span className="panel-number">01</span><strong>DRUM MACHINE</strong></div><div className="pattern-tools"><select onChange={e => applyPreset(e.target.value)} defaultValue=""><option value="" disabled>Load preset</option>{Object.keys(PRESETS).map(name => <option key={name}>{name}</option>)}</select><button onClick={randomizePattern}>RANDOMIZE</button><button onClick={clearPattern}>CLEAR</button><span className="kit-name">{kit}</span></div></div>
        <div className="sequence">
          <div className="sequence-labels"><div className="label-spacer">TRACK</div>{DRUMS.map((drum,i)=><div className="track-label" key={drum.name}><span className="track-dot" style={{background:drum.color}}></span><div><strong>{drum.name}</strong><small>{drum.key}</small></div><button className={`mute-mini ${muted.includes(i)?'muted':''}`} onClick={() => toggleMute(i)}>M</button><button className="mini-play-button" onClick={() => triggerDrum(i)} aria-label={`Preview ${drum.name}`}><svg className="transport-icon play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.75c0-.7.77-1.13 1.37-.76l10.1 6.25a.9.9 0 0 1 0 1.52l-10.1 6.25A.9.9 0 0 1 8 18.25z" /></svg></button></div>)}</div>
          <div className="grid-scroll"><div className="beat-grid" style={{'--total-steps': totalSteps, '--grid-width': `${totalSteps * 42}px`}}>
            <div className="step-labels">{Array.from({length:totalSteps},(_,i)=><span key={i} className={`${i%4===0?'bar-start':''} ${i%STEPS===0?'measure-start':''}`}>{String((i%STEPS)+1).padStart(2,'0')}</span>)}</div>
            {grid.map((row,rowIndex)=><div className="grid-row" key={DRUMS[rowIndex].name}>{row.slice(0,totalSteps).map((on,col)=><button key={col} onClick={() => toggleCell(rowIndex,col)} className={`step ${on?'on':''} ${currentStep===col?'current':''} ${col%4===0?'bar-start':''} ${col%STEPS===0?'measure-start':''}`} style={on ? {'--step-color':DRUMS[rowIndex].color}:undefined} aria-label={`${DRUMS[rowIndex].name} bar ${Math.floor(col/STEPS)+1} step ${(col%STEPS)+1}`} />)}</div>)}
          </div></div>
        </div>
      </section>

      <section className="instrument-panel">
        <div className="panel-heading"><div><span className="panel-number">02</span><strong>PIANO & SYNTH</strong></div><div className="instrument-tools"><span className="kit-name">CLICK A KEY OR USE A–P</span><button className={instrument==='Piano'?'selected':''} onClick={() => setInstrument('Piano')}>PIANO</button><button className={instrument==='Synth'?'selected':''} onClick={() => setInstrument('Synth')}>SYNTH</button></div></div>
        <div className="piano-roll">
          {NOTES.map(({name,frequency}, index) => <button key={name} className={`piano-key ${name.includes('#')?'black':''} ${activeKeys.includes(name)?'active':''}`} onClick={() => playNote(frequency,name)} aria-label={`Play ${name} (${NOTE_KEYS[index].toUpperCase()})`}>{name}<small>{NOTE_KEYS[index].toUpperCase()}</small></button>)}
        </div>
        <div className="melody-heading"><strong>PIANO ROLL</strong><span>Click cells to add or remove notes · {bars} bars</span><button onClick={generateMelody}>GENERATE MELODY</button><button onClick={() => setSynthGrid(NOTES.map(() => Array(totalSteps).fill(false)))}>CLEAR NOTES</button></div>
        <div className="melody-scroll"><div className="melody-grid" style={{'--total-steps': totalSteps, '--grid-width': `${totalSteps * 42}px`}}>
          <div className="melody-step-labels"><span className="note-name">NOTE</span>{Array.from({length:totalSteps},(_,i)=><span key={i} className={`${i%4===0?'bar-start':''} ${i%STEPS===0?'measure-start':''}`}>{i%4===0 ? `${Math.floor(i/STEPS)+1}.${Math.floor((i%STEPS)/4)+1}` : ''}</span>)}</div>
          {NOTES.slice().reverse().map(({name}, reverseIndex) => {
            const noteIndex = NOTES.length - reverseIndex - 1;
            return <div className="melody-row" key={name}><span className="note-name">{name}</span>{synthGrid[noteIndex].slice(0,totalSteps).map((on,step)=><button key={step} className={`note-cell ${on?'on':''} ${currentStep===step?'current':''} ${step%4===0?'bar-start':''} ${step%STEPS===0?'measure-start':''}`} onClick={() => toggleSynthCell(noteIndex,step)} aria-label={`${on?'Remove':'Add'} ${name} at bar ${Math.floor(step/STEPS)+1}, step ${(step%STEPS)+1}`} />)}</div>;
          })}
        </div>
        </div>
      </section>

      <section className="bottom-panels">
        <div className="record-panel">
          <div className="panel-heading"><div><span className="panel-number">03</span><strong>VOCALS / AUDIO</strong></div><span className="kit-name">INPUT 01</span></div>
          <button className={`record-button ${recording?'recording':''}`} onClick={startRecording}><span></span>{recording ? 'STOP RECORDING' : 'ARM RECORD'}</button>
          {recordingError && <div className="recording-error" role="alert">{recordingError}</div>}
          <div className="takes">
            {recordings.length===0 ? <div className="empty-state">Recorded takes will appear here.</div> : recordings.map(item=> {
              const startStep = item.startStep || 0;
              const startBar = Math.floor(startStep / STEPS);
              const startSubstep = startStep % STEPS;
              return <div className="take" key={item.id}>
                <button className="mini-play-button" onClick={() => playRecording(item)} aria-label={`Play ${item.name}`}><svg className="transport-icon play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.75c0-.7.77-1.13 1.37-.76l10.1 6.25a.9.9 0 0 1 0 1.52l-10.1 6.25A.9.9 0 0 1 8 18.25z" /></svg></button>
                <div className="take-info"><strong>{item.name}</strong><small>BAR {startBar + 1} · BEAT {Math.floor(startSubstep / 4) + 1}.{startSubstep % 4 + 1}</small></div>
                <audio controls src={item.url}></audio>
                <div className="take-position" aria-label={`Place ${item.name} in the song`}>
                  <label>BAR<select value={startBar} onChange={event => setRecordingPosition(item.id, Number(event.target.value) * STEPS + startSubstep)} aria-label={`Bar for ${item.name}`}>{Array.from({ length: bars }, (_, bar) => <option key={bar} value={bar}>{String(bar + 1).padStart(2, '0')}</option>)}</select></label>
                  <label>BEAT<select value={startSubstep} onChange={event => setRecordingPosition(item.id, startBar * STEPS + Number(event.target.value))} aria-label={`Beat and sixteenth for ${item.name}`}>{Array.from({ length: STEPS }, (_, substep) => <option key={substep} value={substep}>{Math.floor(substep / 4) + 1}.{substep % 4 + 1}</option>)}</select></label>
                  <button className="place-playhead" onClick={() => setRecordingPosition(item.id, playing ? stepRef.current : 0)} title="Place clip at the current song playhead">AT PLAYHEAD</button>
                </div>
                <button className="remove" onClick={() => removeRecording(item.id)} aria-label={`Delete ${item.name}`}>×</button>
              </div>;
            })}
          </div>
        </div>
        <div className="mixer-panel">
          <div className="panel-heading"><div><span className="panel-number">04</span><strong>MIXER</strong></div></div>
          {['DRUMS','VOCALS','MASTER'].map((name,index)=><div className="channel" key={name}><div className="meter"><i></i><i></i><i></i><i></i><i></i><i></i></div><input type="range" orient="vertical" min="0" max="100" value={index===2?master:channelVolumes[index] || 75} onChange={e => index===2 ? setMaster(Number(e.target.value)) : setChannelVolumes(values => values.map((v,i) => i===index ? Number(e.target.value) : v))} aria-label={`${name} volume`} /><span>{index===2?master:channelVolumes[index] || 75}</span><strong>{name}</strong><div className="channel-buttons"><button>M</button><button>S</button></div></div>)}
        </div>
      </section>
    </main>
    {toast && <div className="toast">{toast}</div>}
    <aside className={`feedback-dock ${showFeedback ? 'is-open' : ''}`}>
      {showFeedback && <div className="feedback-panel">
        <div className="feedback-panel-heading"><strong>FEEDBACK / BUG REPORT</strong><button onClick={() => setShowFeedback(false)} aria-label="Close feedback panel">×</button></div>
        <p>Have an idea or found a bug? Send a note to the Nightshift team.</p>
        <a href="mailto:lpo5467899@gmail.com?subject=nightshift%20studio%20feedback%20%2F%20BugReport">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.75 5.5h16.5c.69 0 1.25.56 1.25 1.25v10.5c0 .69-.56 1.25-1.25 1.25H3.75c-.69 0-1.25-.56-1.25-1.25V6.75c0-.69.56-1.25 1.25-1.25Zm.42 1.5L12 12.62l7.83-5.62H4.17Zm15.83 10V8.34l-7.56 5.42a.75.75 0 0 1-.88 0L4 8.34V17h16Z" /></svg>
          EMAIL FEEDBACK
        </a>
      </div>}
      <button className="feedback-toggle" onClick={() => setShowFeedback(value => !value)} aria-expanded={showFeedback} aria-label={showFeedback ? 'Hide feedback options' : 'Show feedback options'} title="Feedback">
        {showFeedback ? <svg className="feedback-close-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.75 5.5h16.5c.69 0 1.25.56 1.25 1.25v10.5c0 .69-.56 1.25-1.25 1.25H3.75c-.69 0-1.25-.56-1.25-1.25V6.75c0-.69.56-1.25 1.25-1.25Zm.42 1.5L12 12.62l7.83-5.62H4.17Zm15.83 10V8.34l-7.56 5.42a.75.75 0 0 1-.88 0L4 8.34V17h16Z" /></svg>}
      </button>
    </aside>
    {showIntro && <div className={`intro-screen ${logoPinned?'persistent-logo':''} ${introClosing?'is-closing':''}`} role="dialog" aria-modal="true" aria-label="Nightshift Studio logo">
      <div className="intro-grain" />
      <div className="intro-blueprint" aria-hidden="true">
        <span className="blueprint-ring ring-one" /><span className="blueprint-ring ring-two" /><span className="blueprint-ring ring-three" />
        <span className="blueprint-sweep" /><span className="blueprint-orbit orbit-wide" /><span className="blueprint-orbit orbit-tall" />
        <span className="blueprint-cross cross-one" /><span className="blueprint-cross cross-two" />
        <span className="blueprint-label label-top">NS—001 / AUDIO SYSTEMS</span>
        <span className="blueprint-label label-bottom">NIGHT FREQUENCY · 44° 08′</span>
      </div>
      <div className="intro-content">
        <div className="intro-brand-lockup">
          <div className="intro-mark-wrap"><span className="intro-mark-aura" /><StudioMark className="intro-mark-svg" /></div>
          <span className="intro-kicker">GENEB PRODUCTIONS · BETA 5.0</span>
          <h1>NIGHTSHIFT <span>STUDIO</span></h1>
          <p key={introTagline} className="intro-tagline">{introTagline}</p>
        </div>
        <div className="intro-equalizer" aria-hidden="true">
          {Array.from({ length: 42 }, (_, index) => <i key={index} style={{'--bar-index': index, '--bar-height': `${14 + ((index * 17 + index * index * 3) % 64)}%`}} />)}
        </div>
        <div className="intro-loading">
          <div className="intro-loading-copy"><span>{logoPinned?'NIGHTSHIFT STUDIO LOGO':'PREPARING YOUR SOUND SPACE'}</span><span>{logoPinned?'DISPLAY MODE':'READY WHEN YOU ARE'}</span></div>
          <div className="intro-progress"><span /></div>
          <div className="intro-footer"><span>{logoPinned?'PRESS ESC TO CLOSE':'DRUMS · KEYS · IDEAS'}</span><button onClick={closeIntro}>{logoPinned?'CLOSE LOGO':'ENTER STUDIO'} {logoPinned ? <span aria-hidden="true">×</span> : <svg className="footer-arrow-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13 13 3M5 3h8v8" /></svg>}</button></div>
        </div>
      </div>
    </div>}
    {operationLoading && <div className={`intro-screen operation-screen ${operationClosing?'is-closing':''}`} role="status" aria-live="polite" aria-busy={!operationClosing} aria-label={operationLoading.title}>
      <div className="intro-grain" />
      <div className="intro-blueprint" aria-hidden="true">
        <span className="blueprint-ring ring-one" /><span className="blueprint-ring ring-two" /><span className="blueprint-ring ring-three" />
        <span className="blueprint-sweep" /><span className="blueprint-orbit orbit-wide" /><span className="blueprint-orbit orbit-tall" />
        <span className="blueprint-cross cross-one" /><span className="blueprint-cross cross-two" />
        <span className="blueprint-label label-top">NS—001 / LIVE WORKFLOW</span>
        <span className="blueprint-label label-bottom">PLEASE KEEP THIS WINDOW OPEN</span>
      </div>
      <div className="intro-content operation-content">
        <div className="intro-brand-lockup">
          <div className="intro-mark-wrap"><span className="intro-mark-aura" /><StudioMark className="intro-mark-svg" /></div>
          <span className="intro-kicker">GENEB PRODUCTIONS · BETA 5.0 · AUDIO SYSTEMS</span>
          <h1>{operationLoading.title.split(' ')[0]} <span>{operationLoading.title.split(' ').slice(1).join(' ')}</span></h1>
          <p>{operationLoading.detail}</p>
        </div>
        <div className="intro-equalizer" aria-hidden="true">
          {Array.from({ length: 42 }, (_, index) => <i key={index} style={{'--bar-index': index, '--bar-height': `${14 + ((index * 17 + index * index * 3) % 64)}%`}} />)}
        </div>
        <div className="intro-loading">
          <div className="intro-loading-copy"><span>PROCESSING YOUR SESSION</span><span className="operation-pulse">IN PROGRESS</span></div>
          <div className="intro-progress operation-progress"><span /></div>
          <div className="intro-footer"><span>DRUMS · KEYS · IDEAS</span><span className="operation-mark"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.5v17M1.5 10h17M4 4l12 12M16 4 4 16" /></svg> RENDER ENGINE ACTIVE</span></div>
        </div>
      </div>
    </div>}
  </div>
}
export default App;
