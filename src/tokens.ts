import * as vscode from "vscode";
import { countUntil, isInteger, isNumber } from "./util";

const matcher = /^(\s*)(\S+)(.*)$/;

export interface Token {
    type?: TokenType;
    range: vscode.Range;
    text: string;
}

const tokenTypes = [
    "comment",
    "string",
    "number",
    "constant",
    "invalid"
] as const;

export type TokenType = (typeof tokenTypes)[number];
export type TokensTyper = (tokens: Token[]) => void;

export interface TokenizedLine {
    line: vscode.TextLine;
    tokens: Token[];
}
type Parser = (document: vscode.TextDocument) => TokenizedLine[];

const tokensLegend = new vscode.SemanticTokensLegend(tokenTypes.slice());

export function registerVaspSemanticTokensProvider(selector: vscode.DocumentSelector, parser: Parser): vscode.Disposable {
    return vscode.languages.registerDocumentSemanticTokensProvider(selector, {
		provideDocumentSemanticTokens(document, cancel) {
			const builder = new vscode.SemanticTokensBuilder(tokensLegend);
			const tokenizedLines = parser(document);
			tokenizedLines.forEach(tokenizedLine => {
				tokenizedLine.tokens.forEach(token => {
					if (token.type) {
						builder.push(token.range, token.type);
					}
				});
			});
			return builder.build();
		}
	}, tokensLegend);
}

export class Tokenizer {
    private nextLineIdx = 0;
    private document: vscode.TextDocument;

    public constructor(document: vscode.TextDocument) {
        this.document = document;
    }

    public tokenizeNextLine(tokensTyper: TokensTyper, optionalTest?: (tokens: Token[]) => boolean): TokenizedLine | null {
        if (this.nextLineIdx >= this.document.lineCount) {
            return null;
        }
        const line = this.document.lineAt(this.nextLineIdx++);
        const tokens = splitLineToTokens(line);
        tokensTyper(tokens);
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

export function setVectorTokens(tokens: Token[]) {
    tokens.forEach((t, tIdx) => {
        if (tIdx < 3 && isNumber(t.text)) {
            t.type = "number";
        } else if (tIdx >= 3) {
            t.type = "comment";
        } else {
            t.type = "invalid";
        }
    });
}

export function setCountListTokens(tokens: Token[], amount?: number) {
    if (amount) {
        tokens.slice(0, amount).forEach(t =>
            t.type = isInteger(t.text) && +t.text > 0 ? "number" : "invalid"
        );
        tokens.slice(amount).forEach(t => t.type = "comment");
    } else {
        const numVals = countUntil(tokens, t => !isInteger(t.text) || +t.text <= 0);
        tokens.slice(0, numVals).forEach(t => t.type = "number");
        tokens.slice(numVals).forEach(t => t.type = "comment");
    }
}

export function setConstLineTokens(tokens: Token[], test?: RegExp) {
    if (tokens.length > 0) {
        if (test && !test.test(tokens[0].text)) {
            tokens.forEach(t => t.type = "invalid");
        } else {
            let foundComment = false;
            for (let t of tokens) {
                foundComment ||= /^[#!%]/.test(t.text);
                t.type = foundComment ? "comment" : "constant";
            }   
        }
    }
}