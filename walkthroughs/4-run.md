# Run a program

1. Open a TI-BASIC file (`.tib`, `.8xp.txt`, ...).
2. Press **F5**, or run **TI-BASIC: Compile Active File and Run in CEmu**.

The extension compiles the file to an `.8xp` in your `build` folder (change with `tibasic.build.outputDir`) and starts CEmu with the program sent and launched:

```
CEmu [--rom <your ROM>] --send build/NAME.8xp --launch NAME
```

The program name is the file name, upper-cased, letters and digits only, at most 8 characters, starting with a letter.

## The CEmu panel

**TI-BASIC: Open CEmu Calculator** opens a panel beside your editor showing what was found (CEmu executable, ROM), with buttons to download, locate, launch, or run the active file.

If a WebAssembly build of CEmu is bundled in `media/cemu` and `tibasic.cemu.mode` is `embedded`, the same command opens the calculator screen inside VS Code instead.

## Settings

| Setting | Purpose |
| --- | --- |
| `tibasic.cemu.executablePath` | Native CEmu to launch (empty = auto-detect) |
| `tibasic.cemu.romPath` | ROM passed with `--rom` (optional for native CEmu) |
| `tibasic.cemu.mode` | `auto`, `external` or `embedded` |
| `tibasic.build.outputDir` | Where `.8xp` files are written |
