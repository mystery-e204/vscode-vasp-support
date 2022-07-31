// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios from 'axios';
import * as cheerio from 'cheerio';
const TurndownService = require('turndown');
const turndownPluginGfm = require('@joplin/turndown-plugin-gfm');

const baseUrl = "https://www.vasp.at";
let incarTags: string[];

function getTagUrl(incarTag: string): string {
	return `${baseUrl}/wiki/index.php/${incarTag}`;
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

function convertToMarkdown(html: string, incarTag: string): string {
	const turndownService = new TurndownService({
		emDelimiter: "*",
		hr: "---"
	});
	turndownService.use(turndownPluginGfm.tables);

	return `# [${incarTag}](${getTagUrl(incarTag)})\n\n${turndownService.turndown(html)}`;
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

function fixWikiLinks(markdown: string, baseUrl: string): string {
	return markdown.replace(/\]\((\/wiki\/[^\)]+)\)/g, `](${baseUrl}$1)`);
}

async function fetchIncarTags(relUrl: string): Promise<string[]> {
	return axios.get(`${baseUrl}${relUrl}`).then(response => {
		const $ = cheerio.load(response.data);
		const tags = $("#mw-pages .mw-category li").map((_, el) => $(el).text().replace(" ", "_")).toArray();
		const nextUrl = $("#mw-pages a[href][title='Category:INCAR tag']:contains('next page'):first").attr("href");

		if (nextUrl !== undefined) {
			return fetchIncarTags(nextUrl).then(nextTags => tags.concat(nextTags), err => Promise.reject(err));
		}
		return tags;
	});
}

export function activate(context: vscode.ExtensionContext) {
	fetchIncarTags("/wiki/index.php/Category:INCAR_tag").then(tags => {
		incarTags = tags.map(t => t.toUpperCase());

		vscode.languages.registerHoverProvider("plaintext", {
			provideHover(document, position, token) {
				const range = document.getWordRangeAtPosition(position);
				const word = document.getText(range).toUpperCase();

				if (incarTags.includes(word)) {
					return axios.get(getTagUrl(word))
						.then((response) => {
							let markdown = convertToMarkdown(filterHtml(response.data), word);
							markdown = formatDefault(markdown, word);
							markdown = formatDescription(markdown, word);
							markdown = fixWikiLinks(markdown, baseUrl);
							return new vscode.Hover(markdown);
						}, null);
				}

				return null;
			}
		});
	});
}

export function deactivate() {}
