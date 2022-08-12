const { mathjax } = require("mathjax-full/js/mathjax");
const { TeX } = require("mathjax-full/js/input/tex");
const { SVG } = require("mathjax-full/js/output/svg");
const { liteAdaptor } = require("mathjax-full/js/adaptors/liteAdaptor");
const { RegisterHTMLHandler } = require("mathjax-full/js/handlers/html");
const { AllPackages } = require("mathjax-full/js/input/tex/AllPackages");

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
		const node = this.document.convert(tex, {
			display: false,
			em: 16,
			ex: 8,
			containerWidth: 80 * 16
		});

		return this.adaptor.innerHTML(node);
	}
}