export type Rarity = "common" | "uncommon" | "rare" | "ultra-rare" | "locked";

/**
 * Rarity function to determine the rarity of an item based on its percentage.
 * @param {number | null} percent - The percentage value of the item.
 * @returns {string} The rarity classification of the item.
 * @example
 * rarity(45); // returns "uncommon"
 */
export const getRarity = (percent: number | null): Rarity => {
    if (percent === null) return "locked";
    if (percent < 5) return "ultra-rare";
    if (percent < 10) return "rare";
    if (percent < 50) return "uncommon";
    if (percent < 100) return "common";

    throw new Error("Invalid percentage value");
};
