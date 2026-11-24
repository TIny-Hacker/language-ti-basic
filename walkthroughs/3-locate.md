# Point the extension at CEmu

The extension looks for CEmu in these places:

- **Windows:** `Program Files\CEmu\CEmu.exe`, `Program Files (x86)\CEmu\CEmu.exe`, `%LOCALAPPDATA%\Programs\CEmu\CEmu.exe`
- **macOS:** `/Applications/CEmu.app`, `~/Applications/CEmu.app`
- **Linux:** `/usr/bin/CEmu`, `/usr/local/bin/CEmu`, `/opt/CEmu/CEmu`, `~/Applications/CEmu`, `~/.local/bin/CEmu`
- any `CEmu` on your `PATH`

If you put it somewhere else (for example an unzipped download in `Downloads`), run **TI-BASIC: Locate CEmu Executable** and pick it. On macOS you can pick `CEmu.app` itself.

This sets `tibasic.cemu.executablePath`. It is user-wide, so you only do it once.

The extension does not search for a plain `cemu` / `Cemu.exe` because that name is also used by an unrelated Wii U emulator.
