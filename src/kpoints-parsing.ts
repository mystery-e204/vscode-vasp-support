import * as vscode from "vscode";
import { Tokenizer, TokenizedLine, setConstLineTokens, setCountListTokens, setVectorTokens, TokensTyper, Parser } from "./tokens";
import { isInteger, isNumber } from "./util";

type KpointsMode =
    "explicit" |
    "regularGrid" |
    "generalizedGrid" |
    "line" |
    "automatic";

type ModeProcessor = (lineProcessor: LineProcessor, numKPoints: number) => void;
type LineProcessor = (tokensTyper: TokensTyper, repeat?: number) => boolean;

const modeProcessors: Readonly<Record<KpointsMode, ModeProcessor>> = {
    explicit: (lineProcessor, numKPoints) => {
        lineProcessor(tokens => {
            setVectorTokens(tokens);
            if (tokens.length > 3) {
                tokens[3].type = isNumber(tokens[3].text) && +tokens[3].text >= 0 ? "number" : "invalid";
            }
        }, numKPoints);
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

export function parseKpoints(document: vscode.TextDocument): TokenizedLine[] {
    const kpointsLines: TokenizedLine[] = [];
    const tokenizer = new Tokenizer(document);

    // Parse first three lines. This is the same in every file
    // Together, line 2 and 3 dictate the format of the rest of the file
    if (
        // line 1 - comment
        processLine(tokens => tokens.forEach(t => t.type = "comment")) &&
        // line 2 - number of k-points (0 for automatic generation)
        processLine(tokens => tokens.forEach((t, tIdx) => {
            if (tIdx === 0) {
                t.type = isInteger(t.text) ? "number" : "invalid";
            } else {
                t.type = "comment";
            }
        })) &&
        // line 3 - mode or coordinates
        processLine(setConstLineTokens)
    ) {
        const numKPoints = +kpointsLines[1]?.tokens[0]?.text;
        const modeWord = kpointsLines[2]?.tokens[0]?.text;
        if (Number.isFinite(numKPoints) && modeWord) {
            const mode = getKpointsMode(numKPoints, modeWord);
            if (mode) {
                modeProcessors[mode](processLine, numKPoints);
            }
        }
    }

    return kpointsLines;

    function processLine(tokenSetter: TokensTyper, repeat?: number): boolean {
        const myRepeat = repeat ? repeat : 1;
        for (let iter = 0; iter < myRepeat; ++iter) {
            const tokenizedLine = tokenizer.tokenizeNextLine(tokenSetter);
            if (!tokenizedLine) {
                return false;
            } else if (tokenizedLine.tokens.length > 0) {
                kpointsLines.push(tokenizedLine);
            }
        }
        return true;
    }
};

function getKpointsMode(numKPoints: number, modeWord: string): KpointsMode | null {
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