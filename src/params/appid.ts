import type { ParamMatcher } from "@sveltejs/kit";

// Match the Steam app ID format (0-9999999999)

export const match: ParamMatcher = (param) => {
    return /^[0-9]{1,10}$/.test(param);
};
