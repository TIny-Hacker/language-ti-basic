# Optional: use native CEmu

Native CEmu runs in its own window (it cannot be placed inside VS Code), but it is the full-featured emulator with a debugger. **You do not need to build it.** Prebuilt binaries for Windows, macOS and Linux are at:

https://github.com/CE-Programming/CEmu/releases

Use the Qt6 build for your OS. The stable release is old; the nightly is current.

The extension finds CEmu in standard locations automatically (`Program Files\CEmu` on Windows, `/Applications/CEmu.app` on macOS, `/usr/bin/CEmu` and similar on Linux, or `CEmu` on `PATH`). Otherwise run **TI-BASIC: Locate CEmu Executable** and pick it; on macOS you can pick `CEmu.app`.

Set `tibasic.cemu.mode` to `external` to always use it. The extension does not search for a plain `cemu` / `Cemu.exe`, since that name is also an unrelated Wii U emulator.
