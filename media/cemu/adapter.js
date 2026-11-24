/* eslint-env browser */
/*
 * CEmuAdapter: the only file that talks to the CEmu WebAssembly build.
 *
 * It expects an Emscripten module (MODULARIZE, EXPORT_NAME=createCEmu) saved next to this file as
 * cemu.js / cemu.wasm, exporting `cwrap` and `HEAPU8` as runtime methods plus these C functions:
 *
 *   emu_create() -> Emu*                      emu_destroy(Emu*)
 *   emu_load_rom(Emu*, data*, len) -> int     emu_power_on(Emu*)
 *   emu_send_file(Emu*, data*, len) -> int    emu_run_cycles(Emu*, cycles) -> int
 *   emu_set_key(Emu*, row, col, down)         emu_framebuffer(Emu*) -> pointer to 320x240 RGBA8888
 *
 * That is the shape of the emu.h wrapper used by the ti84ce project around CEmu's core. CEmu itself does
 * not ship a stable embeddable web API, so if your build differs, change only the `bind()` function and
 * the FORMAT constants below.
 */
window.CEmuAdapter = (() => {
    const WIDTH = 320;
    const HEIGHT = 240;
    const CYCLES_PER_MS = 48000; // the CE's eZ80 runs at 48 MHz

    // [row, col] in the keypad matrix: row = keypadc.h kb_Data group, col = bit index.
    const KEYS = {
        graph: [1, 0], trace: [1, 1], zoom: [1, 2], window: [1, 3], yequ: [1, 4], '2nd': [1, 5], mode: [1, 6], del: [1, 7],
        sto: [2, 1], ln: [2, 2], log: [2, 3], square: [2, 4], recip: [2, 5], math: [2, 6], alpha: [2, 7],
        '0': [3, 0], '1': [3, 1], '4': [3, 2], '7': [3, 3], comma: [3, 4], sin: [3, 5], apps: [3, 6], xvar: [3, 7],
        dot: [4, 0], '2': [4, 1], '5': [4, 2], '8': [4, 3], lparen: [4, 4], cos: [4, 5], prgm: [4, 6], stat: [4, 7],
        chs: [5, 0], '3': [5, 1], '6': [5, 2], '9': [5, 3], rparen: [5, 4], tan: [5, 5], vars: [5, 6],
        enter: [6, 0], add: [6, 1], sub: [6, 2], mul: [6, 3], div: [6, 4], power: [6, 5], clear: [6, 6],
        down: [7, 0], left: [7, 1], right: [7, 2], up: [7, 3]
    };

    // Key that produces each letter after pressing [alpha].
    const LETTER_KEYS = {
        A: 'math', B: 'apps', C: 'prgm', D: 'recip', E: 'sin', F: 'cos', G: 'tan', H: 'power', I: 'square',
        J: 'comma', K: 'lparen', L: 'rparen', M: 'div', N: 'log', O: '7', P: '8', Q: '9', R: 'mul',
        S: 'ln', T: '4', U: '5', V: '6', W: 'sub', X: 'sto', Y: '1', Z: '2'
    };

    let M;
    let emu = 0;
    let fn;
    const image = new ImageData(WIDTH, HEIGHT);

    function bind() {
        fn = {
            create: M.cwrap('emu_create', null, []),
            loadRom: M.cwrap('emu_load_rom', 'number', ['number', 'number']),
            sendFile: M.cwrap('emu_send_file', null, ['number', 'number']),
            powerOn: M.cwrap('emu_power_on', null, []),
            run: M.cwrap('emu_run_cycles', null, ['number']),
            setKey: M.cwrap('emu_set_key', null, ['number', 'number', 'number']),
            framebuffer: M.cwrap('emu_framebuffer', 'number', []),
            sendFile: M.cwrap('emu_send_file', 'number', ['number', 'number'])
        };
    }

    function withBytes(bytes, cb) {
        const ptr = M._malloc(bytes.length);
        try {
            M.HEAPU8.set(bytes, ptr);
            return cb(ptr, bytes.length);
        } finally {
            M._free(ptr);
        }
    }

    return {
        WIDTH,
        HEIGHT,
        LETTER_KEYS,

        /** Load the WASM module once. */
        async load() {
            if (M) { return; }

            if (typeof createCEmu !== 'function') {
                throw new Error('cemu.js not found in media/cemu (see media/cemu/README.md for the CEmu WASM build).');
            }

            const base = window.CEMU_BASE.endsWith('/')
                ? window.CEMU_BASE
                : window.CEMU_BASE + '/';

            console.log('[CEmu] Base URL:', base);
            console.log('[CEmu] WASM URL:', new URL('cemu.wasm', base).href);

            M = await createCEmu({
                locateFile: (file) => new URL(file, base).href
            });
            bind();
        },

        /**
         * Create a fresh calculator from the ROM, inject programs into its archive, then power on.
         * Starting clean each time keeps the PRGM menu predictable: it only lists what we sent.
         */
        start(rom) {
            fn.create();
            emu = true;

            const status = withBytes(rom, (p, n) => fn.loadRom(p, n));

            if (status !== 0) {
                emu = false;
                throw new Error(
                    'CEmu rejected the ROM image. Status: ' + status
                );
            }

            fn.powerOn();
        },

        sendFile(bytes) {
            const status = withBytes(
                bytes,
                (p, n) => fn.sendFile(p, n)
            );

            if (status !== 0) {
                throw new Error(
                    'CEmu could not start program transfer. Status: ' + status
                );
            }
        },

        /** Advance emulation by `ms` of calculator time. */
        advance(ms) {
            fn.run(Math.round(ms * CYCLES_PER_MS));
        },

        key(name, down) {
            const k = KEYS[name];
            if (!k) {
                throw new Error('Unknown key: ' + name);
            }
            fn.setKey(k[0], k[1], down ? 1 : 0);
        },

        /** Current LCD contents as ImageData. */
        frame() {
            const ptr = fn.framebuffer();
            image.data.set(
                M.HEAPU8.subarray(ptr, ptr + WIDTH * HEIGHT * 4)
            );
            return image;
        }
    };
})();
