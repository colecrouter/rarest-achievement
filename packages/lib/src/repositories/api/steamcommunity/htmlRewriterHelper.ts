export async function getHTMLRewriter() {
    return "HTMLRewriter" in globalThis
        ? (globalThis as unknown as typeof import("htmlrewriter")).HTMLRewriter
        : (await import("htmlrewriter")).HTMLRewriter;
}
