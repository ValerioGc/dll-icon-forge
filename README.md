# DLL Icon Forge

<p align="center">
  <img src="src/assets/logo.svg" alt="DLL Icon Forge logo" width="120">
</p>

DLL Icon Forge is a Windows desktop app for creating and editing icon library DLLs.

It helps you collect `.ico` and `.png` files, preview them, organize the icon list, and generate a resource-only `.dll` that can be used as a Windows icon library. Existing DLLs can also be opened, inspected, adjusted, and rebuilt into a new output file.

![DLL Icon Forge screenshot](docs/app-main.png)

## What It Does

- Creates new icon DLL libraries from `.ico` and `.png` files.
- Opens existing icon DLLs and extracts readable icon groups.
- Lets you review icons in list or grid view.
- Supports selecting and removing icons before saving.
- Generates Windows resource-only DLL files with icon resources.
- Uses native open/save dialogs for choosing source files and output paths.
- Shows success, warning, and error notifications.
- Supports light and dark themes.
- Supports Italian, English, French, Spanish, and German.

## How It Works

### Create A New DLL

1. Choose **Create** from the home screen.
2. Add one or more `.ico` or `.png` files.
3. Review the previews and remove anything you do not want to include.
4. Generate the DLL.
5. Choose where to save the output `.dll`.

### Edit An Existing DLL

1. Choose **Edit** from the home screen.
2. Select an existing `.dll`.
3. Review the icons extracted from the file.
4. Remove icons or add new `.ico` / `.png` files.
5. Generate a new DLL and choose the output path.

The original DLL is not modified in place. DLL Icon Forge always writes the result to the output path you choose.

## Supported Files

Input files:

- `.ico`
- `.png`
- existing `.dll` files containing icon resources

Output:

- resource-only `.dll` icon libraries

## Privacy

DLL Icon Forge runs locally on your machine. Files you import are processed offline and are not uploaded anywhere. The app does not include telemetry or cloud services.

## Current Limitations

- Input image formats for now are limited to `.ico` and `.png`.
- Generated DLLs are icon libraries only.
- Non-icon resources from existing DLLs are not preserved.

## Planned Improvements

- Better handling of large icon collections.
- More detailed warnings when an icon group cannot be read from an existing DLL.
- More advanced icon inspection and editing tools.
- Portable version

## License

The project is released under **The Unlicense**. See [LICENCE](LICENCE).
