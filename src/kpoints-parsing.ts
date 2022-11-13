//  row     explicit    regular     generalized     bandstruct  automatic
//  1       comment     -           -               -           -
//  2       n           0           0               n           0
//  3       coord       mode        coord           line        auto
//  4       k-point     subdiv      lattice         coord       length
//  5       ...         opt shift   ...             k-point
//  6       ...                     ...             ...
//  7       ...                     shift           ...

import * as vscode from "vscode";
import { DocumentParser, ParsedLine, setConstLineTokens, TokenTypeSetter } from "./parsing-base";
import { isInteger } from "./util";

export function parseKpoints(document: vscode.TextDocument) {
    const parsedLines: ParsedLine[] = [];
    const parser = new DocumentParser(document);

    function processLine(tokenSetter: TokenTypeSetter, repeat?: number): boolean {
        const myRepeat = repeat ? repeat : 1;
        let isOk = true;
        for (let iter = 0; iter < myRepeat; ++iter) {
            const parsedLine = parser.parseNextLine(tokenSetter);
            if (parsedLine && parsedLine.tokens.length > 0) {
                parsedLines.push(parsedLine);
            } else {
                isOk = false;
            }
        }
        return isOk;
    }

    // Parse first three lines. This is the same in every file
    // Together, line 2 and 3 dictate the format of the rest of the file

    // line 1 - comment
    processLine(tokens => tokens.forEach(t => t.type = "comment"));
    // line 2 - number of k-points (0 for automatic generation)
    processLine(tokens => {
        if (tokens.length > 0) {
            const isOk = isInteger(tokens[0].text) && +tokens[0].text >= 0;
            tokens[0].type = isOk ? "number" : "invalid";
        }
        tokens.slice(1).forEach(t => t.type = "comment");
    });
    // line 3 - mode or coordinates
    processLine(setConstLineTokens);
}