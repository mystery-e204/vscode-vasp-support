import * as vscode from 'vscode';
import { MathConverter } from './math-converter';
import TurndownService from 'turndown';

const turndownPluginGfm = require('@joplin/turndown-plugin-gfm');

export class HtmlToMarkdownConverter {
    private mathConverter: MathConverter;
	private turndownService: TurndownService;

    constructor(mathConverter: MathConverter) {
        this.mathConverter = mathConverter;
		this.turndownService = this.createTurndownService();
    }

    convert(html: string): string {
		return this.turndownService.turndown(html);
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
