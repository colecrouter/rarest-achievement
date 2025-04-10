import { randomMessage } from "$lib/loading/messages";

export const load = ({ locals, url }) => {
    // Dep chain URL, so that randomMessage is re-generated on every navigation

    return {
        user: locals.steamUser,
        message: randomMessage(),
        paths: url.pathname.split("/").filter((x) => x),
    };
};
