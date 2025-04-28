/** Removes HTML entities from a string.
 * @example
 * unescapeHTML("&lt;div&gt;Hello &amp; World!&lt;/div&gt;");
 * // returns "<div>Hello & World!</div>"
 */
export const unescapeHTML = (html: string) =>
    html
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
