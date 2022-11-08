import * as vscode from "vscode";
import { PoscarBlockType, tokenTypes, parsePoscar } from "./poscar-parsing";

const tokensLegend = new vscode.SemanticTokensLegend(tokenTypes.slice());

const poscarBlockTitles: Readonly<Record<PoscarBlockType, string>> = {
    comment: "Comment",
    scaling: "Scaling factors",
    lattice: "Lattice",
    speciesNames: "Species names",
    numAtoms: "Atoms per species",
    selDynamics: "Selective dynamics",
    positionMode: "Position mode",
    positions: "Atom positions",
    positionsSelDyn: "Atom positions + selective-dynamic flags",
    lattVelocitiesStart: "Start of lattice velocities",
    lattVelocitiesState: "Initialization state",
    lattVelocitiesVels: "Lattice velocities",
    lattVelocitiesLatt: "Lattice",
    velocityMode: "Velocity mode",
    velocities: "Atom velocities"
};

export function registerPoscarSemanticTokensProvider(selector: vscode.DocumentSelector): vscode.Disposable {
    return vscode.languages.registerDocumentSemanticTokensProvider(selector, {
		provideDocumentSemanticTokens(document, cancel) {
			const builder = new vscode.SemanticTokensBuilder(tokensLegend);
			const poscarLines = parsePoscar(document);
			poscarLines.forEach(poscarLine => {
				poscarLine.tokens.forEach(token => {
					if (token.type) {
						builder.push(token.range, token.type);
					}
				});
			});
			return builder.build();
		}
	}, tokensLegend);
}

export function registerPoscarCodeLensProvider(selector: vscode.DocumentSelector): vscode.Disposable {
    return vscode.languages.registerCodeLensProvider("poscar", {
        provideCodeLenses(document, cancel): vscode.CodeLens[] {
            const codeLenses: vscode.CodeLens[] = [];
            function addCodeLense(type: PoscarBlockType, line: number) {
                codeLenses.push(new vscode.CodeLens(
                    document.lineAt(line).range,
                    {
                        title: poscarBlockTitles[type],
                        command: ""
                    }
                ));
            }
    
            const config = vscode.workspace.getConfiguration("vasp-support");
            if (!config.get("poscar.codeLenses.enabled")) {
                return [];
            }
    
            const poscarLines = parsePoscar(document);
            if (poscarLines.length === 0) {
                return [];
            }
            
            let prevType = poscarLines[0].type;
            addCodeLense(prevType, 0);

            for (let lineIdx = 1; lineIdx < poscarLines.length; ++lineIdx) {
                const line = poscarLines[lineIdx];
                if (prevType !== line.type) {
                    addCodeLense(line.type, lineIdx);
                    if (line.tokens.length === 0) {
                        switch (prevType) {
                            case "lattice":
                                addCodeLense("speciesNames", lineIdx);
                                break;
                            case "numAtoms":
                                addCodeLense("selDynamics", lineIdx);
                                break;
                            default:
                                break;
                        }
                    }
                    prevType = line.type;
                }
            }
    
            return codeLenses;
        }
    });
}
