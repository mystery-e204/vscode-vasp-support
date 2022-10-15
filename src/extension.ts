// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { MathConverter } from "./math-converter";
import { HtmlToMarkdownConverter } from './html-to-markdown';
import { getIncarTags } from './vasp-wiki';

const baseUrl = "https://www.vasp.at";
let incarTags: Map<string, vscode.MarkdownString>;

export async function activate(context: vscode.ExtensionContext) {
	const mathConverter = new MathConverter();
	const htmlToMarkdownConverter = new HtmlToMarkdownConverter(baseUrl, mathConverter);

	const incarTagHtmls = await getIncarTags(baseUrl);
	incarTags = new Map();
	incarTagHtmls.forEach((val, key) => {
		incarTags.set(key, htmlToMarkdownConverter.convert(val, key));
	});

	vscode.languages.registerHoverProvider("incar", {
		provideHover(document, position, token) {
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
