// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { IncarTag } from './incar-tag';
import { fetchIncarTags } from './vasp-wiki';
import { registerPoscarCodeLensProvider, registerPoscarSemanticTokensProvider } from './poscar-providers';
import { registerPoscarLinter } from './poscar-linting';

const baseUrl = "https://www.vasp.at";

export async function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(registerPoscarSemanticTokensProvider("poscar"));
	context.subscriptions.push(registerPoscarCodeLensProvider("poscar"));
	context.subscriptions.push(...registerPoscarLinter("poscar"));

	const incarTagsFileUri = vscode.Uri.joinPath(context.globalStorageUri, "incar-tags.json");
	let incarTags = await readIncarTags(incarTagsFileUri);
	let incarHovers = new Map(incarTags.map(t => [t.name, t.getHoverText(baseUrl)]));

	vscode.languages.registerHoverProvider("incar", {
		provideHover(document, position, cancel) {
			const range = document.getWordRangeAtPosition(position);
			const word = document.getText(range).toUpperCase();

			const markdown = incarHovers.get(word);
			return markdown ? new vscode.Hover(markdown) : null;
		}
	});

	incarTags = await fetchIncarTags(baseUrl);
	incarHovers = new Map(incarTags.map(t => [t.name, t.getHoverText(baseUrl)]));
	writeIncarTags(incarTagsFileUri, incarTags);
}

async function writeIncarTags(uri: vscode.Uri, incarTags: IncarTag[]) {
	const buffer = Buffer.from(JSON.stringify(incarTags));
	await vscode.workspace.fs.writeFile(uri, buffer);
}

async function readIncarTags(uri: vscode.Uri): Promise<IncarTag[]> {
    const buffer = await vscode.workspace.fs.readFile(uri).then(
		res => res,
		() => null
	);
	if (buffer) {
		const objList: Record<string, string>[] = JSON.parse(buffer.toString());
		return objList.map(obj => IncarTag.fromObject(obj));
	}
	return [];
}

export function deactivate() {}
