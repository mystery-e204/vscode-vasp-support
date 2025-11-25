import * as vscode from "vscode";
import { isNumber, isInteger, isLetters } from "./util";
import { parsePoscar, PoscarBlockType, PoscarLine } from "./poscar-parsing";
import { countUntil } from "./util";

export function registerPoscarLinter(languageId: string): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

	const collection = vscode.languages.createDiagnosticCollection(languageId);
	if (vscode.window.activeTextEditor) {
		updateDiagnostics(vscode.window.activeTextEditor.document, collection);
	}
	disposables.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			updateDiagnostics(editor.document, collection);
		}
	}));
	disposables.push(vscode.workspace.onDidChangeTextDocument(event => {
		if (event.document) {
			updateDiagnostics(event.document, collection);
		}
	}));
	disposables.push(vscode.workspace.onDidChangeConfiguration(() => {
		const config = vscode.workspace.getConfiguration("vasp-support");
		if (!config.get("poscar.linting.enabled")) {
			collection.clear();
		}
	}));
    return disposables;
}

function updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
	const config = vscode.workspace.getConfiguration("vasp-support");
	if (document.languageId === "poscar" && config.get("poscar.linting.enabled")) {
		const poscarLines = parsePoscar(document);
        const diagnostics = poscarLines.flatMap(l => poscarBlockLinters[l.type](l));

        const speciesNamesLine = poscarLines.find(l => l.type === "speciesNames");
        const numAtomsLine = poscarLines.find(l => l.type === "numAtoms");
        if (speciesNamesLine && numAtomsLine) {
            if (countUntilComment(speciesNamesLine) !== countUntilComment(numAtomsLine)) {
                diagnostics.push(createDiagnostic(
                    "Number of atoms must be specified for each atomic species.",
                    numAtomsLine.line.range,
                    vscode.DiagnosticSeverity.Error
                ));
            }
        }

        collection.set(document.uri, diagnostics);
	}
}

type Linter = (poscarLine: PoscarLine) => vscode.Diagnostic[];

const poscarBlockLinters: Readonly<Record<PoscarBlockType, Linter>> = {
    comment: () => [],
    scaling: poscarLine => {
        const diagnostics: vscode.Diagnostic[] = [];
        if (isEmptyLine(poscarLine, diagnostics)) {
            return diagnostics;
        }

        const tokens = poscarLine.tokens;
        const numVals = countUntilComment(poscarLine, diagnostics);

        if (numVals === 2 || numVals > 3) {
            diagnostics.push(createDiagnostic(
                "The number of scaling factors must be either 1 or 3.",
                tokens[0].range.union(tokens[numVals - 1].range),
                vscode.DiagnosticSeverity.Error
            ));
        } else if (numVals === 3) {
            tokens.forEach(t => {
                if (+t.text < 0) {
                    diagnostics.push(createDiagnostic(
                        "Individual scaling factors must be positive.",
                        t.range,
                        vscode.DiagnosticSeverity.Error
                    ));
                }
            });
        }
        return diagnostics;
    },
    lattice: lintVector,
    speciesNames: poscarLine => {
        const diagnostics = poscarLine.tokens
        .filter(t => !isLetters(t.text))
        .map(t => createDiagnostic(
            `Species name '${t.text}' is invalid.`,
            t.range,
            vscode.DiagnosticSeverity.Error
        ));
        isEmptyLine(poscarLine, diagnostics);
        return diagnostics;
    },
    numAtoms: poscarLine => {
        const diagnostics: vscode.Diagnostic[] = [];
        if (isEmptyLine(poscarLine, diagnostics)) {
            return diagnostics;
        }
        const numVals = countUntilComment(poscarLine, diagnostics);
        poscarLine.tokens.slice(0, numVals)
        .filter(t => !isInteger(t.text) || +t.text <= 0)
        .forEach(t => {
            diagnostics.push(createDiagnostic(
                "Number of atoms needs to be a positive integer.",
                t.range,
                vscode.DiagnosticSeverity.Error
            ));
        });
        return diagnostics;
    },
    selDynamics: poscarLine => lintConstLine(poscarLine, "selective dynamics"),
    positionMode: poscarLine => lintMode(poscarLine, "direct"),
    positions: lintVector,
    positionsSelDyn: poscarLine => {
        const diagnostics = lintVector(poscarLine);
        const tokens = poscarLine.tokens;
        tokens.slice(3, 6)
        .filter(t => t.text !== "T" && t.text !== "F")
        .forEach(t => {
            diagnostics.push(createDiagnostic(
                "Selective dynamics flag must be either 'T' or 'F'.",
                t.range,
                vscode.DiagnosticSeverity.Error
            ));
        });
        if (tokens.length <= 3) {
            diagnostics.push(createDiagnostic(
                "There must be 3 selective-dynamics flags. Too few given.",
                new vscode.Range(poscarLine.line.range.end, poscarLine.line.range.end),
                vscode.DiagnosticSeverity.Error
            ));
        } else if (tokens.length < 6) {
            diagnostics.push(createDiagnostic(
                "There must be 3 selective-dynamics flags. Too few given.",
                tokens[3].range.union(tokens[tokens.length - 1].range),
                vscode.DiagnosticSeverity.Error
            ));
        }
        return diagnostics;
    },
    lattVelocitiesStart: poscarLine => lintConstLine(poscarLine, "Lattice velocities and vectors"),
    lattVelocitiesState: poscarLine => {
        const tokens = poscarLine.tokens;
        const diagnostics: vscode.Diagnostic[] = [];
        if (!isEmptyLine(poscarLine, diagnostics) && !isInteger(tokens[0].text)) {
            diagnostics.push(createDiagnostic(
                "Initialization state needs to be an integer",
                tokens[0].range,
                vscode.DiagnosticSeverity.Error
            ));
        }
        return diagnostics;
    },
    lattVelocitiesVels: lintVector,
    lattVelocitiesLatt: lintVector,
    velocityMode: lintMode,
    velocities: lintVector
};

