# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-10

### Added
- Stable Baileys core with exponential-backoff auto-reconnect and correct
  `DisconnectReason` handling (only re-link on `loggedOut`).
- Dual login: QR code (terminal) and pairing code, selectable via `AUTH_METHOD`.
- Plug-and-play plugin system with auto-discovery and optional hot-reload.
- Example plugins: `ping`, `echo`, `help`, `hello` (regex pattern).
- Credentials persisted via `useMultiFileAuthState` in a git-ignored `auth/`.
- Top-level crash guards: no unhandled error in a plugin kills the process.
- Config via `.env` (`dotenv`) with `.env.example`.
- Dockerfile, `render.yaml`, CI workflow, unit tests, and syntax check.
