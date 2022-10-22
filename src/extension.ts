// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { MathConverter } from "./math-converter";
import { HtmlToMarkdownConverter } from './html-to-markdown';
import { getIncarTags } from './vasp-wiki';
import { IncarTag } from './incar-tag';
import { parsePoscar, poscarBlockInfo, legend } from './poscar';

const baseUrl = "https://www.vasp.at";
let incarTags: Map<string, vscode.MarkdownString>;

function updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
	if (document.languageId === "poscar") {
		const poscarLines = parsePoscar(document);
		collection.set(document.uri, poscarLines.flatMap(l => poscarBlockInfo[l.type].validate(l)));
	}
}

export async function activate(context: vscode.ExtensionContext) {
	const collection = vscode.languages.createDiagnosticCollection('test');
	if (vscode.window.activeTextEditor) {
		updateDiagnostics(vscode.window.activeTextEditor.document, collection);
	}
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			updateDiagnostics(editor.document, collection);
		}
	}));
	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
		if (event.document) {
			updateDiagnostics(event.document, collection);
		}
	}));

	vscode.languages.registerDocumentSemanticTokensProvider("poscar", {
		provideDocumentSemanticTokens(document, cancel) {
			const builder = new vscode.SemanticTokensBuilder(legend);
			const poscarLines = parsePoscar(document);
			poscarLines.forEach(poscarLine => {
				poscarLine.tokens.forEach(token => {
					if (token.type) {
						builder.push(token.range, token.type);
					}
				});
			});
			return builder.build();
		}
	}, legend);

	vscode.languages.registerCodeLensProvider("poscar", {
		provideCodeLenses(document, cancel): vscode.CodeLens[] {
			const codeLenses: vscode.CodeLens[] = [];

			const poscarLines = parsePoscar(document);
			if (poscarLines.length === 0) {
				return [];
			}
			
			let curType = poscarLines[0].type;
			codeLenses.push(new vscode.CodeLens(
				document.lineAt(0).range,
				{
					title: poscarBlockInfo[curType].description,
					command: ""
				}
			));

			poscarLines.forEach((line, lineNumber) => {
				if (curType !== line.type) {
					curType = line.type;
					codeLenses.push(new vscode.CodeLens(
						document.lineAt(lineNumber).range,
						{
							title: poscarBlockInfo[curType].description,
							command: ""
						}
					));
				}
			});

			return codeLenses;
		}
	});

	const mathConverter = new MathConverter();
	const htmlToMarkdownConverter = new HtmlToMarkdownConverter(mathConverter);

	const incarTagHtmls = await getIncarTags(baseUrl);
	incarTags = new Map();
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
