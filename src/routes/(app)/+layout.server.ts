import { randomMessage } from "$lib/loading/messages.js";

export const load = ({ locals, url }) => {
    // Dep chain URL, so that randomMessage is re-generated on every navigation
    let _ = url;

    return {
        user: locals.steamUser,
        message: randomMessage(),
    };
};