function createDiagnostic(message: string, range: vscode.Range, severity: vscode.DiagnosticSeverity): vscode.Diagnostic {
    return {
        message: message,
        range: range,
        severity: severity,
        source: "VASP support"
    };
}

function isEmptyLine(poscarLine: PoscarLine, diagnostics?: vscode.Diagnostic[]): boolean {
    if (poscarLine.tokens.length === 0) {
        diagnostics?.push(createDiagnostic(
            "Line must not be empty.",
            poscarLine.line.rangeIncludingLineBreak,
            vscode.DiagnosticSeverity.Error
        ));
        return true;
    }
    return false;
}

function countUntilComment(poscarLine: PoscarLine, diagnostics?: vscode.Diagnostic[]): number {
    const tokens = poscarLine.tokens;
    const numVals = countUntil(tokens, t => t.type === "comment");
    if (diagnostics && numVals < tokens.length && !/^[#!]/.test(tokens[numVals].text)) {
        diagnostics.push(createDiagnostic(
            "The remainder of this line is ignored by VASP. " +
            "Consider placing a '#' or '!' in front to make the intention clearer.",
            poscarLine.line.range.with(tokens[numVals].range.start),
            vscode.DiagnosticSeverity.Warning
        ));
    }
    return numVals;
}

function lintVector(poscarLine: PoscarLine): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    if (isEmptyLine(poscarLine, diagnostics)) {
        return diagnostics;
    }

    const tokens = poscarLine.tokens;
    countUntilComment(poscarLine, diagnostics);

    tokens.slice(0, 3).forEach(t => {
        if (!isNumber(t.text)) {
            diagnostics.push(createDiagnostic(
                "Vector component must be a number.",
                t.range,
                vscode.DiagnosticSeverity.Error
            ));
        }
    });
    if (tokens.length < 3) {
        diagnostics.push(createDiagnostic(
            "Vector must consist of 3 numbers. Too few given.",
            tokens[0].range.union(tokens[tokens.length - 1].range),
            vscode.DiagnosticSeverity.Error
        ));
    }
    return diagnostics;
}

function lintConstLine(poscarLine: PoscarLine, content: string): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    if (isEmptyLine(poscarLine, diagnostics)) {
        return diagnostics;
    }

    const token = poscarLine.tokens[0];
    const startLower = content[0].toLowerCase();
    const startUpper = startLower.toUpperCase();
    const regex = new RegExp(`^[${startLower}${startUpper}]`);
    if (!regex.test(token.text)) {
        diagnostics.push(createDiagnostic(
            `First non-space character on line must be '${startLower}' or '${startUpper}'.`,
            token.range,
            vscode.DiagnosticSeverity.Error
        ));
    } else if (!content.startsWith(token.text.toLowerCase())) {
        diagnostics.push(createDiagnostic(
            `Consider specifying '${content}' to avoid potential mistakes.`,
            token.range,
            vscode.DiagnosticSeverity.Warning
        ));
    }
    return diagnostics;
}

function lintMode(poscarLine: PoscarLine, emptyMode?: string) {
    const diagnostics: vscode.Diagnostic[] = [];
    if (poscarLine.tokens.length === 0) {
        if (emptyMode) {
            diagnostics.push(createDiagnostic(
                `Consider specifying '${emptyMode}' instead of an empty line to avoid potential mistakes.`,
                poscarLine.line.rangeIncludingLineBreak,
                vscode.DiagnosticSeverity.Warning
            ));
        }
    } else {
        const token = poscarLine.tokens[0];
        const firstLetter = token.text ? token.text[0].toLowerCase() : "";
        if (firstLetter === "c" || firstLetter === "k") {
            if (!"artesian".startsWith(token.text.slice(1).toLowerCase())) {
                diagnostics.push(createDiagnostic(
                    "Consider specifying 'cartesian' to avoid potential mistakes.",
                    token.range,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        } else {
            if (!"direct".startsWith(token.text.toLowerCase())) {
                diagnostics.push(createDiagnostic(
                    "Consider specifying 'direct' to avoid potential mistakes.",
                    token.range,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        }
    }
    return diagnostics;
}
