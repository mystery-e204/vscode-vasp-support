// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios from 'axios';
import * as cheerio from 'cheerio';
const TurndownService = require('turndown');
const turndownPluginGfm = require('@joplin/turndown-plugin-gfm');

function filterHtml(html: string): string {
	const $ = cheerio.load(html);
	let elems = $("#mw-content-text p:first");

	let outStr = elems.html();
	elems.nextUntil("hr").each((_, el) => {
		outStr += $.html(el);
	});

	return outStr ? outStr : "";
}

function convertToMarkdown(html: string, word: string): string {
	const turndownService = new TurndownService({
		emDelimiter: "*",
		hr: "---"
	});
	turndownService.use(turndownPluginGfm.tables);

	let markdown: string = "# " + word + "\n\n";
	markdown += turndownService.turndown(html);

	return markdown;
}

function formatDefault(markdown: string, word: string): string {
	const match = markdown.match(RegExp("(.*?) *Default: *(\\**" + word + "\\**)? *(.*)", "s"));
	if (match !== null) {
		return match[1].replace(/(.*)\n\n/s, "$1\n\n---\n\n## Default\n\n") + match[3];
	}
	return markdown;
}

function formatDescription(markdown: string, word: string): string {
	return markdown.replace(/^ *Description: */m, "---\n\n## Description\n\n");
}

function fixWikiLinks(markdown: string, baseUrl: string): string {
	return markdown.replace(/\]\((\/wiki\/[^\)]+)\)/g, "](" + baseUrl + "$1)");
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	vscode.languages.registerHoverProvider("plaintext", {
		provideHover(document, position, token) {
			const range = document.getWordRangeAtPosition(position);
			const word = document.getText(range);

			if (word === "IBRION") {
				return axios.get("https://www.vasp.at/wiki/index.php/IBRION")
					.then((response) => {
						let markdown = convertToMarkdown(filterHtml(response.data), word);
						markdown = formatDefault(markdown, word);
						markdown = formatDescription(markdown, word);
						markdown = fixWikiLinks(markdown, "https://www.vasp.at");
						return new vscode.Hover(markdown);
					}, null);
			}

			return null;
		}
	});
}

// this method is called when your extension is deactivated
export function deactivate() {}
