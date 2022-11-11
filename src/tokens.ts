import * as vscode from "vscode";

const matcher = /^(\s*)(\S+)(.*)$/;

export interface Token {
    type?: TokenType;
    range: vscode.Range;
    text: string;
}

export const tokenTypes = [
    "comment",
    "string",
    "number",
    "constant",
    "invalid"
] as const;

export interface ParsedLine {
    line: vscode.TextLine;
    tokens: Token[];
}

export type TokenType = (typeof tokenTypes)[number];
export type TokenTypeSetter = (tokens: Token[]) => void;

export class DocumentParser {
    private nextLineIdx = 0;
    private document: vscode.TextDocument;

    public constructor(document: vscode.TextDocument) {
        this.document = document;
    }

    public tokenizeNextLine(tokenSetter: TokenTypeSetter, optionalTest?: (tokens: Token[]) => boolean): ParsedLine | null {
        if (this.nextLineIdx >= this.document.lineCount) {
            return null;
        }
        const line = this.document.lineAt(this.nextLineIdx++);
        const tokens = splitLineToTokens(line);
        tokenSetter(tokens);
        if (optionalTest && !optionalTest(tokens)) {
            --this.nextLineIdx;
            return null;
        }
        return {
            line: line,
            tokens: tokens
        };
    }
}

function splitLineToTokens(line: vscode.TextLine): Token[] {
    const tokens: Token[] = [];
    let offset = 0;
    let matches = line.text.match(matcher);

    while (matches) {
        tokens.push({
            range: new vscode.Range(
                line.lineNumber, offset += matches[1].length,
                line.lineNumber, offset += matches[2].length
            ),
            text: matches[2]
        });
        matches = matches[3].match(matcher);
    }

    return tokens;
}