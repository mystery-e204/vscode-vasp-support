import * as vscode from "vscode";
import { countUntil, isNumber, isLetters } from "./util";
import { Token, TokenTypeSetter, DocumentParser, ParsedLine, setVectorTokens, setConstLineTokens, setCountListTokens } from "./parsing-base";

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

export interface PoscarLine extends ParsedLine {
    type: PoscarBlockType;
}

const tokenSetters: Readonly<Record<PoscarBlockType, TokenTypeSetter>> = {
    comment: tokens => {
        tokens.forEach(t => t.type = "comment");
    },
    scaling: tokens => {
        const numVals = countUntil(tokens, t => !isNumber(t.text));

        if (numVals === 3) {
            tokens.slice(0, 3).forEach(t => {
                t.type = +t.text > 0 ? "number" : "invalid";
            });
        } else {
            tokens.slice(0, numVals).forEach((t, tIdx) => {
                t.type = tIdx < 3 ? "number" : "invalid";
            });
        }
        tokens.slice(numVals).forEach(t => t.type = "comment");
    },
    lattice: setVectorTokens,
    speciesNames: tokens => {
        tokens.forEach(t => {
            t.type = isLetters(t.text) ? "string" : "invalid";
        });
    },
    numAtoms: setCountListTokens,
    selDynamics: tokens => setConstLineTokens(tokens, /^[sS]/),
    positionMode: setConstLineTokens,
    positions: setVectorTokens,
    positionsSelDyn: tokens => {
        tokens.forEach((t, tIdx) => {
            if (tIdx < 3) {
                t.type = isNumber(t.text) ? "number" : "invalid";
            } else if (tIdx < 6) {
                t.type = t.text === "T" || t.text === "F" ? "constant" : "invalid";
            } else {
                t.type = "comment";
            }
        });
    },
    lattVelocitiesStart: tokens => setConstLineTokens(tokens, /^[lL]/),
    lattVelocitiesState: tokens => setCountListTokens(tokens, 1),
    lattVelocitiesVels: setVectorTokens,
    lattVelocitiesLatt: setVectorTokens,
    velocityMode: setConstLineTokens,
    velocities: setVectorTokens
};

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
    const parser = new DocumentParser(document);

    function processLine(type: PoscarBlockType, repeat?: number, optionalTest?: (tokens: Token[]) => boolean): boolean {
        const myRepeat = repeat ? repeat : 1;
        for (let iter = 0; iter < myRepeat; ++iter) {
            const parsedLine = parser.parseNextLine(tokenSetters[type], optionalTest);
            if (!parsedLine) {
                return false;
            } else if (parsedLine.tokens.length > 0) {
                poscarLines.push({
                    type: type,
                    tokens: parsedLine.tokens,
                    line: parsedLine.line
                });
            }
        }
        return true;
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
