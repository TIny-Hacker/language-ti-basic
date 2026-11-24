# Run a program

1. Open a TI-BASIC file.
2. Press **F5**, or run **TI-BASIC: Compile Active File and Run in CEmu**.

The file is compiled to an `.8xp` in your `build` folder (`tibasic.build.outputDir`). The sidebar calculator restarts clean, receives the program, and runs it from the PRGM menu. With native CEmu the equivalent command is:

```
CEmu [--rom <your ROM>] --send build/NAME.8xp --launch NAME
```

The program name is the file name upper-cased, letters and digits only, at most 8 characters, starting with a letter.

## Settings

| Setting | Purpose |
| --- | --- |
| `tibasic.cemu.mode` | `auto` (embedded if available, else native), `embedded`, `external` |
| `tibasic.cemu.romPath` | Your ROM image |
| `tibasic.cemu.executablePath` | Native CEmu to launch (empty = auto-detect) |
| `tibasic.build.outputDir` | Where `.8xp` files are written |
