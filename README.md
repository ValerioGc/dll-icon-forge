# WIN DLL PACKER

Early desktop tool for creating and editing Windows resource-only `.dll` files used as icon libraries, built with Tauri, Vue, and Rust.

This is still a prototype. The frontend (project setup, drag and drop, preview list, theme and i18n) is in place; the Rust backend that actually reads and writes DLLs is not implemented yet. Expect rough edges and missing features.

Roadmap, architecture notes, testing, and SonarQube are documented in [.claude/ROADMAP.MD](.claude/ROADMAP.MD) and [CLAUDE.md](CLAUDE.md).

![Win DLL Packer screenshot](docs/screenshots/app-main.png)

## Current status

- Frontend create/edit flow is working with mock validation
- Real DLL read/write is not implemented yet (Rust backend is a placeholder)
- Windows is the only target planned for v1; macOS and Linux are out of scope
- The project is usable as a UI preview, but cannot yet produce a real `.dll`

## Current features

- Create mode: import `.ico` and `.png` files via drag and drop or file picker
- Edit mode: load an existing project/DLL file before unlocking icon controls (mock only)
- Reusable drop zone shared between source file and icons
- Icon preview list with selection and per-item delete
- Toolbar with delete action (disabled when the list is empty)
- Header with logo, language toggle, and theme toggle
- Footer with app version and GitHub link
- Dark and light theme with persistent preference
- Italian and English UI
- Native Windows notifications wired to the submit flow (placeholder)

## Planned features

- Real DLL generation from imported icons (`RT_GROUP_ICON` + `RT_ICON`)
- Real DLL read in edit mode, with extraction of existing icons
- List/grid view with pagination and configurable items per page
- `ProjectIcon` model independent from source file metadata
- Native open/save dialogs via Tauri
- JPG and BMP support after ICO/PNG is stable
- Project save/load as JSON with schema versioning
- Confirmation prompts and unsaved-changes guard
- GitHub Actions release pipeline for Windows installers

## Requirements

- Windows 10 or 11 (64-bit)
- The icons you want to pack (`.ico` or `.png` for v1)

For development:

- Node.js 20+
- Rust toolchain (`rustup`) — required only when the Rust backend is implemented

## Installation

Installer is not yet published. Once the release pipeline (roadmap sez. 12) is in place:

1. Download the latest installer from Releases:
   `Win DLL Packer_<version>_x64-setup.exe`
2. Run the installer.
3. Launch **Win DLL Packer** from the Start menu.

## Quick start

1. Install Win DLL Packer
2. Open the app and choose **Create**
3. Drag your `.ico` / `.png` files into the drop zone
4. Review the preview list and remove what you don't need
5. Click **Build DLL** to generate the resource-only `.dll`

To start from an existing DLL or project, choose **Edit** instead and load the source file first.

## First run

By default the app does not require any external service. All work happens locally on the machine.

When no project is open, the home screen lets you choose between **Create** (start from scratch) and **Edit** (open an existing DLL or project file).

## Data storage

Win DLL Packer stores app data locally on your machine.

### Settings

Theme and language are persisted in the browser-side `localStorage` of the WebView under the key:

```text
win-dll-packer:settings
```

### Project files

Generated `.dll` files and saved project files (planned, see roadmap sez. 8) are written to the path the user chooses through the save dialog. The app does not maintain a private project library.

## Privacy

Win DLL Packer runs entirely offline. No telemetry, no cloud calls, no third-party services. Files you import never leave your machine.

## Known limitations

- Real DLL read and write are not implemented yet
- Only `.ico` and `.png` are accepted for v1
- The "Edit" source file is currently accepted without validation (any dropped file is treated as the source)
- No confirmation prompt on destructive actions (delete, clear, mode switch with unsaved changes) — planned in roadmap sez. 7 and 11
- Windows is the only supported target

## Keyboard shortcuts

No custom shortcuts are bound yet. Standard browser/WebView shortcuts apply (`Tab` for focus, `Enter` to activate the focused button, `Esc` to dismiss native dialogs when implemented).

## License

The project is released under **The Unlicense**. See [LICENCE](LICENCE).
