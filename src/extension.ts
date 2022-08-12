// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios from 'axios';
import * as cheerio from 'cheerio';

import { MathConverter } from "./math-converter";

const TurndownService = require('turndown');
const turndownPluginGfm = require('@joplin/turndown-plugin-gfm');


const baseUrl = "https://www.vasp.at";
const wikiUrl = "/wiki/index.php/";
let incarTags: string[];
let mathConverter: MathConverter;

function filterHtml(html: string): string {
	const $ = cheerio.load(html);
	let elems = $("#mw-content-text p:first");

	let outStr = elems.html();
	elems.nextUntil("hr").each((_, el) => {
		outStr += $.html(el);
	});

	return outStr ? outStr : "";
}

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

async function fetchIncarTags(relUrl: string): Promise<string[]> {
	return axios.get(`${baseUrl}${relUrl}`).then(response => {
		const $ = cheerio.load(response.data);
		const tags = $("#mw-pages .mw-category li").map((_, el) => $(el).text().replace(" ", "_")).toArray();
		const nextUrl = $("#mw-pages a[href][title='Category:INCAR tag']:contains('next page'):first").attr("href");

		if (nextUrl !== undefined) {
			return fetchIncarTags(nextUrl).then(nextTags => tags.concat(nextTags));
		}
		return tags;
	});
}

export async function activate(context: vscode.ExtensionContext) {
	incarTags = await fetchIncarTags(`${wikiUrl}Category:INCAR_tag`);
	incarTags = incarTags.map(t => t.toUpperCase());
	mathConverter = MathConverter.create();

	vscode.languages.registerHoverProvider("plaintext", {
		async provideHover(document, position, token) {
			const range = document.getWordRangeAtPosition(position);
			const word = document.getText(range).toUpperCase();

			if (incarTags.includes(word)) {
				try {
					const response = await axios.get(`${baseUrl}${wikiUrl}${word}`);
					const md = convertToMarkdown(filterHtml(response.data), word);
					return new vscode.Hover(md);
				} catch (error) {}
			}
			return null;
		}
	});
}

export function deactivate() {}
