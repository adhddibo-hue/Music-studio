# Nightshift Studio

A browser-based beat and recording studio built with React and Web Audio. **Version 6.3**

## Getting started

```bash
npm install
npm run build
python3 -m http.server 8000 --bind 0.0.0.0 --directory dist
```

Open `http://localhost:8000`. This static-hosting option saves songs in the current browser and device.

For accounts, server-side song storage, and the public gallery, use the app server instead:

```sh
python3 server.py --host 0.0.0.0 --port 8000
```

The server serves the already-built `dist/` frontend, so run `npm run build` after frontend changes. For Vite development, start `python3 server.py --host 127.0.0.1 --port 8000` and `npm run dev` in separate terminals; the Vite dev server proxies API requests to port 8000.

## Features

- Editable 16th-note drum sequencer with live synthesized kits
- Up to 64 bars of editable drum and piano/synth parts
- Clickable piano keyboard with computer-keyboard note input
- Tap tempo, metronome, and C-major melody generation
- Adjustable tempo and transport controls
- Microphone recording with clips placeable at any bar and 16th-note step, synced to playback and WAV export
- Mixer volume controls
- Browser-local song saving and loading, with no sign-in required
- Username/password accounts with private server-side song libraries when hosted with `server.py`
- Optional public gallery for songs owners explicitly publish
- JSON project export/import
- Full-length WAV mix export of the selected song
- Large feedback and bug-report email button

## How to use it

1. **Start a track:** Press the play button to audition the default beat. Use the tempo field, tap-tempo button, metronome, swing slider, and bar selector to set a foundation.
2. **Program drums:** Click cells in the drum grid to toggle kick, snare, hats, and clap hits. Use the preset menu for a starting pattern; randomize or clear when you want a fresh pattern.
3. **Write a melody:** Choose Piano or Synth, click piano-roll cells to place notes, or generate a C-major melody. The computer keyboard keys shown on the piano can audition notes.
4. **Record audio:** Allow microphone access, record a take, then choose its bar and beat position. Press play to hear clips in the arrangement.
5. **Save and organize:** Name your project in the top bar; long names scroll while the field is idle and pause when you edit them. Use **SAVE SONG** and **MY SONGS** to keep, reopen, or delete arrangements. Visitors without an active account session save songs in that browser. Existing signed-in sessions use their private account library.
6. **Share intentionally:** In the server-backed library, use **PUBLISH** to put a song in the public gallery. **UNPUBLISH** removes it. Songs are private until the owner publishes them.
7. **Export or move a project:** **PROJECT** downloads an editable `.nightshift.json` file; **IMPORT** loads one. **EXPORT WAV** renders the arrangement to audio. Keep separate backups of important projects.
8. **Recovery and help:** Account sign-in and recovery are temporarily unavailable to visitors without an active session. Existing signed-in users can click **RECOVERY KEY** in the top bar to save their recovery file securely. Never email a password or recovery key.

## Accounts and privacy

Sign-in and registration are temporarily bypassed for visitors without an active account session, so they can open the studio immediately. Their songs are saved only in that browser. Existing signed-in sessions continue to use their private server library; signing out returns to browser-local mode. Account registration and recovery are unavailable from the UI during this temporary bypass. Account passwords are stored as salted PBKDF2 hashes, and account data is stored in `data/nightshift.sqlite3`, which is excluded from Git.

Shared test-account mode is off by default. To temporarily bypass sign-in and let all visitors share the `GB3` library, run `NIGHTSHIFT_SHARED_TEST_ACCOUNT=1 python3 server.py --host 0.0.0.0 --port 8000`. Everyone can view, change, publish, and delete songs in that library; do not use this mode for private deployments.

For HTTPS reverse proxies, forward `X-Forwarded-Proto` and `X-Forwarded-Host` to the app server. Configure the proxy to overwrite these headers rather than pass through visitor-supplied values. Alternatively set `NIGHTSHIFT_PUBLIC_SCHEME=https` and `NIGHTSHIFT_COOKIE_SECURE=1`.

## Beta notes

This is a beta release. Keep project exports and database backups for important work. Browser-local libraries are tied to the browser/device; server accounts require the Python app server and are not provided by `python3 -m http.server`.

## License

The original Nightshift Studio project is licensed by **GeneB Productions** under the terms in [`LICENSE`](./LICENSE). Third-party libraries and assets remain under their respective licenses.