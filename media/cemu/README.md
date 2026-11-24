# Embedded CEmu (WebAssembly)

The sidebar calculator runs when `cemu.js` and `cemu.wasm` are present in this folder. If they are missing the sidebar shows a setup page and programs run in native CEmu instead.

Expected build: an Emscripten module (`MODULARIZE`, `EXPORT_NAME=createCEmu`, runtime methods `cwrap` and `HEAPU8`) exporting the C functions documented at the top of `adapter.js`. Only `bind()` in `adapter.js` needs to change if your build differs. See `docs/building-cemu.md`.

Never bundle a ROM. CEmu is GPLv3; ship its license with any build you redistribute.
