import * as vscode from "vscode";
import { parsePoscar, PoscarBlockType, PoscarLine, isNumber, isInteger, isLetters } from "./poscar-parsing";

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
	disposables.push(vscode.workspace.onDidChangeConfiguration(event => {
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
		collection.set(document.uri, poscarLines.flatMap(l => poscarBlockLinters[l.type](l)));
	}
}

type Linter = (poscarLine: PoscarLine) => vscode.Diagnostic[];

const poscarBlockLinters: Readonly<Record<PoscarBlockType, Linter>> = {
    comment: () => [],
    scaling: poscarLine => {
        const diagnostics: vscode.Diagnostic[] = [];
        const tokens = poscarLine.tokens;
        tokens.slice(0, 3).forEach(t => {
            if (!isNumber(t.text)) {
                diagnostics.push(createDiagnostic(
                    "Scaling factor must be a number.",
                    t.range,
                    vscode.DiagnosticSeverity.Error
                ));
            }
        });
        if (tokens.length === 0) {
            diagnostics.push(createEmptyLineError(poscarLine.line));
        } else if (tokens.length === 2) {
            diagnostics.push(createDiagnostic(
                "The number of scaling factors must be either 1 or 3.",
                tokens[0].range.union(tokens[1].range),
                vscode.DiagnosticSeverity.Error
            ));
        } else if (tokens.length > 3) {
            diagnostics.push(createRemainderWarning(poscarLine.line, tokens[3].range.start));
        } else if (tokens.length === 3) {
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
        if (poscarLine.tokens.length === 0) {
            diagnostics.push(createEmptyLineError(poscarLine.line));
        }
        return diagnostics;
    },
    numAtoms: poscarLine => {
        const diagnostics = poscarLine.tokens
        .filter(t => !isInteger(t.text) || +t.text <= 0)
        .map(t => createDiagnostic(
            "Number of atoms needs to be a positive integer.",
            t.range,
            vscode.DiagnosticSeverity.Error
        ));
        if (poscarLine.tokens.length === 0) {
            diagnostics.push(createEmptyLineError(poscarLine.line));
        }
        return diagnostics;
    },
    selDynamics: poscarLine => lintConstLine(poscarLine, "selective dynamics"),
    positionMode: poscarLine => lintMode(poscarLine, "direct"),
    positions: poscarLine => {
        const tokens = poscarLine.tokens;

        const diagnostics = tokens.slice(0, 3)
        .filter(t => !isNumber(t.text))
        .map(t => createDiagnostic(
            "Component of position vector must be a number.",
            t.range,
            vscode.DiagnosticSeverity.Error
        ));

        diagnostics.push(...tokens.slice(3, 6)
            .filter(t => t.text !== "T" && t.text !== "F")
            .map(t => createDiagnostic(
                "Selective dynamics flag must be either 'T' or 'F'.",
                t.range,
                vscode.DiagnosticSeverity.Error
            ))
        );

        if (tokens.length === 0) {
            diagnostics.push(createEmptyLineError(poscarLine.line));
        } else if (tokens.length < 3) {
            diagnostics.push(createDiagnostic(
                "Each position vector must consist of 3 numbers. Too few given.",
                tokens[0].range.union(tokens[tokens.length - 1].range),
                vscode.DiagnosticSeverity.Error
            ));
        } else if (tokens.length > 6) {
            diagnostics.push(createRemainderWarning(poscarLine.line, tokens[6].range.start));
        }
        return diagnostics;
    },
    lattVelocitiesStart: poscarLine => lintConstLine(poscarLine, "Lattice velocities and vectors"),
    lattVelocitiecState: poscarLine => {
        const tokens = poscarLine.tokens;
        const diagnostics: vscode.Diagnostic[] = [];
        if (tokens.length === 0) {
            diagnostics.push(createEmptyLineError(poscarLine.line));
        } else if (!isInteger(tokens[0].text)) {
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

function createEmptyLineError(line: vscode.TextLine): vscode.Diagnostic {
    return createDiagnostic("Line must not be empty.", line.rangeIncludingLineBreak, vscode.DiagnosticSeverity.Error);
}

function createRemainderWarning(line: vscode.TextLine, start: vscode.Position) {
    return createDiagnostic(
        "The remainder of this line is ignored by VASP. Consider removing it.",
        line.range.with(start),
        vscode.DiagnosticSeverity.Warning
    );
}

function lintVector(poscarLine: PoscarLine): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const tokens = poscarLine.tokens;
    tokens.slice(0, 3).forEach(t => {
        if (!isNumber(t.text)) {
            diagnostics.push(createDiagnostic(
                "Vector component must be a number.",
                t.range,
                vscode.DiagnosticSeverity.Error
            ));
        }
    });
    if (tokens.length === 0) {
        diagnostics.push(createEmptyLineError(poscarLine.line));
    } else if (tokens.length < 3) {
        diagnostics.push(createDiagnostic(
            "Vector must consist of 3 numbers. Too few given.",
            tokens[0].range.union(tokens[tokens.length - 1].range),
            vscode.DiagnosticSeverity.Error
        ));
    } else if (tokens.length > 3) {
        diagnostics.push(createRemainderWarning(poscarLine.line, tokens[3].range.start));
    }
    return diagnostics;
}

function lintConstLine(poscarLine: PoscarLine, content: string): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    if (poscarLine.tokens.length === 0) {
        diagnostics.push(createEmptyLineError(poscarLine.line));
    } else {
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
