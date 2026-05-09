# Development

Technical notes for working on **Win DLL Packer**. End-user instructions live in [README.md](README.md).

## Stack

| Layer | Choice |
| --- | --- |
| Desktop shell | Tauri 2 |
| Frontend | Vue 3 + TypeScript |
| State | Pinia |
| Build | Vite |
| Styling | SCSS, shared partials, CSS variables |
| i18n | vue-i18n (`it`, `en`, `fr`, `es`, `de`) |
| Native backend | Rust (not yet implemented — see roadmap) |
| Packaging | Tauri bundle targets: `nsis`, `msi` (Windows only) |

## Prerequisites

### Windows host development

Install:

- Node.js 20+
- Rust toolchain (`rustup`) — required only when working on `src-tauri/`
- Visual Studio Build Tools with Desktop C++ — required for Rust/Tauri compilation
- WebView2 Runtime — bundled by the NSIS installer for end users

Useful checks:

```powershell
node --version
npm --version
rustc --version
cargo --version
```

## Project setup

```powershell
npm install
```

If you need to regenerate app icons:

```powershell
npm run tauri icon path\to\icon.png
```

## Main commands

Run only the Vite frontend (no Tauri, no Rust required):

```powershell
npm run dev
```

Type-check + build the frontend bundle:

```powershell
npm run build
```

Run the desktop app in development (requires Rust toolchain):

```powershell
npm run tauri dev
```

Build the Windows installer:

```powershell
npm run tauri build
```

The local Windows installer is generated under:

```text
src-tauri/target/release/bundle/nsis/
src-tauri/target/release/bundle/msi/
```

Bundle visualizer (outputs `dist/stats.html`):

```powershell
npm run analyze
```

## Tests

Frontend:

```powershell
npm run test
npm run test:watch
npm run test:coverage
```

Run a single spec file:

```powershell
npx vitest run tests/frontend/stores/project.spec.ts
```

Filter by test name:

```powershell
npx vitest run -t "adds files"
```

Rust (only once `src-tauri/` is implemented — currently stale):

```powershell
npm run test:rust
npm run test:rust:coverage
```

Combined coverage:

```powershell
npm run coverage
```

Current frontend testing stack:

- Vitest
- Vue Test Utils
- happy-dom

Frontend tests live in:

```text
tests/frontend/
```

Rust tests will live in:

```text
src-tauri/src/tests/
```

## SonarQube

Project config: [sonar-project.properties](sonar-project.properties).
Docker compose: [.docker/docker-compose.sonar.yml](.docker/docker-compose.sonar.yml) (image `sonarqube:community`, container `dll-packer-sonarqube`, exposed on port `9000`).

### Run the SonarQube server (Docker)

```powershell
npm run docker:sonar:up      # start in background
npm run docker:sonar:logs    # follow logs
npm run docker:sonar:down    # stop
```

Web UI at `http://localhost:9000`.

### Run the analysis

Generate coverage and run the scanner in one shot:

```powershell
npm run sonar:coverage
```

Run the scanner only (assumes coverage reports already exist):

```powershell
npm run sonar
```

Expected report paths picked up by the scanner:

```text
coverage/lcov.info
src-tauri/target/llvm-cov/lcov.info
```

## Release workflow

GitHub Actions release workflow lives in:

```text
.github/workflows/release.yml
```

Current behavior:

- triggers on tags matching `v*.*.*`
- runs frontend tests, Rust tests, and a frontend build smoke check first
- verifies that the tag version matches `package.json` and `src-tauri/tauri.conf.json`
- builds Windows bundles on `windows-latest`
- uploads artifacts and creates a draft GitHub release
- uses `CHANGELOG.txt` as the release notes body
- clears `CHANGELOG.txt` on `main` after a successful release

Known issues to fix before first release (roadmap sez. 5):

- `test` job runs on `ubuntu-22.04` but Rust DLL tests use Windows-only APIs — move to `windows-latest` or gate with `#[cfg(target_os = "windows")]`
- `build` matrix includes `macos-latest` and `ubuntu-22.04` — remove, Windows only
- No `ci.yml` workflow for push/PR — add lint, type-check, vitest, cargo test
- Node version pinned to major `20` — pin to exact version for reproducible builds

Release prerequisites:

- `main` must exist on the remote (workflow pushes changelog cleanup commit there)
- `CHANGELOG.txt` must exist and must not be empty
- tag must match the project version, for example:

```text
tag: v0.1.0
package.json: 0.1.0
src-tauri/tauri.conf.json: 0.1.0
```

## Architecture notes

### Frontend

```text
src/
├── assets/         ← SVG icons, flag images, logo
├── components/
│   ├── HomeView.vue
│   ├── ItemView.vue
│   ├── buttons/    ← LanguageButton, ThemeButton
│   ├── common/     ← FileDropZone, PaginationControls, PageSizeSelector, ConfirmDialog
│   ├── explorer/   ← IconCollectionView, IconListView, IconGridView, MenuTab
│   └── layout/     ← PageHeader, PageFooter
├── i18n/           ← vue-i18n setup, SUPPORTED_LOCALES, setLocale helper
├── locales/        ← it.json, en.json, fr.json, es.json, de.json
├── services/
│   └── notifications.ts   ← wrapper @tauri-apps/plugin-notification
├── stores/
│   ├── project.ts  ← mode, icons, selection, pagination, build state
│   └── settings.ts ← language, theme, viewMode, pageSize + localStorage persistence
├── styles/         ← main.scss + partials (_vars, _reset, _placeholders)
└── types/
    └── Project.ts  ← ProjectIcon, ProjectMode, IconSize, BuildState, BuildOptions
```

State lives entirely in Pinia stores. Components are presentation-only and emit events up.

### Backend (not yet implemented)

Rust entry points will be in `src-tauri/src/`. The current content of `src-tauri/` is carried over from a previous project and should not be used as reference. See roadmap sections 1-4 for the planned implementation.

## Styling

Styling follows a simple rule: abstract repeated basics, keep component-specific CSS local.

Shared files live in:

```text
src/styles/partials/
```

Current layers:

- `_vars.scss` — CSS variables for theme colors/shadows/filters, defined for both `[data-theme="light"]` and `[data-theme="dark"]`
- `_reset.scss` — minimal CSS reset
- `_placeholders.scss` — `%fx_center`, `%fx_between_center`, `%fx_start_center`, `%fx_inline_center`, `%grid_stack`, `%grid_center`, `%visually_hidden`, `%header_control`

Components import placeholders with:

```scss
@use '@/styles/partials/placeholders' as *;
```

Use BEM naming (`block__element--modifier`) and `is-*` state classes. No Tailwind, no CSS-in-JS.
