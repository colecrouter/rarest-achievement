export type LoadingMessage = {
    title: string;
    description: string;
    source?: {
        text: string;
        url: URL;
    };
};

const loadingMessages = [
    {
        title: "Switching to your pistol is faster than reloading!",
        description: /*html*/ `
            While developing <i>Call of Duty 4: Modern Warfare</i> (2007), Infinity Ward studied real special forces training manuals, focusing on radio chatter, movement tactics, and body language, to craft a cinematic yet tactically grounded experience.
        `,
        source: {
            text: "IGN",
            url: new URL("https://www.ign.com/articles/2007/07/23/call-of-duty-4-au-interview"),
        },
    },
    {
        title: "The Cake is a Lie!",
        description: /*html*/ `
            In <i>Portal</i> (2007), players are promised a literal cake, while being unknowingly lead to their demise. This tongue-in-cheek promise quickly evolved into an iconic reminder about empty incentives in game marketing.
        `,
    },
    {
        title: "I've Spent Hours of My Life, Stomping... Koopas!",
        description: /*html*/ `
            <i>Super Mario Bros.</i> (1985) included a unused red "Koopa Troopa" enemy that had 2 lives. Leaked code for <i>Super Mario All-Stars</i> (1993) hints that this was planned as the default behavior for all Koopa Troopas.
        `,
        source: {
            text: "The Cutting Room Floor",
            url: new URL("https://tcrf.net/Super_Mario_Bros.#Enemy_04"),
        },
    },
    {
        title: "The Name's Bond... James Bond",
        description: /*html*/ `
            Rare's <i>GoldenEye 007</i> (1997) was the first game to feature a fully licensed James Bond character. The game was a massive success, selling over 8 million copies and becoming one of the best-selling Nintendo 64 games of all time.
        `,
        source: {
            text: "Mental Floss",
            url: new URL(
                "https://www.mentalfloss.com/article/86590/10-game-changing-facts-about-nintendo-64#inline-text-29",
            ),
        },
    },
    {
        title: "It's Dangerous to Go Alone! Take This!",
        description: /*html*/ `
            The original <i>Legend of Zelda</i> (1986) was one of the first console games to introduce a battery-backed save system, allowing players to record their extensive progress in an expansive open world. This feature redefined how adventure games were designed.
        `,
    },
    {
        title: "Well, Excuuuuse Me, Princess!",
        description: /*html*/ `
            The name "Zelda" (from <i>The Legend of Zelda</i> franchise) was inspired by Zelda Fitzgerald—the wife of author F. Scott Fitzgerald—giving the series an exotic and memorable title.
        `,
        source: {
            text: "Amazon",
            url: new URL(
                "https://web.archive.org/web/20071220062126/http://www.amazon.com/gp/feature.html?docId=117177",
            ),
        },
    },
    {
        title: "Not-so-final Fantasy",
        description: /*html*/ `
            The original <i>Final Fantasy</i> (1987), was conceived as developer Square's (later Square Enix) last-ditch effort during a financial crisis. Ironically, its unexpected success not only saved the company but also laid the groundwork for one of the most iconic and enduring RPG franchises.
        `,
        source: {
            text: "develop-online.net",
            url: new URL(
                "https://web.archive.org/web/20130922005246/http://www.develop-online.net/news/28960/Sakaguchi-discusses-the-development-of-Final-Fantasy",
            ),
        },
    },
] satisfies LoadingMessage[];

export const randomMessage = () => {
    const randomIndex = Math.floor(Math.random() * loadingMessages.length);
    return loadingMessages[randomIndex] as LoadingMessage;
};
