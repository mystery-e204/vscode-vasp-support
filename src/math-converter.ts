import { mathjax } from "mathjax-full/js/mathjax";
import { TeX } from "mathjax-full/js/input/tex";
import { SVG } from "mathjax-full/js/output/svg";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages";
import type { LiteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor";
import type { MathDocument } from "mathjax-full/js/core/MathDocument";

export class MathConverter {
	private document: MathDocument<unknown, unknown, unknown>;
	private adaptor: LiteAdaptor;

	constructor() {
		this.adaptor = liteAdaptor();
		RegisterHTMLHandler(this.adaptor);
	
		const tex = new TeX({packages: AllPackages});
		const svg = new SVG({fontCache: "local"});
		this.document = mathjax.document('', {InputJax: tex, OutputJax: svg});
	}

	convert(tex: string): string {
		const node = this.document.convert(tex, {display: false});
		return this.adaptor.innerHTML(node as Parameters<LiteAdaptor['innerHTML']>[0]);
	}
}