# Development

Technical notes for working on **DLL Icon Forge**. Product-facing information lives in [README.md](README.md).

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
| Packaging | Tauri bundle targets: `nsis`, `msi` (Windows) |

## Prerequisites

Install on Windows:

- Node.js `22.14.0` recommended, 20+ minimum.
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

If you need to regenerate app icons from a square PNG or SVG source:

```powershell
npm run tauri icon path\to\app-icon.svg
```

The command rewrites the generated assets under `src-tauri/icons/`. The web favicon used by Vite is configured separately in `index.html`.

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
- `npm run test`: 151 frontend tests green.
- `cargo test`: 128 Rust tests green, 1 manual DLL inspection test ignored.

The ignored manual Rust test can generate a repeatable DLL for inspection:

```powershell
cd src-tauri
cargo test generate_manual_check_dll -- --ignored --nocapture
```

Output:

```text
src-tauri/target/manual-check/dll-icon-forge-manual-check.dll
```

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
| `icons/` | Read `.ico`/`.png`/`.jpg`/`.webp`/`.svg`, validate, normalize target sizes, write preview PNGs, IPC types/errors. |
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
| `add_icon_source(path)` | Import `.ico`/`.png`/`.jpg`/`.webp`/`.svg`, create preview and cache build data. |
| `load_existing_dll(path)` | Extract icons from a DLL and replace build cache. |
| `build_dll(options)` | Generate the output DLL from cached icons. |
| `remove_preview(path)` | Remove a preview file idempotently. |
| `drop_build_icon(id)` | Remove one icon from build cache. |
| `clear_build_cache()` | Clear build cache. |

## Release Workflow

A single workflow file handles everything:

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `.github/workflows/ci.yml` | push tag matching `v*.*.*` | Validate, build installers, and publish a GitHub release. |

The workflow pins Node.js to `22.14.0`, installs dependencies with `npm ci`, sets up the stable Rust toolchain, and caches Rust dependencies for the `src-tauri` workspace.
A GitHub Actions concurrency group per tag ensures a newer run for the same tag cancels an older in-progress run.

### Release Pipeline

The pipeline is tag-driven and split into four jobs:

1. `test` runs on `windows-latest`: Rust fmt/clippy checks, frontend tests, Rust tests, frontend build.
2. `verify-release` runs on `ubuntu-latest`: validates the semantic version tag, confirms the tagged commit is reachable from `main`, checks that `package.json`, `tauri.conf.json` and the tag all share the same version, and verifies `CHANGELOG.txt` is present and non-empty.
3. `build-windows` runs on `windows-latest`: builds Tauri bundles, collects the NSIS `.exe` and MSI `.msi` installers, and uploads them as the `windows-installers` artifact.
4. `create-release` runs on `ubuntu-latest`: downloads `windows-installers`, computes `SHA256SUMS.txt`, builds `release-notes.md` from `CHANGELOG.txt`, and publishes the GitHub release with all assets attached.

Release validation checks:

- The workflow trigger accepts tags matching `v*.*.*`, then a stricter regex allows only semantic tags such as `v1.2.3` or `v1.2.3-rc.1`.
- The tag must point to a commit already included in remote `main`.
- The tag version, `package.json` version, and `src-tauri/tauri.conf.json` version must match.
- `CHANGELOG.txt` must exist and must not be empty.
- The Tauri build must produce at least one NSIS `.exe` and one MSI `.msi`.
- `SHA256SUMS.txt` is generated from the release assets and attached to the draft release.

Version alignment example:

```text
tag: v0.1.0
package.json: 0.1.0
src-tauri/tauri.conf.json: 0.1.0
```

Local release checklist:

```powershell
npm ci
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
npm run test
npm run test:rust
npm run build
npm run tauri build
```

Expected installer outputs:

```text
src-tauri/target/release/bundle/nsis/*.exe
src-tauri/target/release/bundle/msi/*.msi
release-assets/SHA256SUMS.txt
```

Tag and publish the release candidate:

```powershell
git checkout main
git pull origin main
git push origin main
git tag v0.1.0
git push origin v0.1.0
```

The GitHub release is created as a draft. The current workflow names the draft release `DLL Icon Forge <tag>` and prepends `# DLL Icon Forge <tag>` to the generated release notes.

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

