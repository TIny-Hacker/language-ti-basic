# The calculator lives in the sidebar

Click the **TI-84 CE** icon in the activity bar (or run **TI-BASIC: Show CEmu Calculator (Sidebar)**). The calculator screen appears inside VS Code and keeps running while the sidebar is hidden.

- Click the screen to give it keyboard focus. Arrow keys, digits, `Enter`, `Backspace` and `Esc` map to the calculator keys; `Shift` is **2nd** and `Ctrl` is **alpha**.
- The icon at the top right of the view pops the calculator out into an editor tab.

## If the sidebar shows a setup page instead

That means this install has no embedded emulator (`media/cemu/cemu.js` and `cemu.wasm` are missing), or `tibasic.cemu.mode` is `external`. The setup page launches the native CEmu application instead, and steps 4 and 5 cover it.
