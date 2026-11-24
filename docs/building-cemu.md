# Building CEmu from source

**Most people should not do this.** Prebuilt Windows, macOS and Linux binaries are on https://github.com/CE-Programming/CEmu/releases (use the *nightly* for current features). Build from source only if there is no binary for your platform or you want a custom build.

This page summarises the upstream wiki page *Building CEmu* and CEmu's own CI workflow. If anything differs, the upstream wiki wins: https://github.com/CE-Programming/CEmu/wiki/Building-CEmu

Note:
I haven't updated this md, I pulled CEmu personally and had to add a layer for interop, so DO NOT just pull it from the github unless you wanna have a bad time fixing the interop

## 1. Get the source

Submodules are required:

```
git clone --recursive https://github.com/CE-Programming/CEmu.git
cd CEmu
```

## 2. Install prerequisites

- A C/C++ compiler (MSVC on Windows, Xcode command line tools on macOS, gcc/clang on Linux)
- CMake (and Ninja is convenient)
- Qt 6 (Qt 5 also works)
- On Linux, the libraries CEmu's CI installs on Ubuntu:

```
sudo apt install -y cmake ninja-build libarchive-dev libzstd-dev zlib1g-dev \
    libgl1-mesa-dev nettle-dev libacl1-dev liblz4-dev libc6-dev libusb-1.0-0-dev
```

(`libusb-1.0-0-dev` was added to the CI later than the others; install it if the build asks for it.)

## 3. Build libpng-apng

CEmu records the screen as animated PNG, which needs a patched libpng. From the source tree:

```
cd gui/qt/capture
./get_libpng-apng.sh
cd ../../..
```

On Windows this needs extra manual steps (patching and building libpng); follow the wiki page *Building libpng apng*. The CMake + vcpkg route below can avoid this.

## 4. Build CEmu

### Option A: CMake (what CEmu's CI uses)

```
mkdir build && cd build
cmake -GNinja -DCMAKE_BUILD_TYPE=Release ../gui/qt
cmake --build .
```

The binary is `build/CEmu` (`CEmu.exe` on Windows).

### Option B: CMake with vcpkg (preferred upstream, easiest on Windows)

Install [vcpkg](https://github.com/microsoft/vcpkg) and set `VCPKG_ROOT`, then from `gui/qt`:

```
cmake -G Ninja --preset Linux-x64-Qt6 -DDEPS_RELEASE_ONLY=ON
```

Use the preset that matches your OS and Qt version (list them with `cmake --list-presets`). `-DDEPS_RELEASE_ONLY=ON` avoids building debug copies of every dependency. If CMake says it cannot find `scripts/buildsystems/vcpkg.cmake`, `VCPKG_ROOT` is not set correctly.

### Option C: qmake

```
cd gui/qt
qmake -r CEmu.pro && make
```

`qmake` must be on your `PATH` (e.g. `export PATH=<Qt dir>/bin:$PATH`), and `pkg-config` must be installed. If the build fails with `lto-wrapper failed`, remove the `-flto` option in `CEmu.pro` and rebuild. You can also open `CEmu.pro` in Qt Creator and press Build.

## 5. Point the extension at it

Run **TI-BASIC: Locate CEmu Executable** and select the binary you built (or set `tibasic.cemu.executablePath`).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Could not find toolchain file ... vcpkg.cmake` | Set `VCPKG_ROOT` to your vcpkg checkout |
| CMake cannot find Ninja | Install Ninja or drop `-G Ninja` |
| Linux binary needs a newer glibc | Prebuilt Qt6 Linux binary needs glibc 2.28+; build locally instead |
| macOS: CEmu will not start from Qt Creator | Run the built app from Finder or Terminal |

## Building the embedded (WebAssembly) calculator

The sidebar calculator needs two files in `media/cemu/`: `cemu.js` and `cemu.wasm`. They are an Emscripten build of CEmu's core exposing the C functions listed at the top of `media/cemu/adapter.js` (`emu_create`, `emu_load_rom`, `emu_send_file`, `emu_power_on`, `emu_run_cycles`, `emu_set_key`, `emu_framebuffer`, ...), as a `MODULARIZE` module named `createCEmu` with `cwrap` and `HEAPU8` exported.

CEmu's own `core/emscripten.mk` builds a different, standalone web port, so it does not match `adapter.js` as-is; either adapt `adapter.js`'s `bind()` to that port's exports or build a wrapper that provides the functions above. Without these two files the extension automatically falls back to native CEmu.

CEmu is GPLv3. If you redistribute a build, include its license and a pointer to the source it was built from.
