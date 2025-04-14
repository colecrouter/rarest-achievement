import { error, redirect } from "@sveltejs/kit";

export const GET = async ({ url, cookies }) => {
    // Capture the query parameters that Steam sends back.
    const query = new URLSearchParams(url.search);

    // Prepare the parameters required for verification.
    const checkParams = new URLSearchParams(query);
    checkParams.set("openid.mode", "check_authentication");

    // Verify the authentication by making a POST request to Steam.
    // Steam will respond with a body that includes "is_valid:true" if successful.
    const response = await fetch("https://steamcommunity.com/openid/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: checkParams.toString(),
    });
    const text = await response.text();

    if (!text.includes("is_valid:true")) error(401, "Invalid authentication");

    // Extract the Steam ID from openid.claimed_id.
    // The claimed_id is in the format:
    //   https://steamcommunity.com/openid/id/<steamId>
    const claimed_id = query.get("openid.claimed_id");
    if (!claimed_id) error(400, "Missing claimed_id");

    const match = claimed_id.match(/\/id\/(\d+)$/);
    if (!match) error(400, "Invalid Steam ID format");
    const steamId = match[1];
    if (!steamId) error(400, "Invalid Steam ID");

    // Set a cookie or create a session with the Steam ID.
    // Here we just set a simple cookie named 'steamid'.
    cookies.set("steamid", steamId, {
        path: "/",
        // Add additional cookie configurations (e.g., secure, httpOnly) as needed.
    });

    redirect(302, `/user/${steamId}`); // Redirect to the user page with the Steam ID.
};
