import { m } from "$lib/paraglide/messages";

export type LoadingMessage = {
	title: string;
	description: string;
	source?: {
		text: string;
		url: URL;
	};
};

export const randomMessage = () => {
	const loadingMessages = [
		{
			title: m.loadingScreenTitle1(),
			description: m.loadingScreenDescription1(),
			source: {
				text: "IGN",
				url: new URL("https://www.ign.com/articles/2007/07/23/call-of-duty-4-au-interview"),
			},
		},
		{
			title: m.loadingScreenTitle2(),
			description: m.loadingScreenDescription2(),
		},
		{
			title: m.loadingScreenTitle3(),
			description: m.loadingScreenDescription3(),
			source: {
				text: "The Cutting Room Floor",
				url: new URL("https://tcrf.net/Super_Mario_Bros.#Enemy_04"),
			},
		},
		{
			title: m.loadingScreenTitle4(),
			description: m.loadingScreenDescription4(),
			source: {
				text: "Mental Floss",
				url: new URL(
					"https://www.mentalfloss.com/article/86590/10-game-changing-facts-about-nintendo-64#inline-text-29",
				),
			},
		},
		{
			title: m.loadingScreenTitle5(),
			description: m.loadingScreenDescription5(),
		},
		{
			title: m.loadingScreenTitle6(),
			description: m.loadingScreenDescription6(),
			source: {
				text: "Amazon",
				url: new URL(
					"https://web.archive.org/web/20071220062126/http://www.amazon.com/gp/feature.html?docId=117177",
				),
			},
		},
		{
			title: m.loadingScreenTitle7(),
			description: m.loadingScreenDescription7(),
			source: {
				text: "develop-online.net",
				url: new URL(
					"https://web.archive.org/web/20130922005246/http://www.develop-online.net/news/28960/Sakaguchi-discusses-the-development-of-Final-Fantasy",
				),
			},
		},
	] satisfies LoadingMessage[];

	const randomIndex = Math.floor(Math.random() * loadingMessages.length);
	return loadingMessages[randomIndex] as LoadingMessage;
};
