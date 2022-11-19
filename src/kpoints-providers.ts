import * as vscode from "vscode";
import { parseKpoints } from "./kpoints-parsing";
import { registerVaspSemanticTokensProvider } from "./tokens";

export function registerKpointsSemanticTokensProvider(): vscode.Disposable {
    return registerVaspSemanticTokensProvider("kpoints", parseKpoints);
}