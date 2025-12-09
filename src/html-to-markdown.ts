import * as vscode from 'vscode';
import { MathConverter } from './math-converter';
import TurndownService from 'turndown';
import { gfm } from '@joplin/turndown-plugin-gfm';

export class HtmlToMarkdownConverter {
    private mathConverter: MathConverter;
	private turndownService: TurndownService;
    private relativeURL?: string;

    constructor(mathConverter: MathConverter) {
        this.mathConverter = mathConverter;
		this.turndownService = this.createTurndownService();
    }

    convert(html: string, relativeURL?: string): string {
        this.relativeURL = relativeURL;
		return this.turndownService.turndown(html);
    }

    private createTurndownService(): TurndownService {
        const turndownService = new TurndownService({
            emDelimiter: "*",
            hr: "---"
        });
        turndownService.use(gfm);
        
        const svgToDataUri = function(svg: string): string {
            const newSvg = svg.replace(/="currentColor"/g, `="${getTextColor()}"`);
            return "data:image/svg+xml," + encodeURIComponent(newSvg);
        };
    
        turndownService.addRule("math", {
            filter: (node) => {
                return node.nodeName.toLowerCase() === "span"
                    && Boolean(node.getAttribute("class")?.split(/\s+/)?.includes("mwe-math-element"));
            },
            replacement: (_, node) => {
                const tex = node.querySelector("math[alttext]")?.getAttribute("alttext");
                if (tex) {
                    const svg = this.mathConverter.convert(tex);
                    return `![math](${svgToDataUri(svg)})`;
                }
                return "";
            }
        });

        // Handle code blocks that contain links - just remove the code block and keep the content
        turndownService.addRule("codeWithLinks", {
            filter: (node) => {
                return node.nodeName.toLowerCase() === "code"
                    && node.querySelector("a") !== null;
            },
            replacement: (content) => {
                // Just return the content without the code block wrapper
                return content;
            }
        });

        // Handle links to subsections (starting with #)
        turndownService.addRule("subsectionLinks", {
            filter: (node) => {
                return node.nodeName.toLowerCase() === "a"
                    && node.getAttribute("href")?.startsWith("#");
            },
            replacement: (content, node) => {
                const href = this.relativeURL + node.getAttribute("href");
                return `[${content}](${href})`;
            }
        });

		return turndownService;
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
