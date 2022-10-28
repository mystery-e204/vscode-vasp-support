import * as vscode from "vscode";

export class IncarTag {
    name: string;
    valueStr?: string;
    values?: string[];
    defaultValue?: string;
    description?: string;

    constructor(name: string, valueStr?: string, values?: string[], defaultValue?: string, description?: string) {
        this.name = name;
        this.valueStr = valueStr;
        this.values = values;
        this.defaultValue = defaultValue;
        this.description = description;
    }

    static fromMarkdown(markdown: string, tagName: string): IncarTag {
        enum Mode {
            value,
            default,
            defaultTable,
            description,
            moreDescription
        }
    
        const incarTag = new IncarTag(tagName);
        const lines = markdown.split("\n");
        let mode = Mode.value;
    
        lines.forEach(line => {
            line = line.trim();
    
            switch (mode) {
                case Mode.value:
                    if (line) {
                        const parts = line.split("=");
                        if (parts.length >= 2) {
                            incarTag.valueStr = parts[1].trim();
                            incarTag.values = incarTag.valueStr.split("|").map(
                                s => s.trim()
                            ).filter(
                                s => s && !(s.startsWith("[") || s.endsWith("]") || s.includes(" "))
                            );
                        } else {
                            incarTag.valueStr = line;
                        }
                        mode = Mode.default;
                    }
                    break;
                case Mode.default:
                    if (line) {
                        let match = line.match(RegExp(`^Default: *(\\**${incarTag}\\** *=)? *(.*)`));
                        if (match) {
                            incarTag.defaultValue = match[2];
                            mode = Mode.description;
                        } else if (line.startsWith("|")) {
                            incarTag.defaultValue = line;
                            mode = Mode.defaultTable;
                        }
                    }
                    break;
                case Mode.defaultTable:
                    if (line.startsWith("|")) {
                        const rep = line.replace(/^\| *Default: */, "| ");
                        incarTag.defaultValue += `\n${rep}`;
                    } else {
                        mode = Mode.description;
                    }
                    break;
                case Mode.description:
                    if (line) {
                        const match = line.match(/^Description: *(.*)/);
                        if (match) {
                            incarTag.description = match[1].trim();
                        } else {
                            incarTag.description = line;
                        }
                        mode = Mode.moreDescription;
                    }
                    break;
                case Mode.moreDescription:
                    incarTag.description += `\n${line}`;
                    break;
                default:
                    break;
            }
        });
    
        return incarTag;
    }

    static fromObject(obj: Record<string, string>): IncarTag {
        return Object.assign(new IncarTag(""), obj);
    }

    getHoverText(baseUrl: string): vscode.MarkdownString {
        let markdownStr = `# [${this.name}](/wiki/index.php/${this.name} "${this.name}")`;
    
        function writeBlock(name: string, value?: string) {
            return value ? `\n\n---\n\n## ${name}\n\n${value}` : "";
        }
    
        markdownStr += writeBlock("Value", this.valueStr);
        markdownStr += writeBlock("Default", this.defaultValue);
        markdownStr += writeBlock("Description", this.description);
    
        const markdown = new vscode.MarkdownString(markdownStr);
        markdown.baseUri = vscode.Uri.parse(baseUrl);
        return markdown;
    }
}
