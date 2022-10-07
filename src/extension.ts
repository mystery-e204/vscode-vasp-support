// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { MathConverter } from "./math-converter";
import { getIncarTags } from './vasp-wiki';

const TurndownService = require('turndown');
const turndownPluginGfm = require('@joplin/turndown-plugin-gfm');


const baseUrl = "https://www.vasp.at";
let mathConverter: MathConverter;
let incarTags: Map<string, vscode.MarkdownString>;

function getTextColor(): string {
	const themeKind = vscode.window.activeColorTheme.kind;
	switch (themeKind) {
		case vscode.ColorThemeKind.Light:
			return "#616161";
		case vscode.ColorThemeKind.Dark:
			return "#CCCCCC";
		case vscode.ColorThemeKind.HighContrastLight:
			return "#000000";
		case vscode.ColorThemeKind.HighContrast:
			return "#FFFFFF";
		default:
			throw new Error("ColorThemeKind could not be determined");
	}
}

function turndownHtml(html: string): string {
	const turndownService = new TurndownService({
		emDelimiter: "*",
		hr: "---"
	});
	turndownService.use(turndownPluginGfm.tables);
	
	const svgToDataUri = function(svg: string): string {
		const newSvg = svg.replace(/="currentColor"/g, `="${getTextColor()}"`);
		return "data:image/svg+xml," + encodeURIComponent(newSvg);
	};

	turndownService.addRule("math", {
		filter: (node: any, options: any) => {
			return node.nodeName.toLowerCase() === "span"
				&& node.getAttribute("class")?.split(/\s+/)?.includes("mwe-math-element");
		},
		replacement: (content: any, node: any, options: any) => {
			const tex = node.querySelector("math[alttext]")?.getAttribute("alttext");
			if (tex) {
				const svg = mathConverter.convert(tex);
				return `![math](${svgToDataUri(svg)})`;
			}
			return "";
		}
	});

	return turndownService.turndown(html);
}

function convertToMarkdown(html: string, incarTag: string): vscode.MarkdownString {
	let markdownStr = formatMarkdown(turndownHtml(html), incarTag);

	const markdown = new vscode.MarkdownString(markdownStr);
	markdown.baseUri = vscode.Uri.parse(baseUrl);
	return markdown;
}

function formatMarkdown(markdown: string, incarTag: string): string {
	enum Mode {
		value,
		default,
		defaultTable,
		description,
		moreDescription
	}

	const lines = markdown.split("\n");
	let outStr = `# [${incarTag}](/wiki/index.php/${incarTag} "${incarTag}")`;
	let mode = Mode.value;

	lines.forEach(line => {
		line = line.trim();

		switch (mode) {
			case Mode.value:
				if (line) {
					const parts = line.split("=");
					if (parts.length >= 2) {
						outStr += `\n\n---\n\n## Value\n\n${parts[1].trim()}`;
					} else {
						outStr += `\n\n${line}`;
					}
					mode = Mode.default;
				}
				break;
			case Mode.default:
				if (line) {
					let match = line.match(RegExp(`^Default: *(\\**${incarTag}\\** *=)? *(.*)`));
					if (match) {
						outStr += `\n\n---\n\n## Default\n\n${match[2]}`;
						mode = Mode.description;
					} else if (line.startsWith("|")) {
						outStr += `\n\n---\n\n## Default\n\n${line}`;
						mode = Mode.defaultTable;
					}
				}
				break;
			case Mode.defaultTable:
				if (line.startsWith("|")) {
					const rep = line.replace(/^\| *Default: */, "| ");
					outStr += `\n${rep}`;
				} else {
					mode = Mode.description;
				}
				break;
			case Mode.description:
				if (line) {
					const match = line.match(/^Description: *(.*)/);
					if (match) {
						outStr += `\n\n---\n\n## Description\n\n${match[1].trim()}`;
					}
					mode = Mode.moreDescription;
				}
				break;
			case Mode.moreDescription:
				outStr += `\n${line}`;
				break;
			default:
				break;
		}
	});

	return outStr;
}


export async function activate(context: vscode.ExtensionContext) {
	mathConverter = MathConverter.create();

	const incarTagHtmls = await getIncarTags(baseUrl);
	incarTags = new Map();
	incarTagHtmls.forEach((val, key) => {
		incarTags.set(key, convertToMarkdown(val, key));
	});

	vscode.languages.registerHoverProvider("incar", {
		async provideHover(document, position, token) {
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
