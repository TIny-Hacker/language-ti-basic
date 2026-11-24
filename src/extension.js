const path = require('path');
const vscode = require('vscode');
const TIVarsLib = require('./tivars_lib/TIVarsLib.js');
const fs = require('fs');
const { registerCEmu } = require('./cemu.js');
let lib;
TIVarsLib().then((_lib) => { lib = _lib; });

const DEST_KEY = 'tibasic.exportDestination';



/** Convert a native path to the /local/... path TIVarsLib's virtual FS expects. */
function toLibPath(fsPath) {
    return '/local' + fsPath.replace(/^[a-zA-Z]:/, '').split(path.sep).join(path.posix.sep);
}

/** Normalize line endings to CRLF and strip leading indentation. */
function buildSource(text) {
    let source = '';
    const lines = text.replaceAll(/(?<!\r)\n/gm, '\r\n').replaceAll('~','⁻').split('\r\n');

    for (let i = 0; i < lines.length; i++) {
        source += lines[i].trimStart() + '\r\n';
    }

    return source;
}

/** Write a TI-BASIC program to disk. Throws on failure. */
function writeProgram(text, name, outPath, type) {
    fs.writeFileSync(outPath, '');

    const prgm = lib.TIVarFile.createNew(
        lib.TIVarType.createFromName('Program'),
        name,
        lib.TIModel.createFromName(type)
    );
    prgm.setContentFromString(buildSource(text));
    prgm.saveVarToFile(toLibPath(outPath));
}

/** Get the saved destination folder, prompting the user to pick one if none is set. */
async function getDestination(context) {
    let dest = context.globalState.get(DEST_KEY);

    if (dest && fs.existsSync(dest)) {
        return dest;
    }

    const choice = await vscode.window.showWarningMessage(
        'No export destination folder is set.',
        'Set Destination Folder'
    );

    if (choice === 'Set Destination Folder') {
        return await pickDestination(context);
    }

    return undefined;
}

async function pickDestination(context) {
    const result = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Destination',
        title: 'Select folder to export TI-BASIC programs to'
    });

    if (result && result[0]) {
        const dest = result[0].fsPath;
        await context.globalState.update(DEST_KEY, dest);
        vscode.window.showInformationMessage('Export destination set to: ' + dest);
        return dest;
    }

    return undefined;
}

