import React, { useEffect, useRef, useState } from 'react';

const STEPS = 16;
const INITIAL_BARS = 4;
const MAX_BARS = 64;
const SONGS_STORAGE_KEY = 'nightshift-songs';
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
  const [grid, setGrid] = useState(() => initialGrid.map(row => Array.from({ length: INITIAL_BARS * STEPS }, (_, step) => row[step % STEPS])));
  const [synthGrid, setSynthGrid] = useState(() => NOTES.map(() => Array(INITIAL_BARS * STEPS).fill(false)));
  const [bpm, setBpm] = useState(124);
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [recording, setRecording] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [kit, setKit] = useState('Studio 808');
  const [instrument, setInstrument] = useState('Synth');
  const [projectName, setProjectName] = useState('Untitled Session');
  const [songId, setSongId] = useState(null);
  const [songs, setSongs] = useState([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [songsLoaded, setSongsLoaded] = useState(false);
  const [master, setMaster] = useState(82);
  const [swing, setSwing] = useState(0);
  const [bars, setBars] = useState(INITIAL_BARS);
  const [channelVolumes, setChannelVolumes] = useState([82, 78, 76, 72, 80]);
  const [muted, setMuted] = useState([]);
  const [toast, setToast] = useState('');
  const [activeKeys, setActiveKeys] = useState([]);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const stepRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const songRef = useRef({ grid, synthGrid, muted, bars });
  const instrumentRef = useRef(instrument);
  const totalSteps = bars * STEPS;

  useEffect(() => {
    try {
      const storedSongs = JSON.parse(localStorage.getItem(SONGS_STORAGE_KEY) || '[]');
      if (!Array.isArray(storedSongs)) throw new Error('Saved song library must be a list.');
      setSongs(storedSongs);
    } catch (error) {
      console.error('Could not read the saved song library.', error);
      setToast('Could not read saved songs from this browser');
    } finally {
      setSongsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!songsLoaded) return;
    try {
      localStorage.setItem(SONGS_STORAGE_KEY, JSON.stringify(songs));
    } catch (error) {
      console.error('Could not save the song library.', error);
      setToast('Could not save songs in this browser');
    }
  }, [songs, songsLoaded]);

  useEffect(() => {
    songRef.current = { grid, synthGrid, muted, bars };
  }, [grid, synthGrid, muted, bars]);

  useEffect(() => {
    instrumentRef.current = instrument;
  }, [instrument]);

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

  const stop = () => {
    clearInterval(timerRef.current); timerRef.current = null; setPlaying(false); setCurrentStep(-1); stepRef.current = 0;
  };
  const tick = () => {
    const step = stepRef.current;
    setCurrentStep(step);
    const { grid: currentGrid, synthGrid: currentSynthGrid, muted: mutedTracks, bars: songBars } = songRef.current;
    currentGrid.forEach((row, drum) => { if (row[step] && !mutedTracks.includes(drum)) triggerDrum(drum); });
    currentSynthGrid.forEach((row, note) => { if (row[step]) playNote(NOTES[note].frequency, NOTES[note].name); });
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setRecordings(items => [...items, { id: Date.now(), name: `Take ${items.length + 1}`, url: URL.createObjectURL(blob) }]);
        stream.getTracks().forEach(track => track.stop()); notify('Recording saved to takes');
      };
      mediaRecorderRef.current = recorder; recorder.start(); setRecording(true); notify('Recording started');
    } catch { alert('Microphone access is needed to record audio.'); }
  };

  const playRecording = (recordingItem) => {
    const audio = new Audio(recordingItem.url);
    audio.volume = master / 100; audio.play();
  };

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.repeat || event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      const noteIndex = NOTE_KEYS.indexOf(event.key.toLowerCase());
      if (noteIndex !== -1) playNote(NOTES[noteIndex].frequency, NOTES[noteIndex].name);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getSongData = () => ({ projectName: projectName.trim() || 'Untitled Session', grid, synthGrid, bpm, kit, instrument, swing, bars, channelVolumes, master });
  const saveSong = () => {
    const id = songId || (window.crypto?.randomUUID ? window.crypto.randomUUID() : String(Date.now()));
    const song = { id, ...getSongData(), updatedAt: new Date().toISOString() };
    setSongs(items => [song, ...items.filter(item => item.id !== id)]);
    setSongId(id);
    notify('Song saved to your library');
  };
  const loadSong = song => {
    setSongId(song.id);
    setProjectName(song.projectName || 'Untitled Session');
    const songBars = Math.min(MAX_BARS, Math.max(1, Number(song.bars) || INITIAL_BARS));
    const songLength = songBars * STEPS;
    const normalizeRows = (rows, count, fill) => Array.from({ length: count }, (_, row) => Array.from({ length: songLength }, (_, step) => rows?.[row]?.[step] ?? (rows?.[row]?.length ? rows[row][step % Math.min(rows[row].length, STEPS)] : fill)));
    setGrid(normalizeRows(song.grid, DRUMS.length, false));
    setSynthGrid(normalizeRows(song.synthGrid, NOTES.length, false));
    setBpm(song.bpm || 124);
    setKit(song.kit || 'Studio 808');
    setInstrument(song.instrument || 'Synth');
    setSwing(song.swing || 0);
    setBars(songBars);
    setChannelVolumes(song.channelVolumes || [82, 78, 76, 72, 80]);
    setMaster(song.master ?? 82);
    setShowLibrary(false);
    notify(`${song.projectName || 'Song'} loaded`);
  };
  const deleteSong = id => {
    setSongs(items => items.filter(song => song.id !== id));
    if (songId === id) setSongId(null);
    notify('Song removed from your library');
  };
  const newSong = () => {
    stop();
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
  const downloadProject = () => {
    const blob = new Blob([JSON.stringify(getSongData(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${projectName.replace(/\s+/g, '-').toLowerCase()}.nightshift.json`; link.click(); URL.revokeObjectURL(url);
  };
  const importProject = event => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.grid) || data.grid.length !== DRUMS.length || data.grid.some(row => !Array.isArray(row) || row.length < STEPS || row.length > MAX_BARS * STEPS)) throw new Error('Invalid song pattern');
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
        notify('Project imported');
      }
      catch { alert('That project file could not be read.'); }
    }; reader.readAsText(file); event.target.value = '';
  };

  const exportWav = () => {
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
    const buffer = new ArrayBuffer(44 + length*2); const view = new DataView(buffer);
    const write = (offset, text) => [...text].forEach((char,i) => view.setUint8(offset+i, char.charCodeAt(0)));
    write(0,'RIFF'); view.setUint32(4,36+length*2,true); write(8,'WAVE'); write(12,'fmt ');
    view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true);
    write(36,'data'); view.setUint32(40,length*2,true);
    for (let i=0;i<length;i++) { const sample=Math.max(-1,Math.min(1,data[i]*(master/100))); view.setInt16(44+i*2,sample<0?sample*32768:sample*32767,true); }
    const url=URL.createObjectURL(new Blob([view],{type:'audio/wav'})); const link=document.createElement('a'); link.href=url; link.download=`${projectName.replace(/\s+/g,'-').toLowerCase()}-mix.wav`; link.click(); URL.revokeObjectURL(url);
  };

  return <div className="studio">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">N</span><span>NIGHTSHIFT <b>STUDIO</b></span></div>
      <input className="project-name" value={projectName} onChange={e => setProjectName(e.target.value)} aria-label="Project name" />
      <div className="top-actions">
        <button className="icon-button save-song-button" title="Save this song in your library" onClick={saveSong}>SAVE SONG</button>
        <button className="icon-button" title="Browse saved songs" onClick={() => setShowLibrary(value => !value)}>MY SONGS ({songs.length})</button>
        <button className="icon-button" title="Start a new song" onClick={newSong}>NEW SONG</button>
        <button className="icon-button" title="Download project" onClick={downloadProject}>PROJECT</button>
        <button className="icon-button" onClick={() => fileInputRef.current.click()}>IMPORT</button>
        <input ref={fileInputRef} hidden type="file" accept=".json,.nightshift" onChange={importProject} />
        <button className="export-button" onClick={exportWav}>EXPORT WAV</button>
      </div>
    </header>

    <main className="workspace">
      <section className="transport">
        <button className={`play-button ${playing ? 'active' : ''}`} onClick={play} aria-label={playing ? 'Stop' : 'Play'}>{playing ? '■' : '▶'}</button>
        <button className="transport-button" onClick={stop} title="Stop">■</button>
        <div className="tempo"><span>TEMPO</span><input type="number" min="40" max="240" value={bpm} onChange={e => setBpm(Number(e.target.value))} /><small>BPM</small></div>
        <div className="timecode">{String(currentStep < 0 ? 1 : Math.floor(currentStep / STEPS) + 1).padStart(2,'0')} : {String(currentStep < 0 ? 1 : Math.floor((currentStep % STEPS) / 4) + 1).padStart(2,'0')}</div>
        <label className="swing-control">SWING <input type="range" min="0" max="60" value={swing} onChange={e => setSwing(Number(e.target.value))} /><span>{swing}%</span></label>
        <label className="bars-control">BARS<select value={bars} onChange={e => resizeSong(Number(e.target.value))}>{[2, 4, 8, 16, 32, 64].map(count => <option key={count} value={count}>{count}</option>)}</select></label>
        <select value={kit} onChange={e => setKit(e.target.value)}><option>Studio 808</option><option>Analog Breaks</option><option>Trap Machine</option></select>
      </section>

      {showLibrary && <section className="song-library">
        <div className="panel-heading">
          <div><span className="panel-number">LIB</span><strong>YOUR SONGS</strong><span className="library-note">Saved in this browser</span></div>
          <button className="library-close" onClick={() => setShowLibrary(false)} aria-label="Close song library">×</button>
        </div>
        {songs.length === 0
          ? <div className="library-empty">Your library is empty. Save a song to keep it here.</div>
          : <div className="song-list">{songs.map(song => <article className="song-card" key={song.id}>
            <div className="song-card-info"><strong>{song.projectName || 'Untitled Session'}</strong><span>{song.bpm || 124} BPM · {new Date(song.updatedAt || Date.now()).toLocaleDateString()}</span></div>
            <button onClick={() => loadSong(song)}>OPEN</button>
            <button className="song-delete" onClick={() => deleteSong(song.id)} aria-label={`Delete ${song.projectName || 'song'}`}>×</button>
          </article>)}</div>}
      </section>}

      <section className="sequencer-panel">
        <div className="panel-heading"><div><span className="panel-number">01</span><strong>DRUM MACHINE</strong></div><div className="pattern-tools"><select onChange={e => applyPreset(e.target.value)} defaultValue=""><option value="" disabled>Load preset</option>{Object.keys(PRESETS).map(name => <option key={name}>{name}</option>)}</select><button onClick={randomizePattern}>RANDOMIZE</button><button onClick={clearPattern}>CLEAR</button><span className="kit-name">{kit}</span></div></div>
        <div className="sequence">
          <div className="sequence-labels"><div className="label-spacer">TRACK</div>{DRUMS.map((drum,i)=><div className="track-label" key={drum.name}><span className="track-dot" style={{background:drum.color}}></span><div><strong>{drum.name}</strong><small>{drum.key}</small></div><button className={`mute-mini ${muted.includes(i)?'muted':''}`} onClick={() => toggleMute(i)}>M</button><button onClick={() => triggerDrum(i)} aria-label={`Preview ${drum.name}`}>▶</button></div>)}</div>
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
        <div className="melody-heading"><strong>PIANO ROLL</strong><span>Click cells to add or remove notes · {bars} bars</span><button onClick={() => setSynthGrid(NOTES.map(() => Array(totalSteps).fill(false)))}>CLEAR NOTES</button></div>
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
          <div className="takes">
            {recordings.length===0 ? <div className="empty-state">Recorded takes will appear here.</div> : recordings.map(item=> <div className="take" key={item.id}><button onClick={() => playRecording(item)}>▶</button><div><strong>{item.name}</strong><small>MIC / 44.1 kHz</small></div><audio controls src={item.url}></audio><button className="remove" onClick={() => setRecordings(items=>items.filter(x=>x.id!==item.id))} aria-label="Delete take">×</button></div>)}
          </div>
        </div>
        <div className="mixer-panel">
          <div className="panel-heading"><div><span className="panel-number">04</span><strong>MIXER</strong></div></div>
          {['DRUMS','VOCALS','MASTER'].map((name,index)=><div className="channel" key={name}><div className="meter"><i></i><i></i><i></i><i></i><i></i><i></i></div><input type="range" orient="vertical" min="0" max="100" value={index===2?master:channelVolumes[index] || 75} onChange={e => index===2 ? setMaster(Number(e.target.value)) : setChannelVolumes(values => values.map((v,i) => i===index ? Number(e.target.value) : v))} aria-label={`${name} volume`} /><span>{index===2?master:channelVolumes[index] || 75}</span><strong>{name}</strong><div className="channel-buttons"><button>M</button><button>S</button></div></div>)}
        </div>
      </section>
    </main>
    {toast && <div className="toast">{toast}</div>}
  </div>
}
export default App;
