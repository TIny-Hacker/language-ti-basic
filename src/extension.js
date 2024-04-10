const path = require('path');
const vscode = require('vscode');
const TIVarsLib = require('./tivars_lib/TIVarsLib.js');
const fs = require('fs');
let lib;
TIVarsLib().then((_lib) => { lib = _lib; });

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

				if (editor && lib) {
					let prgm;

					try {
						prgm = lib.TIVarFile.loadFromFile('/local' + fileUri[0].fsPath.replace(/^[a-zA-Z]:/, '').split(path.sep).join(path.posix.sep));
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
				parsed = path.parse(fileUri.fsPath);
				const editor = vscode.window.activeTextEditor;

				if (editor && lib) {
					let prgm;
					let type;

					if (parsed.ext === '.8xp' || parsed.ext === '') {
						type = '84+CE';
					} else {
						type = '83+';
					}

					try {
						let source = "";
						let lines = editor.document.getText().replaceAll(/(?<!=\r)\n/gm, '\r\n').split('\r\n');

						for (let i = 0; i < lines.length; i++) {
							source += lines[i].trimStart() + '\r\n';
						}

						prgm = lib.TIVarFile.createNew(lib.TIVarType.createFromName("Program"), parsed.name, lib.TIModel.createFromName(type));
						prgm.setContentFromString(source);
						prgm.saveVarToFile('/local' + fileUri.fsPath.replace(/^[a-zA-Z]:/, '').split(path.sep).join(path.posix.sep));
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

	context.subscriptions.push(importBasic, exportBasic);
}

module.exports = {
	activate
}
