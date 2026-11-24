# TI-Basic Plus CE

<img alt="Screenshot" src="https://raw.githubusercontent.com/TIny-Hacker/language-ti-basic/main/assets/screenshot.png" width="250" />

## About
This extension provides syntax highlighting, snippets (provided by [Hamburger317](https://github.com/Hamburger317)), TI-BASIC program import and export, and an integrated CEmu calculator for the (e)Z80 TI-BASIC language. Import and export use an Emscripten build of [tivars_lib_cpp](https://github.com/adriweb/tivars_lib_cpp), courtesy of [Adriweb](https://github.com/adriweb/). Thanks to [nineteendo](https://github.com/nineteendo) for helping debug and improve the highlighting. The extension is intended for TI-84 Plus CE/83 Premium CE calculators, though it may work with others.

## Installation
Download a `.vsix` file from the [GitHub Releases](https://github.com/LucasLavalleeMA/language-ti-basic/releases) page and install it with **Extensions: Install from VSIX...** in VS Code. Once published, the extension will be available on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=LucasLavalleeMA.ti-basic-plus-ce).

## Using CEmu
Open a `.8xp` or `.83p` file and press <kbd>F5</kbd> to build and run it in CEmu. The TI-84 CE activity-bar view provides the embedded calculator. You must provide your own calculator ROM to use the embedded emulator; see the [CEmu setup walkthrough](walkthroughs/1-sidebar.md). Alternatively, configure a native CEmu installation in the `tibasic.cemu.executablePath` setting.

## FAQ
 * Q: Why can't I load my file in VSCode?<br/>
   A: The files on the calculator are not normal text files, they are binary files consisting of tokens which are represented by text in the TI-BASIC editor. To open a file from the calculator, you need to import it first [(see below)](#importing).
 * Q: Why can't I send my file to the calculator?<br/>
   A: For the same reason you can't load the calculator binaries into VS Code. If you wish to send the program, you'll first need to export it [(see below)](#exporting).

## Importing
To import a TI-BASIC program from your calculator, you'll first need to transfer it to your computer using software such as [TI-Connect CE](https://education.ti.com/en/products/computer-software/ti-connect-ce-sw) or [TiLP](http://lpg.ticalc.org/prj_tilp/). Now, create a new file in VS Code and press <kbd>ctrl</kbd> + <kbd>shift</kbd> + <kbd>P</kbd> to bring up the VS Code Command Palette. Search for and select "Import TI-BASIC Program":

![Import TI-BASIC Program](assets/import-command.png)

This will bring up a window where you can select the program you wish to import, using your system file manager. Select a file, and you're good to go!

## Exporting
To export a TI-BASIC program to a file you can transfer to your calculator, first open the file in VS Code. Next, press <kbd>ctrl</kbd> + <kbd>shift</kbd> + <kbd>P</kbd> to bring up the VS Code Command Palette. Search for and select "Export TI-BASIC Program":

![Export TI-BASIC Program](assets/export-command.png)

This will allow you to name and save the file. You can now use a program like [TI-Connect CE](https://education.ti.com/en/products/computer-software/ti-connect-ce-sw) or [TiLP](http://lpg.ticalc.org/prj_tilp/) to transfer the exported file to your calculator.

## Releases
Releases are built automatically when a version tag is pushed. Update the version in `package.json`, update `CHANGELOG.md`, then push a tag matching the package version (for example, `v1.0.5`). The workflow packages the extension as a `.vsix` file and attaches it to a GitHub Release with generated release notes.

## Bugs
If you find a bug or want something added, be sure to [make an issue](https://github.com/TIny-Hacker/language-ti-basic/issues) and let me know!

© Copyright 2023 - 2026 TIny_Hacker
