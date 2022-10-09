import { mathjax } from "mathjax-full/js/mathjax";
import { TeX } from "mathjax-full/js/input/tex";
import { SVG } from "mathjax-full/js/output/svg";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages";

export class MathConverter {
	private document: any;
	private adaptor: any;

	private constructor(adaptor: any, document: any) {
		this.adaptor = adaptor;
		this.document = document;
	}

	static create(): MathConverter {
		const adaptor = liteAdaptor();
		RegisterHTMLHandler(adaptor);
	
		const tex = new TeX({packages: AllPackages});
		const svg = new SVG({fontCache: "local"});
		const document = mathjax.document('', {InputJax: tex, OutputJax: svg});

		return new MathConverter(adaptor, document);
	}

	convert(tex: string): string {
		const node = this.document.convert(tex, {display: false});
		return this.adaptor.innerHTML(node);
	}
}