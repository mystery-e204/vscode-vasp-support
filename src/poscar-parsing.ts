import * as vscode from "vscode";

export const tokenTypes = [
    "comment",
    "string",
    "number",
    "keyword",
    "invalid"
] as const;

type TokenType = (typeof tokenTypes)[number];

export type PoscarBlockType = 
    "comment" |
    "scaling" |
    "lattice" |
    "speciesNames" |
    "numAtoms" |
    "selDynamics" |
    "positionMode" |
    "positions" ;//|
    // "lattVelocities" |
    // "atomVelocities" |
    // "mdExtra";

interface PoscarBlock {
    description: string;
    tokenize: (line: vscode.TextLine) => Token[];
    validate: (poscarLine: PoscarLine) => vscode.Diagnostic[];
}

export interface PoscarLine {
    type: PoscarBlockType;
    tokens: Token[];
    line: vscode.TextLine;
}

interface Token {
    type?: TokenType;
    range: vscode.Range;
    text: string;
}

type Tokenizer = (line: vscode.TextLine) => Token[];

const tokenizers: Readonly<Record<PoscarBlockType, Tokenizer>> = {
    comment: line => {
        const token = getLineAsToken(line);
        if (token) {
            token.type = "comment";
        }
        return token ? [token] : [];
    },
    scaling: line => {
        const tokens = splitLineToTokens(line);
        if (tokens.length === 1 && isNumber(tokens[0].text)) {
            tokens[0].type = "number";
        } else if (tokens.length === 2) {
            tokens.forEach(t => t.type = "invalid");
        } else {
            tokens.forEach((t, tIdx) => {
                if (tIdx < 3 && isNumber(t.text) && +t.text > 0) {
                    t.type = "number";
                } else if (tIdx >= 3) {
                    t.type = "comment";
                } else {
                    t.type = "invalid";
                }
            });
        }
        return tokens;
    },
    lattice: line => {
        const tokens = splitLineToTokens(line);
        if (tokens.length < 3) {
            tokens.forEach(t => t.type = "invalid");
        } else {
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
        return tokens;
    },
    speciesNames: line => {
        return splitLineToTokens(line).map(t => {
            t.type = isLetters(t.text) ? "string" : "invalid";
            return t;
        });
    },
    numAtoms: line => {
        return splitLineToTokens(line).map(t => {
            t.type = isInteger(t.text) ? "number" : "invalid";
            return t;
        });
    },
    selDynamics: line => {
        const token = getLineAsToken(line);
        if (token) {
            token.type = /^[sS]/.test(token.text) ? "keyword" : "invalid";
            return [token];
        }
        return [];
    },
    positionMode: line => {
        const token = getLineAsToken(line);
        if (token) {
            token.type = "keyword";
            return [token];
        }
        return [];
    },
    positions: line => {
        const tokens = splitLineToTokens(line);
        if (tokens.length < 3) {
            tokens.forEach(t => t.type = "invalid");
        } else {
            tokens.forEach((t, tIdx) => {
                if (tIdx < 3) {
                    t.type = isNumber(t.text) ? "number" : "invalid";
                } else if (tIdx < 6) {
                    t.type = t.text === "T" || t.text === "F" ? "keyword" : "invalid";
                } else {
                    t.type = "comment";
                }
            });
        }
        return tokens;
    }
};

export function isNumber(str: string): boolean {
    return !Number.isNaN(+str);
}

export function isInteger(str: string): boolean {
    return isNumber(str) && Number.isSafeInteger(+str);
}

export function isLetters(str: string): boolean {
    return /^[a-zA-Z]+$/.test(str);
}

function getLineAsToken(line: vscode.TextLine): Token | null {
    const token = tokenizeLine(line, /^(\s*)(\S.*?)(\s*)$/);
    if (token) {
        return token[0];
    } else {
        return null;
    }
}

function splitLineToTokens(line: vscode.TextLine): Token[] {
    return tokenizeLine(line, /^(\s*)(\S+)(.*)$/);
}

function tokenizeLine(line: vscode.TextLine, matcher: RegExp): Token[] {
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

function getNumAtoms(tokens: Token[]): number {
    let numAtoms = 0;
    for (const token of tokens) {
        if (token.type === "number") {
            numAtoms += +token.text;
        } else {
            break;
        }
    }
    return numAtoms;
}

export function parsePoscar(document: vscode.TextDocument): PoscarLine[] {
    const poscarLines: PoscarLine[] = [];
    let nextLineIdx = 0;

    function processLine(type: PoscarBlockType, optionalTest?: (tokens: Token[]) => boolean): boolean {
        if (document.lineCount > nextLineIdx) {
            const line = document.lineAt(nextLineIdx++);
            const tokens = tokenizers[type](line);
            if (optionalTest && !optionalTest(tokens)) {
                --nextLineIdx;
            } else {
                poscarLines.push({
                    type: type,
                    tokens: tokens,
                    line: line
                });
            }
            return true;
        } else {
            return false;
        }
    }

    processLine("comment");
    processLine("scaling");
    processLine("lattice");
    processLine("lattice");
    processLine("lattice");
    processLine("speciesNames", tokens => tokens.length > 0 && tokens[0].type === "string");
    processLine("numAtoms");

    const numAtoms = getNumAtoms(poscarLines[poscarLines.length - 1].tokens);

    processLine("selDynamics", tokens => tokens.length > 0 && tokens[0].type === "keyword");
    processLine("positionMode");

    for (let atomIdx = 0; atomIdx < numAtoms; ++atomIdx) {
        processLine("positions");
    }

    return poscarLines;
}
