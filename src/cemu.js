const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const vscode = require('vscode');

const TASK_TYPE = 'tibasic';
const VIEW_ID = 'tibasic.cemuView';
const WALKTHROUGH_ID = 'tibasic.cemuSetup';
const RELEASES_URL = 'https://github.com/CE-Programming/CEmu/releases';
const BUILD_DOC = 'docs/building-cemu.md';

/** TI program names: 1-8 characters, A-Z / 0-9, must start with a letter. */
function toProgramName(base) {
    const name = base.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

    if (!name || /^[0-9]/.test(name)) {
        throw new Error('"' + base + '" cannot be used as a TI program name (1-8 letters/digits, starting with a letter).');
    }

    return name;
}

const exists = (p) => { try { return !!p && fs.statSync(p).isFile(); } catch { return false; } };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** A macOS .app bundle path -> the real binary inside it. */
function resolveExecutable(p) {
    return p && p.endsWith('.app') ? path.join(p, 'Contents', 'MacOS', 'CEmu') : p;
}

/**
 * Look in the usual install locations for a native CEmu.
 * We deliberately do not search PATH for "cemu"/"Cemu.exe": that name is also the Wii U emulator.
 */
function autoDetectExecutable() {
    const home = os.homedir();
    const candidates = [];

    switch (process.platform) {
        case 'win32':
            for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')]) {
                if (base) { candidates.push(path.join(base, 'CEmu', 'CEmu.exe')); }
            }
            break;
        case 'darwin':
            candidates.push('/Applications/CEmu.app/Contents/MacOS/CEmu', path.join(home, 'Applications/CEmu.app/Contents/MacOS/CEmu'));
            break;
        default:
            candidates.push('/usr/bin/CEmu', '/usr/local/bin/CEmu', '/opt/CEmu/CEmu', path.join(home, 'Applications/CEmu'), path.join(home, '.local/bin/CEmu'));
    }

    const exe = process.platform === 'win32' ? 'CEmu.exe' : 'CEmu';
    for (const dir of (process.env.PATH || '').split(path.delimiter)) {
        if (dir) { candidates.push(path.join(dir, exe)); }
    }

    return candidates.find(exists);
}

/**
 * CEmu in the sidebar (and optionally an editor tab), plus the "compile and run" task.
 * @param {vscode.ExtensionContext} context
 * @param {{ getLib: () => any, writeProgram: (text: string, name: string, outPath: string, type: string) => void }} deps
 */
