// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cheerio from 'cheerio';
import { mwn } from 'mwn';

import { MathConverter } from "./math-converter";

const TurndownService = require('turndown');
const turndownPluginGfm = require('@joplin/turndown-plugin-gfm');


const baseUrl = "https://www.vasp.at";
let mathConverter: MathConverter;

interface PageInfo {
	title: string,
	body: string
}

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
	// markdownStr = formatDefault(markdownStr, incarTag);
	// markdownStr = formatDescription(markdownStr, incarTag);

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

	const bot = new mwn({
		apiUrl: "https://www.vasp.at/wiki/api.php"
	});

	const pageIds: number[] = [];

	for await (let response of bot.continuedQueryGen({
		format: "json",
		action: "query",
		list: "categorymembers",
		cmtitle: "Category:INCAR_tag",
		cmprop: "title|ids",
		cmlimit: "max"
	})) {
		if (response.query) {
			pageIds.push(...
				response.query.categorymembers.filter((member: any) => {
					const title: string = member.title;
					return !title.startsWith("Construction:");
				}).map((member: any) => member.pageid)
			);
		}
	}

	const pages: PageInfo[] = [];

	for await (let response of bot.massQueryGen({
		format: "json",
		action: "query",
		pageids: pageIds,
		export: true
	}, "pageids")) {
		const $ = cheerio.load(response.query?.export, {
			xmlMode: true
		});
		for (let page of $("page")) {
			const title = $(page).find("title").first().text();
			let body = $(page).find("text").first().text();

			let maxEnd = body.lastIndexOf("\n");
			maxEnd = maxEnd >= 0 ? maxEnd : body.length;
			let end = maxEnd;
			let newEnd = body.search(/\s*\n----\s*\n/);
			end = newEnd >= 0 ? Math.min(end, newEnd) : end;
			newEnd = body.search(/\s*\n\s*<hr \/>/);
			end = newEnd >= 0 ? Math.min(end, newEnd) : end;

			pages.push({
				title: title,
				body: body.slice(0, end)
			});
		}
	}

	const combinedText = pages.map(info => `<div class="incarTag" title="${info.title}">${info.body}</div>`).join("");
	const tmp = await bot.parseWikitext(combinedText);
	const $ = cheerio.load(tmp);

	const buffer = new Map<string, vscode.MarkdownString>();
	$("div.incarTag").each((_, e) => {
		const title = e.attribs.title.toUpperCase();
		const html = $(e).html();
		if (title && html) {
			buffer.set(title, convertToMarkdown(html, title));
		}
	});

	vscode.languages.registerHoverProvider("plaintext", {
		async provideHover(document, position, token) {
			const range = document.getWordRangeAtPosition(position);
			const word = document.getText(range).toUpperCase();

			const markdown = buffer.get(word);
			if (markdown) {
				return new vscode.Hover(markdown);
			}
			return null;
		}
	});
}

export function deactivate() {}
