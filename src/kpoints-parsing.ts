//  row     explicit    regular     generalized     bandstruct  automatic
//  1       comment     -           -               -           -
//  2       n           0           0               n           0
//  3       coord       mode        coord           line        auto
//  4       k-point     subdiv      lattice         coord       length
//  5       ...         opt shift   ...             k-point
//  6       ...                     ...             ...
//  7       ...                     shift           ...

import * as vscode from "vscode";
import { DocumentParser, ParsedLine, setConstLineTokens, setCountListTokens, setVectorTokens, TokenTypeSetter } from "./parsing-base";
import { isNumber } from "./util";

type KPointsMode =
    "explicit" |
    "regularGrid" |
    "generalizedGrid" |
    "line" |
    "automatic";

type ModeProcessor = (lineProcessor: LineProcessor, numKPoints: number) => void;
type LineProcessor = (tokenSetter: TokenTypeSetter, repeat?: number) => boolean;

const modeProcessors: Readonly<Record<KPointsMode, ModeProcessor>> = {
    explicit: (lineProcessor, numKPoints) => {
        lineProcessor(setVectorTokens, numKPoints);
    },
    regularGrid: (lineProcessor, _) => {
        lineProcessor(tokens => setCountListTokens(tokens, 3));
        lineProcessor(setVectorTokens);
    },
    generalizedGrid: (lineProcessor, _) => {
        lineProcessor(setVectorTokens, 4);
    },
    line: (lineProcessor, _) => {
        lineProcessor(setConstLineTokens);
        while (lineProcessor(setVectorTokens)) {}
    },
    automatic: (lineProcessor, _) => {
        lineProcessor(tokens => {
            if (tokens.length > 0) {
                tokens[0].type = isNumber(tokens[0].text) && +tokens[0].text > 0 ? "number" : "invalid";
            }
            tokens.slice(1).forEach(t => t.type = "comment");
        });
    }
};

export function parseKpoints(document: vscode.TextDocument) {
    const parsedLines: ParsedLine[] = [];
    const parser = new DocumentParser(document);

    // Parse first three lines. This is the same in every file
    // Together, line 2 and 3 dictate the format of the rest of the file
    if (
        // line 1 - comment
        processLine(tokens => tokens.forEach(t => t.type = "comment")) &&
        // line 2 - number of k-points (0 for automatic generation)
        processLine(tokens => setCountListTokens(tokens, 1)) &&
        // line 3 - mode or coordinates
        processLine(setConstLineTokens)
    ) {
        const numKPoints = +parsedLines[1]?.tokens[0];
        const modeWord = parsedLines[2]?.tokens[0]?.text;
        if (numKPoints && modeWord) {
            const mode = getKPointsMode(numKPoints, modeWord);
            if (mode) {
                modeProcessors[mode](processLine, numKPoints);
            }
        }
    }

    function processLine(tokenSetter: TokenTypeSetter, repeat?: number): boolean {
        const myRepeat = repeat ? repeat : 1;
        for (let iter = 0; iter < myRepeat; ++iter) {
            const parsedLine = parser.parseNextLine(tokenSetter);
            if (!parsedLine) {
                return false;
            } else if (parsedLine.tokens.length > 0) {
                parsedLines.push(parsedLine);
            }
        }
        return true;
    }
}

function getKPointsMode(numKPoints: number, modeWord: string): KPointsMode | null {
    if (numKPoints < 0) {
        return null;
    } else if (numKPoints === 0) {
        if (/^[aA]/.test(modeWord)) {
            return "automatic";
        } else if (/^[gGmM]/.test(modeWord)) {
            return "regularGrid";
        } else {
            return "generalizedGrid";
        }
    } else {
        if (/^[lL]/.test(modeWord)) {
            return "line";
        } else {
            return "explicit";
        }
    }
}