function registerCEmu(context, deps) {
    const output = vscode.window.createOutputChannel('TI-BASIC CEmu');
    const mediaRoot = vscode.Uri.joinPath(context.extensionUri, 'media', 'cemu');
    const webviewOptions = { enableScripts: true, localResourceRoots: [mediaRoot] };

    let nextId = 1;

    // Tasks run from the terminal panel, so remember the last real editor the user was in.
    let lastEditor;
    const track = (editor) => {
        if (editor && ['file', 'untitled'].includes(editor.document.uri.scheme)) {
            lastEditor = editor;
        }
    };
    track(vscode.window.activeTextEditor);
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(track));

    // ----------------------------------------------------------- configuration

    const cfg = () => vscode.workspace.getConfiguration('tibasic.cemu');

    /** True when a WebAssembly build of CEmu has been dropped into media/cemu. */
    const hasEmbedded = () => exists(path.join(mediaRoot.fsPath, 'cemu.js')) && exists(path.join(mediaRoot.fsPath, 'cemu.wasm'));

    function getExecutable() {
        const configured = resolveExecutable(cfg().get('executablePath'));
        if (configured) {
            return { path: configured, ok: exists(configured), source: 'setting' };
        }

        const found = autoDetectExecutable();
        return { path: found, ok: !!found, source: 'auto-detected' };
    }

    function getRomPath() {
        const p = cfg().get('romPath');
        return p && exists(p) ? p : undefined;
    }

    /** 'embedded' (calculator inside VS Code) or 'external' (native CEmu window). */
    function chooseBackend() {
        const mode = cfg().get('mode', 'auto');

        if (mode === 'external') { return 'external'; }
        if (mode === 'embedded') { return hasEmbedded() ? 'embedded' : 'external'; }

        return hasEmbedded() ? 'embedded' : 'external';
    }

    async function pickExecutable() {
        const pick = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: 'Use CEmu',
            title: process.platform === 'darwin' ? 'Select CEmu.app (or the CEmu binary inside it)' : 'Select the CEmu executable',
            filters: process.platform === 'win32' ? { Executable: ['exe'] } : undefined
        });

        if (!pick || !pick[0]) { return undefined; }

        const chosen = resolveExecutable(pick[0].fsPath);
        await cfg().update('executablePath', chosen, vscode.ConfigurationTarget.Global);
        return chosen;
    }

    async function pickRom() {
        const pick = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { 'TI-84 Plus CE ROM': ['rom', 'bin'] },
            openLabel: 'Use ROM',
            title: 'Select your TI-84 Plus CE ROM image'
        });

        if (!pick || !pick[0]) { return undefined; }

        await cfg().update('romPath', pick[0].fsPath, vscode.ConfigurationTarget.Global);
        return pick[0].fsPath;
    }

    const openWalkthrough = () =>
        vscode.commands.executeCommand('workbench.action.openWalkthrough', context.extension.id + '#' + WALKTHROUGH_ID, false);

    // ----------------------------------------------------------------- surfaces
    //
    // A "surface" is any webview that hosts the calculator: the sidebar view, or an editor tab.
    // Each one shows either the embedded emulator or, when no WebAssembly build is available,
    // a setup page that launches native CEmu instead.

    const surfaces = [];

function addSurface(webview, isVisible) {
    const surface = {
        webview,
        isVisible,
        emu: chooseBackend() === 'embedded',
        ready: Promise.resolve(),
        pending: new Map(),
        call: async (msg, timeout) => {
            webview.postMessage(msg);
        }
    };

    // Route every webview message to the actual message handler.
    webview.onDidReceiveMessage((message) => {
        onMessage(surface, message);
    });

    surfaces.push(surface);
    return surface;
}



    function removeSurface(surface) {
        const i = surfaces.indexOf(surface);
        if (i >= 0) { surfaces.splice(i, 1); }

        for (const p of surface.pending.values()) {
            p.reject(new Error('The CEmu view was closed.'));
        }
        surface.pending.clear();
    }

    /** Fill a surface with the emulator or the setup page, depending on the backend. */
    function render(surface) {
        surface.emu = chooseBackend() === 'embedded';

        if (surface.emu) {
            surface.ready = new Promise((res, rej) => { surface.resolveReady = res; surface.rejectReady = rej; });
            surface.ready.catch(() => { /* surfaced by the caller */ });
            surface.webview.html = emulatorHtml(surface.webview);
        } else {
            surface.webview.html = setupHtml(surface.webview);
        }
    }

    function onMessage(surface, msg) {
        switch (msg.type) {
            case 'ready':
                if (surface.emu) {
                    getRomBase64()
                        .then((rom) => surface.call({ type: 'boot', rom }, 60000))
                        .then(surface.resolveReady, surface.rejectReady);
                }
                break;
            case 'ack':
            case 'nack': {
                const p = surface.pending.get(msg.id);
                if (p) {
                    surface.pending.delete(msg.id);
                    msg.type === 'ack' ? p.resolve(msg) : p.reject(new Error(msg.error || 'CEmu error'));
                }
                break;
            }
            case 'log':
                output.appendLine(String(msg.text));
                break;
            case 'action':
                handleAction(msg.action).catch((error) => vscode.window.showErrorMessage('Error: ' + error.message));
                break;
        }
    }

    /** The emulator surface to talk to: prefer one that is on screen. */
    function pickEmu() {
        const emus = surfaces.filter((s) => s.emu).reverse();
        return emus.find((s) => s.isVisible()) || emus[0];
    }

    /** Make sure an emulator surface exists and is showing, opening the sidebar view if needed. */
    async function ensureEmu() {
        let s = pickEmu();

        if (!s || !s.isVisible()) {
            await vscode.commands.executeCommand(VIEW_ID + '.focus');
        }

        for (let i = 0; i < 100 && !(s = pickEmu()); i++) {
            await sleep(50);
        }

        if (!s) {
            throw new Error('Could not open the TI-84 CE view.');
        }

        return s;
    }

    // ------------------------------------------------------------ webview HTML

