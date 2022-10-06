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
	let markdownStr = `# [${incarTag}](/wiki/index.php/${incarTag} "${incarTag}")\n\n`;
	markdownStr += turndownHtml(html);
	markdownStr = formatDefault(markdownStr, incarTag);
	markdownStr = formatDescription(markdownStr, incarTag);

	const markdown = new vscode.MarkdownString(markdownStr);
	markdown.baseUri = vscode.Uri.parse(baseUrl);
	return markdown;
}

function formatDefault(markdown: string, incarTag: string): string {
	const match = markdown.match(RegExp(`(.*?) *Default: *(\\**${incarTag}\\**)? *(.*)`, "s"));
	if (match !== null) {
		return match[1].replace(/(.*[^\|\n])\n+/s, "$1\n\n---\n\n## Default\n\n") + match[3];
	}
	return markdown;
}

function formatDescription(markdown: string, incarTag: string): string {
	return markdown.replace(/\n[\n ]*Description:[\n ]*/s, "\n\n---\n\n## Description\n\n");
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
