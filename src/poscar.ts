import { Diagnostic, DiagnosticSeverity, Range, SemanticTokensLegend, TextDocument, TextLine } from "vscode";

const tokenTypes = [
    "comment",
    "string",
    "number",
    "keyword",
    "invalid"
] as const;

export const legend = new SemanticTokensLegend(tokenTypes.slice());

type TokenType = (typeof tokenTypes)[number];

type PoscarBlockType = 
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
    tokenize: (line: TextLine) => Token[];
    validate: (poscarLine: PoscarLine) => Diagnostic[];
}

interface PoscarLine {
    type: PoscarBlockType;
    tokens: Token[];
    line: TextLine;
}

interface Token {
    type?: TokenType;
    range: Range;
    text: string;
}

export const poscarBlockInfo: Record<PoscarBlockType, PoscarBlock> = {
    comment: {
        description: "Comment",
        tokenize: line => {
            const token = getLineAsToken(line);
            if (token) {
                token.type = "comment";
            }
            return token ? [token] : [];
        },
        validate: () => []
    },
    scaling: {
        description: "Scaling factors",
        tokenize: line => {
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
        validate: poscarLine => {
            const diagnostics: Diagnostic[] = [];
            const tokens = poscarLine.tokens;
            tokens.slice(0, 3).forEach(t => {
                if (!isNumber(t.text)) {
                    diagnostics.push(createDiagnostic(
                        "Scaling factor must be a number.",
                        t.range,
                        DiagnosticSeverity.Error
                    ));
                }
            });
            if (tokens.length === 0) {
                diagnostics.push(createEmptyLineError(poscarLine.line));
            } else if (tokens.length === 2) {
                diagnostics.push(createDiagnostic(
                    "The number of scaling factors must be either 1 or 3.",
                    tokens[0].range.union(tokens[1].range),
                    DiagnosticSeverity.Error
                ));
            } else if (tokens.length > 3) {
                diagnostics.push(createDiagnostic(
                    "The remainder of this line is superfluous and is treated as a comment.",
                    tokens[3].range.union(tokens[tokens.length - 1].range),
                    DiagnosticSeverity.Warning
                ));
            } else if (tokens.length === 3) {
                tokens.forEach(t => {
                    if (+t.text < 0) {
                        diagnostics.push(createDiagnostic(
                            "Individual scaling factors must be positive.",
                            t.range,
                            DiagnosticSeverity.Error
                        ));
                    }
                });
            }
            return diagnostics;
        }
    },
    lattice: {
        description: "Lattice",
        tokenize: line => {
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
        validate: poscarLine => {
            const diagnostics: Diagnostic[] = [];
            const tokens = poscarLine.tokens;
            tokens.slice(0, 3).forEach(t => {
                if (!isNumber(t.text)) {
                    diagnostics.push(createDiagnostic(
                        "Component of lattice vector must be a number.",
                        t.range,
                        DiagnosticSeverity.Error
                    ));
                }
            });
            if (tokens.length === 0) {
                diagnostics.push(createEmptyLineError(poscarLine.line));
            } else if (tokens.length < 3) {
                diagnostics.push(createDiagnostic(
                    "Each lattice vector must consist of 3 numbers. Too few given.",
                    tokens[0].range.union(tokens[tokens.length - 1].range),
                    DiagnosticSeverity.Error
                ));
            } else if (tokens.length > 3) {
                diagnostics.push(createDiagnostic(
                    "The remainder of this line is superfluous and is treated as a comment.",
                    tokens[3].range.union(tokens[tokens.length - 1].range),
                    DiagnosticSeverity.Warning
                ));
            }
            return diagnostics;
        }
    },
    speciesNames: {
        description: "Species names",
        tokenize: line => {
            return splitLineToTokens(line).map(t => {
                t.type = isLetters(t.text) ? "string" : "invalid";
                return t;
            });
        },
        validate: poscarLine => {
            const diagnostics = poscarLine.tokens
            .filter(t => !isLetters(t.text))
            .map(t => createDiagnostic(
                `Species name '${t.text}' is invalid`,
                t.range,
                DiagnosticSeverity.Error
            ));
            if (poscarLine.tokens.length === 0) {
                diagnostics.push(createEmptyLineError(poscarLine.line));
            }
            return diagnostics;
        }
    },
    numAtoms: {
        description: "Atoms per species",
        tokenize: line => {
            return splitLineToTokens(line).map(t => {
                t.type = isInteger(t.text) ? "number" : "invalid";
                return t;
            });
        },
        validate: poscarLine => {
            const diagnostics = poscarLine.tokens
            .filter(t => !isInteger(t.text) || +t.text <= 0)
            .map(t => createDiagnostic(
                "Number of atoms needs to be a positive integer.",
                t.range,
                DiagnosticSeverity.Error
            ));
            if (poscarLine.tokens.length === 0) {
                diagnostics.push(createEmptyLineError(poscarLine.line));
            }
            return diagnostics;
        }
    },
    selDynamics: {
        description: "Selective dynamics",
        tokenize: line => {
            const token = getLineAsToken(line);
            if (token) {
                token.type = /^[sS]/.test(token.text) ? "keyword" : "invalid";
                return [token];
            }
            return [];
        },
        validate: poscarLine => {
            const diagnostics: Diagnostic[] = [];
            if (poscarLine.tokens.length === 0) {
                diagnostics.push(createEmptyLineError(poscarLine.line));
            } else {
                const token = poscarLine.tokens[0];
                if (/^[^sS]/.test(token.text)) {
                    diagnostics.push(createDiagnostic(
                        "First letter on line must be 's' or 'S' in order to activate selective dynamics.",
                        token.range,
                        DiagnosticSeverity.Error
                    ));
                } else if (!"selective dynamics".startsWith(token.text.toLowerCase())) {
                    diagnostics.push(createDiagnostic(
                        "Consider specifying 'selective dynamics' to avoid potential mistakes.",
                        token.range,
                        DiagnosticSeverity.Hint
                    ));
                }
            }
            return diagnostics;
        }
    },
    positionMode: {
        description: "Position mode",
        tokenize: line => {
            const token = getLineAsToken(line);
            if (token) {
                token.type = "keyword";
                return [token];
            }
            return [];
        },
        validate: poscarLine => {
            const diagnostics: Diagnostic[] = [];
            if (poscarLine.tokens.length === 0) {
                diagnostics.push(createDiagnostic(
                    "Consider specifying 'direct' instead of having an empty line to avoid potential mistakes.",
                    poscarLine.line.rangeIncludingLineBreak,
                    DiagnosticSeverity.Hint
                ));
            } else {
                const token = poscarLine.tokens[0];
                const firstLetter = token.text ? token.text[0].toLowerCase() : "";
                if (firstLetter === "c" || firstLetter === "k") {
                    if (!"artesian".startsWith(token.text.slice(1).toLowerCase())) {
                        diagnostics.push(createDiagnostic(
                            "Consider specifying 'cartesian' to avoid potential mistakes.",
                            token.range,
                            DiagnosticSeverity.Hint
                        ));
                    }
                } else {
                    if (!"direct".startsWith(token.text.toLowerCase())) {
                        diagnostics.push(createDiagnostic(
                            "Consider specifying 'direct' to avoid potential mistakes.",
                            token.range,
                            DiagnosticSeverity.Hint
                        ));
                    }
                }
            }
            return diagnostics;
        }
    },
    positions: {
        description: "Atom positions",
        tokenize: line => {
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
        },
        validate: poscarLine => {
            const tokens = poscarLine.tokens;

            const diagnostics = tokens.slice(0, 3)
            .filter(t => !isNumber(t.text))
            .map(t => createDiagnostic(
                "Component of position vector must be a number.",
                t.range,
                DiagnosticSeverity.Error
            ));

            diagnostics.push(...tokens.slice(3, 6)
                .filter(t => t.text !== "T" && t.text !== "F")
                .map(t => createDiagnostic(
                    "Selective dynamics flag must be either 'T' or 'F'.",
                    t.range,
                    DiagnosticSeverity.Error
                ))
            );

            if (tokens.length === 0) {
                diagnostics.push(createEmptyLineError(poscarLine.line));
            } else if (tokens.length < 3) {
                diagnostics.push(createDiagnostic(
                    "Each position vector must consist of 3 numbers. Too few given.",
                    tokens[0].range.union(tokens[tokens.length - 1].range),
                    DiagnosticSeverity.Error
                ));
            } else if (tokens.length > 6) {
                diagnostics.push(createDiagnostic(
                    "The remainder of this line is superfluous and is treated as a comment.",
                    tokens[6].range.union(tokens[tokens.length - 1].range),
                    DiagnosticSeverity.Warning
                ));
            }
            return diagnostics;
        }
    },
    // lattVelocities: {
    //     description: "Lattice velocities",
    // },
    // atomVelocities: {
    //     description: "Atom velocities",
    // },
    // mdExtra: {
    //     description: "MD extra",
    // },
};

function createDiagnostic(message: string, range: Range, severity: DiagnosticSeverity): Diagnostic {
    return {
        message: message,
        range: range,
        severity: severity,
        source: "VASP support"
    };
}

function createEmptyLineError(line: TextLine): Diagnostic {
    return createDiagnostic("Line must not be empty.", line.range, DiagnosticSeverity.Error);
}

function isNumber(str: string): boolean {
    return !Number.isNaN(+str);
}

function isInteger(str: string): boolean {
    return isNumber(str) && Number.isSafeInteger(+str);
}

function isLetters(str: string): boolean {
    return /^[a-zA-Z]+$/.test(str);
}

function getLineAsToken(line: TextLine): Token | null {
    const token = tokenizeLine(line, /^(\s*)(\S.*?)(\s*)$/);
    if (token) {
        return token[0];
    } else {
        return null;
    }
}

function splitLineToTokens(line: TextLine): Token[] {
    return tokenizeLine(line, /^(\s*)(\S+)(.*)$/);
}

function tokenizeLine(line: TextLine, matcher: RegExp): Token[] {
    const tokens: Token[] = [];
    let offset = 0;
    let matches = line.text.match(matcher);

    while (matches) {
        tokens.push({
            range: new Range(
                line.lineNumber, offset += matches[1].length,
                line.lineNumber, offset += matches[2].length
            ),
            text: matches[2]
        });
        matches = matches[3].match(matcher);
    }

    return tokens;
}

export function parsePoscar(document: TextDocument): PoscarLine[] {
    const poscarLines: PoscarLine[] = [];
    let nextLineIdx = 0;

    function processLine(type: PoscarBlockType, optionalTest?: (tokens: Token[]) => boolean): boolean {
        if (document.lineCount > nextLineIdx) {
            const line = document.lineAt(nextLineIdx++);
            const tokens = poscarBlockInfo[type].tokenize(line);
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
    processLine("selDynamics", tokens => tokens.length > 0 && tokens[0].type === "keyword");
    processLine("positionMode");
    while(processLine("positions")) {};

    return poscarLines;
}
