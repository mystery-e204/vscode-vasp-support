// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios from 'axios';
import * as cheerio from 'cheerio';
const TurndownService = require('turndown');
const turndownPluginGfm = require('@joplin/turndown-plugin-gfm');

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
						const $ = cheerio.load(response.data);
						let elems = $("#mw-content-text p:first");

						let htmlString = elems.html();
						elems.nextUntil("hr").each((i, el) => {
							htmlString += $.html(el);
						});

						const turndownService = new TurndownService({
							emDelimiter: "*",
							hr: "---"
						});
						turndownService.use(turndownPluginGfm.tables);

						let markdown: string = "# " + word + "\n\n";
						markdown += turndownService.turndown(htmlString);

						const match = markdown.match(RegExp("(.*?) *Default: *(\\**" + word + "\\**)? *(.*)", "s"));
						if (match !== null) {
							markdown = match[1].replace(/(.*)\n\n/s, "$1\n\n---\n\n## Default\n\n") + match[3];
						}

						console.log(markdown);
						markdown = markdown.replace(RegExp("^ *Description: *", "m"), "---\n\n## Description\n\n");

						return new vscode.Hover(markdown);
					}, null);
			}

			return null;
		}
	});
}

// this method is called when your extension is deactivated
export function deactivate() {}
