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
| Native backend | Rust |
| Packaging | Tauri bundle targets: `nsis`, `msi` (Windows only) |

## Prerequisites

Install on Windows:

- Node.js 20+.
- Rust toolchain via `rustup`.
- Visual Studio Build Tools with Desktop C++.
- WebView2 Runtime.

Useful checks:

```powershell
node --version
npm --version
rustc --version
cargo --version
```

## Project Setup

```powershell
npm install
```

If you need to regenerate app icons:

```powershell
npm run tauri icon path\to\icon.png
```

## Main Commands

Run only the Vite frontend:

```powershell
npm run dev
```

Type-check and build the frontend bundle:

```powershell
npm run build
```

Run the desktop app in development:

```powershell
npm run tauri dev
```

Build Windows installers:

```powershell
npm run tauri build
```

Output:

```text
src-tauri/target/release/bundle/nsis/
src-tauri/target/release/bundle/msi/
```

Bundle visualizer:

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

Rust:

```powershell
npm run test:rust
```

Equivalent direct command:

```powershell
cd src-tauri
cargo test
```

Combined coverage:

```powershell
npm run coverage
```

Current known automatic checks:

- `npm run build`: green.
- `npm run test`: 113 frontend tests green.
- `cargo test`: 108 Rust tests green, 1 manual DLL inspection test ignored.

The ignored manual Rust test can generate a repeatable DLL for inspection:

```powershell
cd src-tauri
cargo test generate_manual_check_dll -- --ignored --nocapture
```

Output:

```text
src-tauri/target/manual-check/win-dll-packer-manual-check.dll
```

## Manual Validation Before v1

Track the authoritative checklist in [.claude/ROADMAP.MD](.claude/ROADMAP.MD).

Required manual checks:

- Remove `%TEMP%\win-dll-packer`, then verify preview recreation and cleanup behavior.
- Create mode: import icons, build DLL, reopen/inspect output.
- Edit mode: load existing DLL, modify icon list, build DLL, reopen/inspect output.
- Pipeline: validate PR CI and a pre-release tag that creates draft `.exe` and `.msi` artifacts.

## Architecture Notes

### Frontend

```text
src/
|-- assets/         <- SVG icons, flag images, logo
|-- components/
|   |-- buttons/    <- LanguageButton, ThemeButton
|   |-- dialogs/    <- ConfirmDialog
|   |-- explorer/   <- IconCollectionView, IconListView, IconGridView, MenuTab
|   |-- layout/     <- PageHeader, PageFooter
|   |-- pagination/ <- PaginationControls, PageSizeSelector
|   `-- upload/     <- FileDropZone
|-- i18n/           <- vue-i18n setup
|-- locales/        <- it, en, fr, es, de
|-- services/       <- Tauri command wrappers and notifications
|-- stores/         <- Pinia stores
|-- styles/         <- SCSS partials and main stylesheet
|-- types/          <- shared frontend types
`-- views/          <- HomeView, ItemView
```

State lives in Pinia stores. Components stay mostly presentational and call store actions or service wrappers.

### Backend

Rust entry points live in `src-tauri/src/`.

Key modules:

| Module | Responsibility |
| --- | --- |
| `icons/` | Read `.ico`/`.png`, validate, normalize target sizes, write preview PNGs, IPC types/errors. |
| `dll/read.rs` | Windows-only DLL loading and icon resource extraction. |
| `dll/write.rs` | Pure resource planning and `RT_GROUP_ICON` binary writer. |
| `dll/template.rs` | Embedded resource-only DLL template. |
| `dll/update.rs` | Windows resource update wrapper around `BeginUpdateResourceW` / `UpdateResourceW` / `EndUpdateResourceW`. |
| `dll/build.rs` | Build orchestration: copy template, write resources, replace final output. |
| `build_cache.rs` | In-memory cache that maps frontend icon ids to normalized backend icon data. |
| `lib.rs` | Tauri commands and app setup. |

Important backend behavior:

- DLL read/build code is Windows-only and returns `PlatformNotSupported` elsewhere.
- Generated DLLs are resource-only.
- `RT_ICON` resources are PNG bytes.
- Resource reads/writes are serialized through a shared lock to avoid Windows loader/resource races in parallel tests.

## Tauri Commands

Current command surface:

| Command | Purpose |
| --- | --- |
| `add_icon_source(path)` | Import `.ico`/`.png`, create preview and cache build data. |
| `load_existing_dll(path)` | Extract icons from a DLL and replace build cache. |
| `build_dll(options)` | Generate the output DLL from cached icons. |
| `remove_preview(path)` | Remove a preview file idempotently. |
| `drop_build_icon(id)` | Remove one icon from build cache. |
| `clear_build_cache()` | Clear build cache. |

## Release Workflow

GitHub Actions:

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`

Current behavior:

- CI runs on `windows-latest`.
- Node is pinned to `22.14.0`.
- CI runs frontend tests, Rust tests and frontend build.
- Release tags match `v*.*.*`.
- Release validates version alignment between tag, `package.json` and `src-tauri/tauri.conf.json`.
- Release requires non-empty `CHANGELOG.txt`.
- Release builds Windows `nsis` and `msi` bundles and creates a draft GitHub release.

Release prerequisites:

- `main` exists on the remote.
- `CHANGELOG.txt` exists and is not empty.
- Tag matches the project version, for example:

```text
tag: v0.1.0
package.json: 0.1.0
src-tauri/tauri.conf.json: 0.1.0
```

## SonarQube

Project config: [sonar-project.properties](sonar-project.properties).
Docker compose: [.docker/docker-compose.sonar.yml](.docker/docker-compose.sonar.yml).

Run the server:

```powershell
npm run docker:sonar:up
npm run docker:sonar:logs
npm run docker:sonar:down
```

Run analysis:

```powershell
npm run sonar:coverage
```

Expected report paths:

```text
coverage/lcov.info
src-tauri/target/llvm-cov/lcov.info
```

## Styling

Styling follows a simple rule: abstract repeated basics, keep component-specific CSS local.

Shared files live in:

```text
src/styles/partials/
```

Current layers:

- `_vars.scss`: CSS variables for themes.
- `_reset.scss`: minimal CSS reset.
- `_placeholders.scss`: common layout placeholders.

Components import placeholders with:

```scss
@use '@/styles/partials/placeholders' as *;
```

Use BEM naming and `is-*` state classes. No Tailwind, no CSS-in-JS.
