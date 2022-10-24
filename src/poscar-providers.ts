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
    positions: "Atom positions"
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
    
            const config = vscode.workspace.getConfiguration("vasp-support");
            if (!config.get("poscar.codeLenses.enabled")) {
                return [];
            }
    
            const poscarLines = parsePoscar(document);
            if (poscarLines.length === 0) {
                return [];
            }
            
            let curType = poscarLines[0].type;
            codeLenses.push(new vscode.CodeLens(
                document.lineAt(0).range,
                {
                    title: poscarBlockTitles[curType],
                    command: ""
                }
            ));
    
            poscarLines.forEach((line, lineNumber) => {
                if (curType !== line.type) {
                    curType = line.type;
                    codeLenses.push(new vscode.CodeLens(
                        document.lineAt(lineNumber).range,
                        {
                            title: poscarBlockTitles[curType],
                            command: ""
                        }
                    ));
                }
            });
    
            return codeLenses;
        }
    });
}
