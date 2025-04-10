// Dumb VPN at work is blocking steamcdn.net, so we need to use a local proxy

const urlWhitelist = [
    "https://shared.akamai.steamstatic.com/",
    "https://store.akamai.steamstatic.com/",
    "https://steamcdn-a.akamaihd.net/",
    "https://cdn.cloudflare.steamstatic.com/",
    "https://avatars.steamstatic.com/",
];

export const replaceCdnUrl = (url: string) => {
    if (!urlWhitelist.some((whitelist) => url.startsWith(whitelist))) {
        return url;
    }

    const newUrl = new URL("http://localhost:5173/image");
    newUrl.searchParams.set("url", url);
    return newUrl.toString();
};
