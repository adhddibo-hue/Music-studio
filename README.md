# Nightshift Studio

A browser-based beat and recording studio built with React and Web Audio.

## Run locally

```bash
npm install
npm run build
python3 server.py --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000`. The Python server serves the production frontend and account API together. For frontend development, run the account API and Vite in two terminals:

```bash
python3 server.py --host 0.0.0.0 --port 8000
npm run dev
```

Open the Vite URL printed by the second command. Production files are generated with:

```bash
npm run build
```

The generated files are written to `dist/`. Use `server.py` to serve them with accounts enabled; a static-only server such as `python3 -m http.server` cannot provide account sign-in or private server-side song storage.

## Features

- Editable 16th-note drum sequencer with live synthesized kits
- Up to 64 bars of editable drum and piano/synth parts
- Clickable piano keyboard with computer-keyboard note input
- Tap tempo, metronome, and C-major melody generation
- Adjustable tempo and transport controls
- Microphone recording through the browser MediaRecorder API
- Mixer volume controls
- Username/password accounts with private, server-stored song libraries
- Downloadable recovery-key files for password-free account recovery
- Opt-in public gallery for songs each owner chooses to share
- JSON project export/import
- Full-length WAV mix export of the selected song
- Large feedback and bug-report email button

## Accounts and deployment

Passwords are never stored in plaintext or reversibly encrypted. The server hashes them with PBKDF2-HMAC-SHA256 and a unique random salt. Login uses an HTTP-only, same-site session cookie; private songs are stored in SQLite and scoped to their owner. A song only appears in the public gallery after its owner explicitly publishes it, and owners can unpublish it at any time. The database is created at `data/nightshift.sqlite3` and is excluded from Git.

While signed in, use **RECOVERY KEY** to download a recovery file. Upload it from the sign-in screen to recover access without a password. Only a hash is stored on the server; generating another recovery file immediately invalidates the previous one. Treat the file like a password: anyone with it can access the account and its private songs. Store it securely and never email it. This is an app-specific recovery credential, not a device-bound WebAuthn passkey.

For a public deployment, put the server behind HTTPS and set `NIGHTSHIFT_COOKIE_SECURE=1`. Keep the SQLite data directory private and backed up. Account creation currently has no email verification or password-reset flow.