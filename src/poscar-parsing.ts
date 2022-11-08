import * as vscode from "vscode";
import { countUntil, isNumber, isInteger, isLetters } from "./util";

export const tokenTypes = [
    "comment",
    "string",
    "number",
    "constant",
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
    "positions" |
    "positionsSelDyn" |
    "lattVelocitiesStart" |
    "lattVelocitiesState" |
    "lattVelocitiesVels" |
    "lattVelocitiesLatt" |
    "velocityMode" |
    "velocities";
    // "mdExtra";

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
        return tokenizeLine(line).map(t => {
            t.type = "comment";
            return t;
        });
    },
    scaling: line => {
        const tokens = tokenizeLine(line);
        const numVals = countUntil(tokens, t => !isNumber(t.text));

        if (numVals === 3) {
            tokens.slice(0, 3).forEach(t => t.type = +t.text > 0 ? "number" : "invalid");
        } else {
            tokens.slice(0, numVals).forEach((t, tIdx) => {
                t.type = tIdx < 3 ? "number" : "invalid";
            });
        }
        tokens.slice(numVals).forEach(t => t.type = "comment");

        return tokens;
    },
    lattice: tokenizeVector,
    speciesNames: line => {
        return tokenizeLine(line).map(t => {
            t.type = isLetters(t.text) ? "string" : "invalid";
            return t;
        });
    },
    numAtoms: line => {
        const tokens = tokenizeLine(line);
        const numVals = countUntil(tokens, t => !isInteger(t.text));

        tokens.slice(0, numVals).forEach(t => t.type = "number");
        tokens.slice(numVals).forEach(t => t.type = "comment");
        return tokens;
    },
    selDynamics: line => tokenizeConstLine(line, /^[sS]/),
    positionMode: tokenizeConstLine,
    positions: tokenizeVector,
    positionsSelDyn: line => {
        return tokenizeLine(line).map((t, tIdx) => {
            if (tIdx < 3) {
                t.type = isNumber(t.text) ? "number" : "invalid";
            } else if (tIdx < 6) {
                t.type = t.text === "T" || t.text === "F" ? "constant" : "invalid";
            } else {
                t.type = "comment";
            }
            return t;
        });
    },
    lattVelocitiesStart: line => tokenizeConstLine(line, /^[lL]/),
    lattVelocitiesState: line => {
        const tokens = tokenizeLine(line);
        tokens.forEach((t, tIdx) => {
            if (tIdx > 0) {
                t.type = "comment";
            } else if (isInteger(t.text)) {
                t.type = "number";
            } else {
                t.type = "invalid";
            }
        });
        return tokens;
    },
    lattVelocitiesVels: tokenizeVector,
    lattVelocitiesLatt: tokenizeVector,
    velocityMode: tokenizeConstLine,
    velocities: tokenizeVector
};

function tokenizeVector(line: vscode.TextLine): Token[] {
    return tokenizeLine(line).map((t, tIdx) => {
        if (tIdx < 3 && isNumber(t.text)) {
            t.type = "number";
        } else if (tIdx >= 3) {
            t.type = "comment";
        } else {
            t.type = "invalid";
        }
        return t;
    });
}

function tokenizeConstLine(line: vscode.TextLine, test?: RegExp): Token[] {
    const tokens = tokenizeLine(line);
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
    return tokens;
}

function tokenizeLine(line: vscode.TextLine): Token[] {
    const matcher = /^(\s*)(\S+)(.*)$/;
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

    function processLine(type: PoscarBlockType, repeat?: number, optionalTest?: (tokens: Token[]) => boolean): boolean {
        const myRepeat = repeat ? repeat : 1;
        let isOk = true;
        for (let iter = 0; iter < myRepeat; ++iter) {
            if (document.lineCount > nextLineIdx) {
                const line = document.lineAt(nextLineIdx++);
                const tokens = tokenizers[type](line);
                if (optionalTest && !optionalTest(tokens)) {
                    --nextLineIdx;
                    isOk = false;
                } else {
                    poscarLines.push({
                        type: type,
                        tokens: tokens,
                        line: line
                    });
                    isOk &&= true;
                }
            }
            isOk &&= true;
        }
        return isOk;
    }

    processLine("comment");
    processLine("scaling");
    processLine("lattice", 3);
    processLine("speciesNames", 1, tokens => tokens.length > 0 && tokens[0].type === "string");
    processLine("numAtoms");

    const numAtoms = getNumAtoms(poscarLines[poscarLines.length - 1].tokens);
    
    const selDyn = processLine("selDynamics", 1, tokens => tokens.length > 0 && tokens[0].type === "constant");
    processLine("positionMode");
    processLine(selDyn ? "positionsSelDyn" : "positions", numAtoms);

    if (processLine("lattVelocitiesStart", 1, tokens => tokens.length > 0 && tokens[0].type === "constant")) {
        processLine("lattVelocitiesState");
        processLine("lattVelocitiesVels", 3);
        processLine("lattVelocitiesLatt", 3);
    }

    processLine("velocityMode");
    processLine("velocities", numAtoms);

    return poscarLines;
}
