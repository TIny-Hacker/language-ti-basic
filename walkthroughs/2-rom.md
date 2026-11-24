# Provide your ROM

The emulator has no calculator OS of its own. It needs a **ROM image dumped from your own TI-84 Plus CE** (or TI-83 Premium CE). It cannot be shipped with this extension, and you should not download one from the internet.

The easiest way to dump one is CEmu's built-in ROM wizard: install native CEmu (step 4), launch it once, and use the green **+** button on its first-run screen with your calculator connected.

Then run **TI-BASIC: Select TI-84 Plus CE ROM** (or set `tibasic.cemu.romPath`). The embedded calculator reads this file each time it starts.