//     function emulatorHtml(webview) {
//         const uri = (file) => webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, file));
//         const nonce = crypto.randomBytes(16).toString('hex');
//         const csp = [
//             "default-src 'none'",
//             'img-src ' + webview.cspSource + ' data:',
//             'style-src ' + webview.cspSource,
//             'script-src ' + webview.cspSource + " 'nonce-" + nonce + "' 'wasm-unsafe-eval'",
//             'connect-src ' + webview.cspSource
//         ].join('; ');

//         return `<!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <meta http-equiv="Content-Security-Policy" content="${csp}">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <link rel="stylesheet" href="${uri('host.css')}">
//     <title>TI-84 CE</title>
// </head>
// <body tabindex="0">
//     <canvas id="lcd" width="320" height="240"></canvas>
//     <div id="status">Starting CEmu…</div>
//     <script nonce="${nonce}">window.CEMU_BASE = ${JSON.stringify(uri('').toString())};</script>
//     <script nonce="${nonce}" src="${uri('cemu.js')}"></script>
//     <script nonce="${nonce}" src="${uri('adapter.js')}"></script>
//     <script nonce="${nonce}" src="${uri('host.js')}"></script>
// </body>
// </html>`;
//     }

    function emulatorHtml(webview) {
        const uri = (file) => webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, file));
        const nonce = crypto.randomBytes(16).toString('hex');
        const csp = [
            "default-src 'none'",
            'img-src ' + webview.cspSource + ' data:',
            'style-src ' + webview.cspSource + " 'unsafe-inline'",
            'script-src ' + webview.cspSource + " 'nonce-" + nonce + "' 'wasm-unsafe-eval'",
            'connect-src ' + webview.cspSource
        ].join('; ');

        return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="${csp}">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="${uri('host.css')}">
        <title>TI-84 CE</title>
        <script nonce="${nonce}">
            // PERMANENT FIX: Intercept and neutralize Emscripten's service worker registration
            if (navigator.serviceWorker) {
                navigator.serviceWorker.register = function() {
                    console.warn('Service worker registration bypassed for VS Code webview environment.');
                    return Promise.reject(new Error('Service workers are disabled in VS Code webviews.'));
                };
            }
        </script>
    </head>
    <body tabindex="0">
        <canvas id="lcd" width="320" height="240"></canvas>
        <div id="status">Starting CEmu…</div>
        <script nonce="${nonce}">window.CEMU_BASE = ${JSON.stringify(uri('').toString())};</script>
        <script nonce="${nonce}" src="${uri('cemu.js')}"></script>
        <script nonce="${nonce}" src="${uri('adapter.js')}"></script>
        <script nonce="${nonce}" src="${uri('host.js')}"></script>
    </body>
    </html>`;
    }

    function setupHtml(webview) {
        const nonce = crypto.randomBytes(16).toString('hex');
        const exe = getExecutable();
        const rom = getRomPath();
        const mode = cfg().get('mode', 'auto');

        const row = (ok, title, detail, buttons) => `
            <div class="row">
                <span class="dot ${ok ? 'ok' : 'todo'}">${ok ? '✓' : '•'}</span>
                <div class="body">
                    <div class="title">${title}</div>
                    <div class="detail">${detail}</div>
                    <div class="buttons">${buttons}</div>
                </div>
            </div>`;
        const btn = (action, label, primary) => `<button data-action="${action}"${primary ? ' class="primary"' : ''}>${label}</button>`;

        const why = mode === 'external'
            ? 'Embedded mode is turned off (<code>tibasic.cemu.mode</code> is <code>external</code>), so programs open in the native CEmu window.'
            : 'This install does not include the embedded WebAssembly emulator (<code>media/cemu/cemu.js</code> and <code>cemu.wasm</code>), so programs open in the native CEmu window.';

        const rows = [
            row(
                exe.ok,
                'CEmu emulator',
                exe.ok
                    ? 'Using <code>' + esc(exe.path) + '</code> (' + exe.source + ').'
                    : 'No CEmu executable found. Download a ready-made build (no compiling needed) or point the extension at one you already have.',
                btn('download', 'Download CEmu', !exe.ok) + btn('locateExe', exe.ok ? 'Change…' : 'Locate executable…')
            ),
            row(
                !!rom,
                'TI-84 Plus CE ROM',
                rom
                    ? 'Using <code>' + esc(rom) + '</code>.'
                    : 'Optional once you have run CEmu’s own ROM wizard. Dump it from your own calculator; it cannot be bundled.',
                btn('chooseRom', rom ? 'Change…' : 'Select ROM…')
            )
        ].join('');

        const csp = ["default-src 'none'", 'style-src ' + webview.cspSource + " 'nonce-" + nonce + "'", "script-src 'nonce-" + nonce + "'"].join('; ');

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TI-84 CE</title>
<style nonce="${nonce}">
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 12px 16px; }
    h1 { font-size: 1.2em; font-weight: 600; margin: 0 0 4px; }
    p { margin: 0 0 12px; color: var(--vscode-descriptionForeground); }
    .row { display: flex; gap: 10px; padding: 10px 0; border-top: 1px solid var(--vscode-panel-border, #444); }
    .dot { flex: none; width: 20px; height: 20px; border-radius: 50%; text-align: center; line-height: 20px; font-size: 12px; }
    .dot.ok { background: var(--vscode-testing-iconPassed, #3a3); color: #fff; }
    .dot.todo { background: var(--vscode-editorWarning-foreground, #ca3); color: #000; }
    .title { font-weight: 600; }
    .detail { color: var(--vscode-descriptionForeground); margin: 2px 0 8px; word-break: break-all; }
    code { font-family: var(--vscode-editor-font-family); }
    button { margin: 0 6px 6px 0; padding: 4px 10px; border: 1px solid var(--vscode-button-border, transparent); cursor: pointer;
             color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
    button.primary { color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
    .actions { border-top: 1px solid var(--vscode-panel-border, #444); padding-top: 12px; }
    .note { margin-top: 12px; font-size: 0.9em; }
    a { color: var(--vscode-textLink-foreground); cursor: pointer; }
</style>
</head>
<body>
    <h1>TI-84 Plus CE</h1>
    <p>${why}</p>
    ${rows}
    <div class="actions">
        ${btn('launch', 'Launch CEmu', exe.ok)}
        ${btn('run', 'Compile active file and run')}
        ${btn('walkthrough', 'Setup walkthrough')}
        ${btn('refresh', 'Re-check')}
    </div>
    <p class="note">Prefer to compile CEmu yourself? <a data-action="buildDoc">Build instructions</a>.</p>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        document.addEventListener('click', (e) => {
            const el = e.target.closest('[data-action]');
            if (el) { vscode.postMessage({ type: 'action', action: el.dataset.action }); }
        });
    </script>
</body>
</html>`;
    }

    async function handleAction(action) {
        switch (action) {
            case 'download':
                await vscode.env.openExternal(vscode.Uri.parse(RELEASES_URL));
                break;
            case 'locateExe':
                await pickExecutable();
                break;
            case 'chooseRom':
                await pickRom();
                break;
            case 'launch':
                await launchExternal([]);
                break;
            case 'run':
                await runInCEmu((line) => output.appendLine(line));
                break;
            case 'walkthrough':
                await openWalkthrough();
                break;
            case 'buildDoc':
                await vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.joinPath(context.extensionUri, BUILD_DOC));
                break;
        }

        refreshSetupPages();
    }

    function refreshSetupPages() {
        for (const s of surfaces) {
            if (!s.emu) { render(s); }
        }
    }

    async function getRomBase64() {
        let romPath = getRomPath();

        if (!romPath) {
            romPath = await pickRom();
            if (!romPath) {
                throw new Error('A TI-84 Plus CE ROM image is required to start CEmu.');
            }
        }

        return fs.readFileSync(romPath).toString('base64');
    }

    // ------------------------------------------------------ external (native)

    /** Spawn native CEmu with the given extra arguments. Resolves once the process has started. */
    async function launchExternal(extraArgs, log = (line) => output.appendLine(line)) {
        let exe = getExecutable();

        if (!exe.ok) {
            const choice = await vscode.window.showWarningMessage(
                'TI-BASIC: CEmu was not found. Download a prebuilt CEmu, or point the extension at one you already have.',
                'Download CEmu', 'Locate Executable', 'Walkthrough'
            );

            if (choice === 'Download CEmu') {
                await vscode.env.openExternal(vscode.Uri.parse(RELEASES_URL));
            } else if (choice === 'Locate Executable') {
                if (await pickExecutable()) { exe = getExecutable(); }
            } else if (choice === 'Walkthrough') {
                await openWalkthrough();
            }

            if (!exe.ok) {
                throw new Error('CEmu executable not configured. Set "tibasic.cemu.executablePath".');
            }
        }

        // Without --rom, CEmu uses the ROM it was already set up with (its own first-run wizard).
        const rom = getRomPath();
        const args = [...(rom ? ['--rom', rom] : []), ...extraArgs];
        log('> ' + exe.path + ' ' + args.map((a) => (/\s/.test(a) ? '"' + a + '"' : a)).join(' '));

        await new Promise((resolve, reject) => {
            const child = spawn(exe.path, args, { detached: true, stdio: 'ignore' });
            child.once('error', (err) => reject(new Error('Could not start CEmu: ' + err.message)));
            child.once('spawn', () => { child.unref(); resolve(); });
        });
    }

    // ------------------------------------------------------- build + run flow

    /** Compile the active editor to an .8xp on disk. */
    function buildActive(log) {
        if (!deps.getLib()) {
            throw new Error('TIVarsLib not ready!');
        }

        if (!lastEditor) {
            throw new Error('No text editor active.');
        }

        const doc = lastEditor.document;
        const name = toProgramName(path.parse(doc.fileName).name);
        const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
        const outDirSetting = vscode.workspace.getConfiguration('tibasic.build').get('outputDir', 'build');
        const outDir = folder
            ? path.resolve(folder.uri.fsPath, outDirSetting)
            : path.join(context.globalStorageUri.fsPath, 'build');
        const outPath = path.join(outDir, name + '.8xp');

        fs.mkdirSync(outDir, { recursive: true });
        deps.writeProgram(doc.getText(), name, outPath, '84+CE');
        log('Compiled ' + path.basename(doc.fileName) + ' -> ' + outPath);

        return { name, outPath };
    }

    async function runInCEmu(log) {
        const { name, outPath } = buildActive(log);

        if (chooseBackend() === 'embedded') {
            log('Opening the TI-84 CE view...');
            const surface = await ensureEmu();
            await surface.ready;

            log('Running prgm' + name + '...');
            await surface.call({
                type: 'run',
                name,
                data: fs.readFileSync(outPath).toString('base64')
            }, 60000);
            return;
        }

        log('Starting native CEmu...');
        await launchExternal(['--send', outPath, '--launch', name], log);
    }

    // ------------------------------------------------------------------ tasks

    class TaskTerminal {
        constructor(action) {
            this.action = action;
            this.writeEmitter = new vscode.EventEmitter();
            this.closeEmitter = new vscode.EventEmitter();
            this.onDidWrite = this.writeEmitter.event;
            this.onDidClose = this.closeEmitter.event;
        }

        open() {
            const log = (line) => this.writeEmitter.fire(line + '\r\n');

            (async () => {
                try {
                    if (this.action === 'run') {
                        await runInCEmu(log);
                    } else {
                        buildActive(log);
                    }
                    log('Done.');
                    this.closeEmitter.fire(0);
                } catch (error) {
                    log('Error: ' + error.message);
                    this.closeEmitter.fire(1);
                }
            })();
        }

        close() { }
    }

    function makeTask(action, definition) {
        const label = action === 'run' ? 'Compile and run in CEmu' : 'Compile to .8xp';
        const task = new vscode.Task(
            definition || { type: TASK_TYPE, action },
            vscode.TaskScope.Workspace,
            label,
            TASK_TYPE,
            new vscode.CustomExecution(async () => new TaskTerminal(action))
        );

        if (action === 'run') {
            task.group = vscode.TaskGroup.Build;
        }

        return task;
    }

    const taskProvider = vscode.tasks.registerTaskProvider(TASK_TYPE, {
        provideTasks: () => [makeTask('run'), makeTask('build')],
        resolveTask: (task) => {
            const action = task.definition.action;
            return (action === 'run' || action === 'build') ? makeTask(action, task.definition) : undefined;
        }
    });

    // ------------------------------------------------- sidebar view + editor tab

    const viewProvider = vscode.window.registerWebviewViewProvider(VIEW_ID, {
        resolveWebviewView(view) {
            view.webview.options = webviewOptions;
            const surface = addSurface(view.webview, () => view.visible);
            view.onDidDispose(() => removeSurface(surface));
            render(surface);
        }
    }, { webviewOptions: { retainContextWhenHidden: true } }); // keep the emulator alive while the sidebar is hidden

    let tab;

    function openInEditor() {
        if (tab) {
            tab.reveal(undefined, true);
            return;
        }

        tab = vscode.window.createWebviewPanel(
            'tibasicCEmu',
            'TI-84 CE',
            { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
            { ...webviewOptions, retainContextWhenHidden: true }
        );

        const surface = addSurface(tab.webview, () => tab.visible);
        tab.onDidDispose(() => { tab = undefined; removeSurface(surface); });
        render(surface);
    }

    // --------------------------------------------------------------- commands

    const openCmd = vscode.commands.registerCommand('extension.openCEmu', async () => {
        try {
            await vscode.commands.executeCommand(VIEW_ID + '.focus');
        } catch (error) {
            vscode.window.showErrorMessage('Error: ' + error.message);
        }
    });

    const openTabCmd = vscode.commands.registerCommand('extension.openCEmuInEditor', () => openInEditor());

    const runCmd = vscode.commands.registerCommand('extension.runInCEmu', async () => {
        try {
            await runInCEmu((line) => output.appendLine(line));
        } catch (error) {
            output.appendLine('Error: ' + error.message);
            vscode.window.showErrorMessage('Error: ' + error.message);
        }
    });

    const locateCmd = vscode.commands.registerCommand('extension.locateCEmu', async () => {
        const chosen = await pickExecutable();
        if (chosen) { vscode.window.showInformationMessage('CEmu set to: ' + chosen); }
        refreshSetupPages();
    });

    const romCmd = vscode.commands.registerCommand('extension.selectCEmuRom', async () => {
        const chosen = await pickRom();
        if (chosen) { vscode.window.showInformationMessage('ROM set to: ' + chosen); }
        refreshSetupPages();
    });

    const downloadCmd = vscode.commands.registerCommand('extension.downloadCEmu', () =>
        vscode.env.openExternal(vscode.Uri.parse(RELEASES_URL)));

    const walkthroughCmd = vscode.commands.registerCommand('extension.cemuWalkthrough', () => openWalkthrough());

    const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration('tibasic.cemu')) { return; }

        // Switch a surface between emulator and setup page if the backend changed; refresh setup pages.
        for (const s of surfaces) {
            if (s.emu !== (chooseBackend() === 'embedded') || !s.emu) { render(s); }
        }
    });

    context.subscriptions.push(
        output, taskProvider, viewProvider, configWatcher,
        openCmd, openTabCmd, runCmd, locateCmd, romCmd, downloadCmd, walkthroughCmd
    );
}

module.exports = { registerCEmu, toProgramName };
