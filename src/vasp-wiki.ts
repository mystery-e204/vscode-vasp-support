import { Mwn } from 'mwn';
import * as cheerio from 'cheerio';
import { MathConverter } from './math-converter';
import { HtmlToMarkdownConverter } from './html-to-markdown';
import { IncarTag } from './incar-tag';

interface WikiPage {
	title: string,
	body: string
}

async function fetchIncarTagPageIDs(bot: Mwn): Promise<number[]> {
    const pageIds: number[] = [];

    for await (let response of bot.continuedQueryGen({
        format: "json",
        action: "query",
        list: "categorymembers",
        cmtitle: "Category:INCAR_tag",
        cmprop: "title|ids",
        cmlimit: "max"
    })) {
        if (response.query) {
            pageIds.push(...
                response.query.categorymembers.filter((member: any) => {
                    const title: string = member.title;
                    return !title.startsWith("Construction:");
                }).map((member: any) => member.pageid)
            );
        }
    }

    return pageIds;
}

async function fetchIncarTagWikiPages(bot: Mwn, pageIds: number[]): Promise<WikiPage[]> {
    const wikiPages: WikiPage[] = [];

    for await (let response of bot.massQueryGen({
        format: "json",
        action: "query",
        pageids: pageIds,
        export: true
    }, "pageids")) {
        const $ = cheerio.load(response.query?.export, {
            xmlMode: true
        });
        for (let page of $("page")) {
            const title = $(page).find("title").first().text().replace(/ /g, "_");
            let body = $(page).find("text").first().text();

            let maxEnd = body.lastIndexOf("\n");
            maxEnd = maxEnd >= 0 ? maxEnd : body.length;
            let end = maxEnd;
            const newEnd = body.search(/(:?\s*\n----\s*\n|\s*\n\s*<hr \/>|\s*\n\s*== )/);
            end = newEnd >= 0 ? Math.min(end, newEnd) : end;

            wikiPages.push({
                title: title,
                body: body.slice(0, end)
            });
        }
    }

    return wikiPages;
}

async function parseIncarTags(bot: Mwn, wikiPages: WikiPage[]): Promise<Map<string, string>> {
    const combinedText = wikiPages.map(info => `<div class="incarTag" title="${info.title}">\n${info.body}\n</div>`).join("");
    const tmp = await bot.parseWikitext(combinedText);
    const $ = cheerio.load(tmp);
    
    const htmlMap = new Map<string, string>();
    $("div.incarTag").each((_, e) => {
        const title = e.attribs.title.toUpperCase();
        const html = $(e).html();
        if (title && html) {
            htmlMap.set(title, html);
        }
    });

    return htmlMap;
}

export async function fetchIncarTags(baseUrl: string): Promise<IncarTag[]> {
    const bot = new Mwn({ apiUrl: `${baseUrl}/wiki/api.php` });
    const mathConverter = new MathConverter();
	const htmlToMarkdownConverter = new HtmlToMarkdownConverter(mathConverter);

    const pageIDs = await fetchIncarTagPageIDs(bot);
    const wikiPages = await fetchIncarTagWikiPages(bot, pageIDs);
    const htmlMap = await parseIncarTags(bot, wikiPages);

    const incarTags = new Array<IncarTag>();
	htmlMap.forEach((val, key) => {
		const markdownStr = htmlToMarkdownConverter.convert(val);
		incarTags.push(IncarTag.fromMarkdown(markdownStr, key));
	});

    return incarTags;
}
