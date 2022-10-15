import * as vscode from 'vscode';
import { MathConverter } from './math-converter';
import TurndownService from 'turndown';

const turndownPluginGfm = require('@joplin/turndown-plugin-gfm');

export class HtmlToMarkdownConverter {
    private baseUrl: string;
    private mathConverter: MathConverter;
	private turndownService: TurndownService;

    constructor(baseUrl: string, mathConverter: MathConverter) {
        this.baseUrl = baseUrl;
        this.mathConverter = mathConverter;
		this.turndownService = this.createTurndownService();
    }

    convert(html: string, incarTag: string): vscode.MarkdownString {
		let markdownStr = this.turndownService.turndown(html);
        markdownStr = this.formatMarkdown(markdownStr, incarTag);
    
        const markdown = new vscode.MarkdownString(markdownStr);
        markdown.baseUri = vscode.Uri.parse(this.baseUrl);
        return markdown;
    }

    private createTurndownService(): TurndownService {
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
            filter: (node, options) => {
                return node.nodeName.toLowerCase() === "span"
                    && Boolean(node.getAttribute("class")?.split(/\s+/)?.includes("mwe-math-element"));
            },
            replacement: (content, node, options) => {
                const tex = node.querySelector("math[alttext]")?.getAttribute("alttext");
                if (tex) {
                    const svg = this.mathConverter.convert(tex);
                    return `![math](${svgToDataUri(svg)})`;
                }
                return "";
            }
        });

		return turndownService;
    }

	private formatMarkdown(markdown: string, incarTag: string): string {
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