/**
 * @param {vscode.ExtensionContext} context
*/
function activate(context) {
    const importBasic = vscode.commands.registerCommand('extension.importTIBasic', () => {
        const windowoptions = {
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'TI-BASIC Program': ['8xp', '83p']
            },
            openLabel: 'Import',
            title: 'Select file to open'
        };

        vscode.window.showOpenDialog(windowoptions).then(fileUri => {
            if (fileUri && fileUri[0]) {
                console.log('Selected file: ' + fileUri[0].fsPath);
                const editor = vscode.window.activeTextEditor;

                if (editor == undefined) {
                    console.error('No text editor active. Create a new file first, then try again.');
                    vscode.window.showErrorMessage('Error: No text editor active. Create a new file first, then try again.');
                    return;
                }

                if (editor && lib) {
                    let prgm;

                    try {
                        prgm = lib.TIVarFile.loadFromFile(toLibPath(fileUri[0].fsPath));
                    } catch (error) {
                        console.error(error);
                        vscode.window.showErrorMessage('Error: ' + error.message);
                        return;
                    }

                    const options = new lib.options_t();
                    options.set("prettify", false);
                    options.set("reindent", true);
                    options.set("indent_n", vscode.workspace.getConfiguration('editor').get('tabSize'));
                    const reindented = prgm.getReadableContent(options);

                    if (reindented && reindented.length) {
                        const selection = editor.selection;

                        editor.edit(editBuilder => {
                            editBuilder.replace(selection, reindented);
                        });

                        vscode.languages.setTextDocumentLanguage(editor.document, "ti-basic");
                    }
                } else if (!lib) {
                    vscode.window.showErrorMessage('TIVarsLib not ready!');
                }
            } else {
                console.log('No file selected.');
            }
        });

		
    });

    const exportBasic = vscode.commands.registerCommand('extension.exportTIBasic', () => {
        const windowoptions = {
            filters: {
                'TI-BASIC Program': ['8xp', '83p']
            },
            title: 'Export'
        };

        vscode.window.showSaveDialog(windowoptions).then(fileUri => {
            if (fileUri) {
                console.log('Selected file: ' + fileUri.fsPath);
                const parsed = path.parse(fileUri.fsPath);
                const editor = vscode.window.activeTextEditor;

                if (editor && lib) {
                    const type = (parsed.ext === '.8xp' || parsed.ext === '') ? '84+CE' : '83+';

                    try {
                        writeProgram(editor.document.getText(), parsed.name, fileUri.fsPath, type);
                    } catch (error) {
                        console.error(error);
                        vscode.window.showErrorMessage('Error: ' + error.message);
                        return;
                    }
                } else if (!lib) {
                    vscode.window.showErrorMessage('TIVarsLib not ready!');
                }
            } else {
                console.log('No file selected.');
            }
        });
    });

    // 1. Set Destination Folder
    const setDestination = vscode.commands.registerCommand('extension.setTIBasicDestination', async () => {
        await pickDestination(context);
    });

    // 2. Export Active File (to destination folder, as .8xp)
    const exportActive = vscode.commands.registerCommand('extension.exportActiveTIBasic', async () => {
        if (!lib) {
            vscode.window.showErrorMessage('TIVarsLib not ready!');
            return;
        }

        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            vscode.window.showErrorMessage('Error: No text editor active.');
            return;
        }

        const dest = await getDestination(context);
        if (!dest) {
            return;
        }

        const name = path.parse(editor.document.fileName).name;
        const outPath = path.join(dest, name + '.8xp');

        try {
            writeProgram(editor.document.getText(), name, outPath, '84+CE');
            vscode.window.showInformationMessage('Exported ' + name + '.8xp to ' + dest);
        } catch (error) {
            console.error(error);
            vscode.window.showErrorMessage('Error: ' + error.message);
        }
    });

    // 3. Export Files in Folder (all .tib files in the workspace)
    const exportFolder = vscode.commands.registerCommand('extension.exportFolderTIBasic', async () => {
        if (!lib) {
            vscode.window.showErrorMessage('TIVarsLib not ready!');
            return;
        }

        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Error: No workspace folder is open.');
            return;
        }

        const dest = await getDestination(context);
        if (!dest) {
            return;
        }

        const files = await vscode.workspace.findFiles('**/*.tib', '**/node_modules/**');

        if (files.length === 0) {
            vscode.window.showWarningMessage('No .tib files found in the workspace.');
            return;
        }

        let success = 0;
        const failures = [];

        for (const uri of files) {
            const name = path.parse(uri.fsPath).name;

            try {
                // openTextDocument picks up unsaved edits if the file is open
                const doc = await vscode.workspace.openTextDocument(uri);
                writeProgram(doc.getText(), name, path.join(dest, name + '.8xp'), '84+CE');
                success++;
            } catch (error) {
                console.error(error);
                failures.push(name + ': ' + error.message);
            }
        }

        if (failures.length === 0) {
            vscode.window.showInformationMessage('Exported ' + success + ' file(s) to ' + dest);
        } else {
            vscode.window.showWarningMessage(
                'Exported ' + success + ' file(s), ' + failures.length + ' failed. ' + failures.join('; ')
            );
        }
    });

    context.subscriptions.push(importBasic, exportBasic, setDestination, exportActive, exportFolder);

    // Embedded CEmu calculator + "Compile and run in CEmu" task
    registerCEmu(context, { getLib: () => lib, writeProgram });
}

module.exports = {
    activate
}