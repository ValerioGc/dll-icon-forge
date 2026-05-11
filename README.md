# Win DLL Packer

Desktop tool for creating and editing Windows resource-only `.dll` files used as icon libraries, built with Tauri, Vue, and Rust.

The app works locally: it imports `.ico` and `.png` files, reads existing icon DLLs, generates resource-only DLLs, and writes the output path chosen through the native save dialog.

Roadmap and final validation checklist live in [.claude/ROADMAP.MD](.claude/ROADMAP.MD). Development notes live in [DEVELOPMENT.md](DEVELOPMENT.md).

![Win DLL Packer screenshot](docs/screenshots/app-main.png)

## Current Status

- Create mode is wired to the Rust backend and can generate a real `.dll`.
- Edit mode can load an existing DLL, extract readable icon groups, and rebuild to a new DLL.
- Windows is the only supported target for v1.
- CI and release workflows are configured and still need final validation with a PR and pre-release tag.

## Features

- Create mode: import `.ico` and `.png` files via drag and drop or native file picker.
- Edit mode: load an existing `.dll` and extract icon resources.
- Native dialogs for opening icons, opening DLLs, and saving generated DLLs.
- Resource-only DLL generation using `RT_GROUP_ICON` and `RT_ICON`.
- PNG-backed icon resources for 16, 32, 48 and 256 px sizes.
- Icon preview list/grid with selection and delete actions.
- Temporary backend preview files shown through Tauri asset protocol.
- Cleanup for preview files and build cache.
- Dirty-state guard before leaving or closing with unsaved changes.
- Dark/light theme and UI language support for Italian, English, French, Spanish and German.
- Windows notifications for success, warnings and errors.

## Requirements

- Windows 10 or 11, 64-bit.
- Input icons in `.ico` or `.png` format.

For development:

- Node.js 20+.
- Rust toolchain via `rustup`.
- Visual Studio Build Tools with Desktop C++.
- WebView2 Runtime.

## Installation

Installer packages are produced by the release workflow and are expected as:

```text
Win DLL Packer_<version>_x64-setup.exe
Win DLL Packer_<version>_x64_en-US.msi
```

Until the first public release is validated, build locally with:

```powershell
npm install
npm run tauri build
```

Installer artifacts are generated under:

```text
src-tauri/target/release/bundle/nsis/
src-tauri/target/release/bundle/msi/
```

## Quick Start

### Create A New DLL

1. Open the app and choose **Create**.
2. Add `.ico` or `.png` files.
3. Review previews and remove anything you do not want.
4. Click **Build DLL**.
5. Choose the output `.dll` path in the save dialog.

### Edit From An Existing DLL

1. Open the app and choose **Edit**.
2. Load an existing `.dll`.
3. Review extracted icons.
4. Remove icons or add new `.ico` / `.png` files.
5. Click **Build DLL** and choose a new output path.

The app writes a new DLL. It does not modify the original DLL in place.

## Data Storage

Theme and language are stored in WebView `localStorage` under:

```text
win-dll-packer:settings
```

Temporary previews are stored under:

```text
%TEMP%\win-dll-packer
```

Generated DLLs are written only to the path selected in the save dialog. The app does not keep a project library and does not persist sessions between runs.

## Privacy

Win DLL Packer runs entirely offline. Files you import never leave your machine. There is no telemetry and no cloud service.

## Known Limitations

- Windows only for v1.
- Input formats are limited to `.ico` and `.png`.
- Generated DLLs are resource-only icon libraries.
- Existing DLLs are rebuilt into a new output DLL; non-icon resources are not preserved in v1.
- Session persistence and advanced image editing are out of scope for v1.

## Verification

Current automatic checks:

```powershell
npm run build
npm run test
cd src-tauri
cargo test
```

Manual tests still tracked in the roadmap:

- temporary folder removal / preview recreation
- CI/release pipeline validation

## License

The project is released under **The Unlicense**. See [LICENCE](LICENCE).
