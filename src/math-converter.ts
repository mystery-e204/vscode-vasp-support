import { mathjax } from "mathjax-full/js/mathjax";
import { TeX } from "mathjax-full/js/input/tex";
import { SVG } from "mathjax-full/js/output/svg";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages";

export class MathConverter {
	private document: any;
	private adaptor: any;

	constructor() {
		this.adaptor = liteAdaptor();
		RegisterHTMLHandler(this.adaptor);
	
		const tex = new TeX({packages: AllPackages});
		const svg = new SVG({fontCache: "local"});
		this.document = mathjax.document('', {InputJax: tex, OutputJax: svg});
	}

	convert(tex: string): string {
		const node = this.document.convert(tex, {display: false});
		return this.adaptor.innerHTML(node);
	}
}