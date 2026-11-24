// ui.js - Lives inside your webview container environment
(function () {
    const vscode = acquireVsCodeApi();
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    let cemuInstance = null;
    let frameLoopId = null;

    // Allocate an HTML canvas frame image buffer matching standard TI-84 Plus CE dimensions (320x240)
    const lcdWidth = 320;
    const lcdHeight = 240;
    const imgData = ctx.createImageData(lcdWidth, lcdHeight);

    // 1. Initialize the modular ES6 WebAssembly package wrapper
    createCemuModule().then((Module) => {
        cemuInstance = Module;
        
        // Notify the extension host wrapper logic that the binary bootstrapping succeeded
        vscode.postMessage({ type: 'ready' });
    }).catch((err) => {
        vscode.postMessage({ type: 'error', text: err.message });
    });

    // 2. Listen for administrative payloads originating from VS Code host extension thread
    window.addEventListener('message', async (event) => {
        const msg = event.data;
        if (!cemuInstance) return;

        switch (msg.type) {
            case 'bootWithRom':
                try {
                    const romUint8Array = new Uint8Array(msg.payload.romData);
                    
                    // Pipe the binary safe array directly to the underlying engine initialization hooks
                    const bufferPtr = cemuInstance._malloc(romUint8Array.length);
                    cemuInstance.HEAPU8.set(romUint8Array, bufferPtr);
                    
                    cemuInstance._emu_load_rom_buffer(bufferPtr, romUint8Array.length);
                    cemuInstance._emu_init();
                    cemuInstance._free(bufferPtr);

                    // Kickstart graphics refresh cycle
                    startEmulationLoop();
                    
                    vscode.postMessage({ id: msg.id, payload: { success: true } });
                } catch (e) {
                    vscode.postMessage({ id: msg.id, error: e.message });
                }
                break;
        }
    });

    // 3. The Render Pump Loop
    function startEmulationLoop() {
        if (frameLoopId) cancelAnimationFrame(frameLoopId);

        function step() {
            // Tell core engine to advance the eZ80 state logic to the next video clock interrupt block
            cemuInstance._emu_step_frame();

            // Fetch the physical memory offset pointer representing the current LCD pixel layout
            const videoPtr = cemuInstance._emu_get_lcd_buffer();
            
            // Extract the pixel bytes from the compiled WebAssembly memory heap array abstraction
            const byteLength = lcdWidth * lcdHeight * 4; // assuming standard 32-bit RGBA conversions
            const pixelView = new Uint8Array(cemuInstance.HEAPU8.buffer, videoPtr, byteLength);
            
            // Copy directly over to standard canvas view pixels
            imgData.data.set(pixelView);
            ctx.putImageData(imgData, 0, 0);

            frameLoopId = requestAnimationFrame(step);
        }
        frameLoopId = requestAnimationFrame(step);
    }

    // 4. Map computer peripheral hardware actions straight down to calculator keypad arrays
    window.addEventListener('keydown', (e) => handleKey(e, 1));
    window.addEventListener('keyup', (e) => handleKey(e, 0));

    function handleKey(event, isDown) {
        if (!cemuInstance) return;
        
        // Map native javascript string patterns over to target hardware layout key matrix integers
        const keyMap = { 'ArrowUp': 1, 'ArrowDown': 2, 'ArrowLeft': 3, 'ArrowRight': 4, 'Enter': 5 }; 
        const calcKeyId = keyMap[event.key];
        
        if (calcKeyId !== undefined) {
            cemuInstance._emu_set_key_state(calcKeyId, isDown);
            event.preventDefault();
        }
    }
})();
