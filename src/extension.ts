// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { IncarTag } from './incar-tag';
import { fetchIncarTags } from './vasp-wiki';
import { registerPoscarCodeLensProvider, registerPoscarSemanticTokensProvider } from './poscar-providers';
import { registerPoscarLinter } from './poscar-linting';
import { logger } from './logger';

const baseUrl = "https://www.vasp.at";

export async function activate(context: vscode.ExtensionContext) {
	logger.initialize('VASP Support');
	logger.info('Extension activating...');

	try {
		context.subscriptions.push(registerPoscarSemanticTokensProvider("poscar"));
		context.subscriptions.push(registerPoscarCodeLensProvider("poscar"));
		context.subscriptions.push(...registerPoscarLinter("poscar"));
		logger.info('POSCAR providers registered');

		const incarTagsFileUri = vscode.Uri.joinPath(context.globalStorageUri, "incar-tags.json");
		let incarTags = await readIncarTags(incarTagsFileUri);
		logger.info(`Loaded ${incarTags.length} INCAR tags from cache`);
		let incarHovers = new Map(incarTags.map(t => [t.name, t.getHoverText(baseUrl)]));

		const hoverProvider = vscode.languages.registerHoverProvider("incar", {
			provideHover(document, position, cancel) {
				const range = document.getWordRangeAtPosition(position);
				const word = document.getText(range).toUpperCase();

				const markdown = incarHovers.get(word);
				return markdown ? new vscode.Hover(markdown) : null;
			}
		});
		context.subscriptions.push(hoverProvider);
		logger.info('INCAR hover provider registered');

		// Fetch updated tags in the background without blocking activation
		logger.info('Fetching latest INCAR tags from VASP wiki...');
		fetchIncarTags(baseUrl)
			.then(updatedTags => {
				incarTags = updatedTags;
				incarHovers = new Map(incarTags.map(t => [t.name, t.getHoverText(baseUrl)]));
				logger.info(`Successfully fetched ${updatedTags.length} INCAR tags from wiki`);
				return writeIncarTags(incarTagsFileUri, incarTags);
			})
			.then(() => {
				logger.info('INCAR tags cache updated');
			})
			.catch(error => {
				logger.error('Failed to fetch INCAR tags from VASP wiki', error);
				vscode.window.showWarningMessage(
					'VASP Support: Could not fetch latest INCAR documentation. Using cached data.',
					'Retry'
				).then(selection => {
					if (selection === 'Retry') {
						vscode.commands.executeCommand('workbench.action.reloadWindow');
					}
				});
			});

		logger.info('Extension activated successfully');
	} catch (error) {
		logger.error('Failed to activate VASP Support extension', error);
		vscode.window.showErrorMessage(
			`VASP Support: Extension activation failed. ${error instanceof Error ? error.message : 'Unknown error'}`
		);
		throw error;
	}
}

async function writeIncarTags(uri: vscode.Uri, incarTags: IncarTag[]) {
	try {
		// Ensure the directory exists
		const dirUri = vscode.Uri.joinPath(uri, '..');
		await vscode.workspace.fs.createDirectory(dirUri);
		
		const buffer = Buffer.from(JSON.stringify(incarTags));
		await vscode.workspace.fs.writeFile(uri, Uint8Array.from(buffer));
		logger.info(`Wrote ${incarTags.length} INCAR tags to cache`);
	} catch (error) {
		logger.error('Failed to write INCAR tags to cache', error);
		// Non-fatal: extension continues to work with current in-memory data
	}
}

async function readIncarTags(uri: vscode.Uri): Promise<IncarTag[]> {
	try {
		const buffer = await vscode.workspace.fs.readFile(uri);
		const objList: Record<string, string>[] = JSON.parse(buffer.toString());
		return objList.map(obj => IncarTag.fromObject(obj));
	} catch (error) {
		// File doesn't exist or is corrupted - return empty array
		// This is expected on first run
		logger.info('No cached INCAR tags found (expected on first run)');
		return [];
	}
}

export function deactivate() {
	logger.info('Extension deactivating...');
	logger.dispose();
}
