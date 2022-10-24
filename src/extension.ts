// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { MathConverter } from "./math-converter";
import { HtmlToMarkdownConverter } from './html-to-markdown';
import { getIncarTags } from './vasp-wiki';
import { IncarTag } from './incar-tag';
import { registerPoscarCodeLensProvider, registerPoscarSemanticTokensProvider } from './poscar-providers';
import { registerPoscarLinter } from './poscar-linting';

const baseUrl = "https://www.vasp.at";

export async function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(registerPoscarSemanticTokensProvider("poscar"));
	context.subscriptions.push(registerPoscarCodeLensProvider("poscar"));
	context.subscriptions.push(...registerPoscarLinter("poscar"));

	const mathConverter = new MathConverter();
	const htmlToMarkdownConverter = new HtmlToMarkdownConverter(mathConverter);

	const incarTagHtmls = await getIncarTags(baseUrl);
	const incarTags = new Map<string, vscode.MarkdownString>();
	incarTagHtmls.forEach((val, key) => {
		const markdownStr = htmlToMarkdownConverter.convert(val);
		const incarTag = IncarTag.fromMarkdown(markdownStr, key);
		incarTags.set(key, incarTag.getHoverText(baseUrl));
	});

	vscode.languages.registerHoverProvider("incar", {
		provideHover(document, position, cancel) {
			const range = document.getWordRangeAtPosition(position);
			const word = document.getText(range).toUpperCase();

			const markdown = incarTags.get(word);
			if (markdown) {
				return new vscode.Hover(markdown);
			}
			return null;
		}
	});
}

export function deactivate() {}
