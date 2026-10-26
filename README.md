# Nightshift Studio

A browser-based beat and recording studio built with React and Web Audio.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. Production files can be downloaded as a bundle with:

```bash
npm run build
```

The generated files are written to `dist/` and can be hosted on any static web server.

## Features

- Editable 16th-note drum sequencer with live synthesized kits
- Up to 64 bars of editable drum and piano/synth parts
- Clickable piano keyboard with computer-keyboard note input
- Adjustable tempo and transport controls
- Microphone recording through the browser MediaRecorder API
- Mixer volume controls
- In-app song library saved in this browser
- JSON project export/import
- Full-length WAV mix export of the selected song