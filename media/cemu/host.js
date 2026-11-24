/* eslint-env browser */
(() => {
    const vscode = acquireVsCodeApi();
    const A = window.CEmuAdapter;
    const canvas = document.getElementById('lcd');
    const ctx = canvas.getContext('2d');
    const statusEl = document.getElementById('status');

    let rom = null;
    let running = false;
    let emuClock = 0; // milliseconds of emulated time since the last start
    let waiters = [];

    const log = (text) => vscode.postMessage({ type: 'log', text });
    const setStatus = (text) => {
        statusEl.textContent = text || '';
        statusEl.classList.toggle('hidden', !text);
    };

    // ---------------------------------------------------------- virtual keypad

function createVirtualKeypad() {
    const style = document.createElement('style');

    // Reuse the nonce from the webview's script for CSP compatibility.
    const nonce = document.currentScript?.nonce;
    if (nonce) style.nonce = nonce;

    style.textContent = `
        html, body {
            margin: 0;
            min-height: 100%;
            overflow-y: auto !important;
        }

        #ti84-shell {
            box-sizing: border-box;
            width: min(400px, calc(100vw - 20px));
            margin: 12px auto 24px;
            padding: 16px 14px 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            border: 1px solid #45494e;
            border-radius: 28px;
            background: linear-gradient(145deg, #303338, #151719);
            box-shadow: 0 8px 24px #0005;
        }

        #ti84-shell #lcd {
            display: block;
            box-sizing: border-box;
            width: 100%;
            max-width: 320px;
            height: auto;
            aspect-ratio: 4 / 3;
            image-rendering: pixelated;
            background: #080a0b;
            border: 5px solid #090a0b;
            border-radius: 5px;
        }

        #ti84-shell #status {
            position: static !important;
            box-sizing: border-box;
            width: 100%;
            min-height: 0;
            margin: 0;
            color: #f0f0f0;
            text-align: center;
            font: 12px/1.4 sans-serif;
        }

        #ti84-shell #status.hidden {
            display: none !important;
        }

        #ti84-keypad {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 7px;
            touch-action: none;
            user-select: none;
            -webkit-user-select: none;
        }

        #ti84-keypad .vk-row {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 6px;
        }

        #ti84-keypad .vk-btn {
            min-width: 0;
            height: 38px;
            padding: 2px;
            border: 1px solid #a5a8ac;
            border-radius: 7px;
            background: linear-gradient(#f0f1f2, #c9cdd1);
            color: #202226;
            box-shadow: 0 2px 0 #777b80;
            font: 600 11px/1.05 sans-serif;
            overflow: hidden;
            cursor: pointer;
            touch-action: none;
            user-select: none;
            -webkit-user-select: none;
            -webkit-tap-highlight-color: transparent;
        }

        #ti84-keypad .vk-function-row .vk-btn {
            height: 29px;
            font-size: 9px;
            border-radius: 5px;
            background: linear-gradient(#444950, #292d32);
            border-color: #60656b;
            color: #f8f9fa;
            box-shadow: 0 2px 0 #090a0b;
        }

        #ti84-keypad .vk-btn[data-key="2nd"] {
            background: linear-gradient(#4b88b5, #28628d);
            border-color: #78a8c8;
            color: white;
        }

        #ti84-keypad .vk-btn[data-key="alpha"] {
            background: linear-gradient(#7caf53, #477c36);
            border-color: #9ac67d;
            color: white;
        }

        #ti84-keypad .vk-btn[data-key="clear"] {
            background: linear-gradient(#f1c4c4, #d98b8b);
            border-color: #d5a0a0;
        }

        #ti84-keypad .vk-btn[data-key="enter"] {
            background: linear-gradient(#f4f5f6, #d6d9dc);
            font-weight: 800;
        }

        #ti84-keypad .vk-btn.is-pressed {
            transform: translateY(2px);
            box-shadow: none;
            filter: brightness(.82);
        }

        #ti84-keypad.vk-disabled {
            opacity: .65;
        }

        #ti84-keypad .vk-spacer {
            min-width: 0;
        }

        #ti84-keypad .vk-nav-row {
            align-items: center;
        }

        #ti84-keypad .vk-dpad {
            grid-column: span 2;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            grid-template-rows: repeat(3, 20px);
            gap: 1px;
            align-items: center;
            justify-items: center;
        }

        #ti84-keypad .vk-dpad .vk-btn {
            width: 100%;
            height: 20px;
            min-height: 20px;
            padding: 0;
            border-radius: 4px;
            font-size: 12px;
        }

        #ti84-keypad .vk-dpad .vk-center {
            width: 19px;
            height: 19px;
            border-radius: 50%;
            background: #25282c;
            border: 1px solid #62676c;
        }

        #ti84-keypad.vk-disabled .vk-btn {
            cursor: default;
        }

        #ti84-keypad .vk-key {
    min-width: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1px;
}

#ti84-keypad .vk-legends {
    box-sizing: border-box;
    width: 100%;
    height: 11px;
    flex: 0 0 11px;
    padding: 0 2px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 2px;
    white-space: nowrap;
    font: 700 7px/10px sans-serif;
}

#ti84-keypad .vk-legend-second {
    color: #52b8ff;
    text-align: left;
}

#ti84-keypad .vk-legend-alpha {
    color: #91d66c;
    text-align: right;
}

#ti84-keypad .vk-btn {
    width: 100%;
    flex: 0 0 auto;
}

/* Leave enough room for legends above the directional buttons. */
#ti84-keypad .vk-dpad {
    grid-template-rows: repeat(3, 30px);
}

#ti84-keypad .vk-dpad .vk-legends {
    height: 9px;
    flex-basis: 9px;
    padding: 0;
    font-size: 6px;
}

#ti84-keypad .vk-dpad .vk-key {
    min-width: 0;
}
    `;

    document.head.appendChild(style);

    // Give the screen and keypad a shared calculator body.
    const shell = document.createElement('div');
    shell.id = 'ti84-shell';

    canvas.parentNode.insertBefore(shell, canvas);
    
    shell.appendChild(canvas);
    shell.appendChild(statusEl);

// Run the TI-BASIC program from the active VS Code document.
const runButton = document.createElement('button');
runButton.type = 'button';
runButton.className = 'vk-run-button';
runButton.textContent = '▶ Run Active Document';
runButton.title = 'Build and run the active TI-BASIC document';

runButton.style.cssText = `
    width: 100%;
    max-width: 320px;
    min-height: 42px;
    border: 1px solid #8dbb76;
    border-radius: 8px;
    background: linear-gradient(#a6d787, #72aa51);
    color: #172110;
    font: 700 14px sans-serif;
    cursor: pointer;
    margin: 4px 0;
`;

runButton.addEventListener('click', () => {
    if (!running) {
        setStatus('The calculator is not ready to run a program.');
        return;
    }

    vscode.postMessage({
        type: 'action',
        action: 'run'
    });
});

shell.appendChild(runButton);

const SECONDARY_LABELS = {
    yequ: 'STAT PLOT',
    window: 'TBLSET',
    zoom: 'FORMAT',
    trace: 'CALC',
    graph: 'TABLE',

    mode: 'QUIT',
    del: 'INS',
    alpha: 'A-LOCK',
    xvar: 'LINK',
    stat: 'LIST',

    math: 'TEST',
    apps: 'ANGLE',
    prgm: 'DRAW',
    vars: 'DISTR',

    recip: 'MATRIX',
    sin: 'sin⁻¹',
    cos: 'cos⁻¹',
    tan: 'tan⁻¹',
    power: 'π',

    square: '√',
    comma: 'EE',
    lparen: '{',
    rparen: '}',
    div: 'e',

    log: '10ˣ',
    ln: 'eˣ',
    sto: 'RCL',

    '0': 'CATALOG',
    chs: 'ANS',
    add: 'MEM',
    enter: 'ENTRY'
};

const ALPHA_LABELS = {
    yequ: 'F1',
    window: 'F2',
    zoom: 'F3',
    trace: 'F4',
    graph: 'F5',

    math: 'A',
    apps: 'B',
    prgm: 'C',
    recip: 'D',
    sin: 'E',
    cos: 'F',
    tan: 'G',
    power: 'H',
    square: 'I',
    comma: 'J',
    lparen: 'K',
    rparen: 'L',
    div: 'M',
    log: 'N',
    '7': 'O',
    '8': 'P',
    '9': 'Q',
    mul: 'R',
    ln: 'S',
    '4': 'T',
    '5': 'U',
    '6': 'V',
    sub: 'W',
    sto: 'X',
    '1': 'Y',
    '2': 'Z',

    '0': 'i',
    dot: ':',
    chs: '?',
    enter: 'SOLVE'
};


    const keypad = document.createElement('div');
    keypad.id = 'ti84-keypad';
    keypad.classList.add('vk-disabled');
    shell.appendChild(keypad);

    function makeKey(name, label) {
    const key = document.createElement('div');
    key.className = 'vk-key';

    const legends = document.createElement('div');
    legends.className = 'vk-legends';

    const second = document.createElement('span');
    second.className = 'vk-legend-second';
    second.textContent = SECONDARY_LABELS[name] || '';

    const alpha = document.createElement('span');
    alpha.className = 'vk-legend-alpha';
    alpha.textContent = ALPHA_LABELS[name] || '';

    legends.append(second, alpha);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vk-btn';
    button.dataset.key = name;
    button.textContent = label;
    button.setAttribute('aria-label', [
        label,
        SECONDARY_LABELS[name]
            ? '2nd: ' + SECONDARY_LABELS[name]
            : '',
        ALPHA_LABELS[name]
            ? 'Alpha: ' + ALPHA_LABELS[name]
            : ''
    ].filter(Boolean).join(', '));

    key.append(legends, button);
    return key;
}

    function addRow(keys, className = '') {
        const row = document.createElement('div');
        row.className = 'vk-row ' + className;

        for (const item of keys) {
            if (!item) {
                const spacer = document.createElement('span');
                spacer.className = 'vk-spacer';
                row.appendChild(spacer);
            } else {
                row.appendChild(makeKey(item[0], item[1]));
            }
        }

        keypad.appendChild(row);
        return row;
    }

    // Function keys above the main keypad.
    addRow([
        ['yequ', 'Y='],
        ['window', 'WINDOW'],
        ['zoom', 'ZOOM'],
        ['trace', 'TRACE'],
        ['graph', 'GRAPH']
    ], 'vk-function-row');

    // Modifier keys and the four-way navigation pad.
    const nav = addRow([
        ['2nd', '2nd'],
        ['mode', 'MODE'],
        ['del', 'DEL']
    ], 'vk-nav-row');

    const dpad = document.createElement('div');
    dpad.className = 'vk-dpad';

    const blank = () => {
        const el = document.createElement('span');
        el.className = 'vk-spacer';
        return el;
    };

    const center = document.createElement('span');
    center.className = 'vk-center';

    dpad.append(
        blank(), makeKey('up', '▲'), blank(),
        makeKey('left', '◀'), center, makeKey('right', '▶'),
        blank(), makeKey('down', '▼'), blank()
    );

    nav.appendChild(dpad);

    addRow([
        ['alpha', 'ALPHA'],
        ['xvar', 'X,T,θ,n'],
        ['stat', 'STAT'],
        null,
        null
    ]);

    addRow([
        ['math', 'MATH'],
        ['apps', 'APPS'],
        ['prgm', 'PRGM'],
        ['vars', 'VARS'],
        ['clear', 'CLEAR']
    ]);

    addRow([
        ['recip', 'x⁻¹'],
        ['sin', 'SIN'],
        ['cos', 'COS'],
        ['tan', 'TAN'],
        ['power', '^']
    ]);

    addRow([
        ['square', 'x²'],
        ['comma', ','],
        ['lparen', '('],
        ['rparen', ')'],
        ['div', '÷']
    ]);

    addRow([
        ['log', 'LOG'],
        ['7', '7'],
        ['8', '8'],
        ['9', '9'],
        ['mul', '×']
    ]);

    addRow([
        ['ln', 'LN'],
        ['4', '4'],
        ['5', '5'],
        ['6', '6'],
        ['sub', '−']
    ]);

    addRow([
        ['sto', 'STO→'],
        ['1', '1'],
        ['2', '2'],
        ['3', '3'],
        ['add', '+']
    ]);

    addRow([
        null,
        ['0', '0'],
        ['dot', '.'],
        ['chs', '(-)'],
        ['enter', 'ENTER']
    ]);

    const helpy = document.createElement("span");
    helpy.innerText = "Remember to write negatives with ~";
    helpy.style.cssText = `
        max-width: 320px;
        color: #f0f0f0;
        font: 12px/1.4 sans-serif;
        text-align: center;
    `;
    shell.appendChild(helpy);

    // Track the pointer from press to release so holding a key works,
    // including when the pointer moves outside the button.
    const activePointers = new Map();

    function release(pointerId) {
        const button = activePointers.get(pointerId);
        if (!button) return;

        activePointers.delete(pointerId);
        button.classList.remove('is-pressed');

        try {
            A.key(button.dataset.key, false);
        } catch (error) {
            log('Key release error: ' + error.message);
        }
    }

    keypad.addEventListener('pointerdown', (event) => {
        const button = event.target.closest('button[data-key]');
        if (!button || !running || event.button !== 0) return;

        event.preventDefault();

        activePointers.set(event.pointerId, button);
        button.classList.add('is-pressed');

        try {
            A.key(button.dataset.key, true);
            button.setPointerCapture(event.pointerId);
        } catch (error) {
            release(event.pointerId);
            setStatus('Key error: ' + error.message);
        }
    });

    keypad.addEventListener('pointerup', (event) => {
        release(event.pointerId);
    });

    keypad.addEventListener('pointercancel', (event) => {
        release(event.pointerId);
    });

    keypad.addEventListener('lostpointercapture', (event) => {
        release(event.pointerId);
    });

    return {
        setEnabled(enabled) {
            keypad.classList.toggle('vk-disabled', !enabled);
        },

        releaseAll() {
            for (const pointerId of [...activePointers.keys()]) {
                release(pointerId);
            }
        }
    };
}

const virtualKeys = createVirtualKeypad();

    const fromBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    /** Resolve after `ms` of emulated time has run. */
    function waitEmu(ms) {
        return new Promise((resolve) => waiters.push({ at: emuClock + ms, resolve }));
    }

    async function tap(name, holdMs = 120, gapMs = 120) {
        A.key(name, true);
        await waitEmu(holdMs);
        A.key(name, false);
        await waitEmu(gapMs);
    }

    // ---------------------------------------------------------- render loop

    let last = performance.now();

    function frame(now) {
        if (running) {
            const dt = Math.min(now - last, 100);
            try {
                A.advance(dt);
                emuClock += dt;
                ctx.putImageData(A.frame(), 0, 0);
            } catch (error) {
                running = false;
                log('Emulator stopped: ' + error.message);
                setStatus('Emulator stopped: ' + error.message);
            }

            const due = waiters.filter((w) => w.at <= emuClock);
            waiters = waiters.filter((w) => w.at > emuClock);
            due.forEach((w) => w.resolve());
        }

        last = now;
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);

    // -------------------------------------------------------------- commands

    async function boot(msg) {
        setStatus('Loading CEmu…');
        await A.load();
        rom = fromBase64(msg.rom);
        A.start(rom, []);
        emuClock = 0;
        running = true;
        virtualKeys.setEnabled(true);
        setStatus('');
    }

    async function run(msg) {
        if (!rom) {
            throw new Error('Emulator has not been booted.');
        }

        running = false;
        virtualKeys.setEnabled(false);
        virtualKeys.releaseAll();
        waiters = [];

        setStatus('Restarting calculator…');

        // Reload the ROM and power on the calculator.
        A.start(rom);

        emuClock = 0;
        last = performance.now();
        running = true;

        // Let the TI operating system reach the home screen.
        await waitEmu(2500);

        // Transfer the compiled .8xp file into calculator RAM.
        setStatus('Sending ' + msg.name + '…');
        A.sendFile(fromBase64(msg.data));

        // Allow the USB transfer to progress while emulation runs.
        await waitEmu(4000);

        setStatus('Running ' + msg.name + '…');

        // Return to the home screen and launch the program.
        await tap('clear', 100, 300);
        await tap('prgm', 150, 400);
        await tap('enter', 150, 400);
        await tap('enter', 150, 200);

        setStatus('');
        virtualKeys.setEnabled(true);
        document.body.focus();
    }

    window.addEventListener('message', async (event) => {
        const msg = event.data;
        try {
            if (msg.type === 'boot') { await boot(msg); }
            else if (msg.type === 'run') { await run(msg); }
            vscode.postMessage({ type: 'ack', id: msg.id });
        } catch (error) {
            setStatus(error.message);
            vscode.postMessage({ type: 'nack', id: msg.id, error: error.message });
        }
    });

    vscode.postMessage({ type: 'webviewReady' });

    // -------------------------------------------------------------- keyboard

    const KEYMAP = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        Enter: 'enter', Backspace: 'del', Escape: 'clear', Delete: 'clear',
        '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '^': 'power', '.': 'dot', ',': 'comma',
        '(': 'lparen', ')': 'rparen', Shift: '2nd', Control: 'alpha'
    };
    for (let d = 0; d <= 9; d++) { KEYMAP[String(d)] = String(d); }

    const held = new Map();

    function keyFor(event) {
        if (KEYMAP[event.key]) { return [KEYMAP[event.key]]; }

        const upper = event.key.length === 1 ? event.key.toUpperCase() : '';
        if (A.LETTER_KEYS[upper]) { return ['alpha', A.LETTER_KEYS[upper]]; }

        return null;
    }

    window.addEventListener('keydown', (event) => {
        if (!running || event.repeat || event.metaKey || event.altKey) { return; }

        const keys = keyFor(event);
        if (!keys) { return; }

        event.preventDefault();
        held.set(event.code, keys);
        keys.forEach((k) => A.key(k, true));
    });

    window.addEventListener('keyup', (event) => {
        const keys = held.get(event.code);
        if (!keys) { return; }

        event.preventDefault();
        held.delete(event.code);
        keys.slice().reverse().forEach((k) => A.key(k, false));
    });

    window.addEventListener('blur', () => {
        virtualKeys.releaseAll();
        for (const keys of held.values()) { keys.forEach((k) => A.key(k, false)); }
        held.clear();
    });

    canvas.addEventListener('mousedown', () => document.body.focus());
    
    vscode.postMessage({ type: 'ready' });
})();