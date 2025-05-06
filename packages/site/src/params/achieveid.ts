import type { ParamMatcher } from "@sveltejs/kit";

// Match the Steam achievement ID format (TF_SCOUT_ACHIEVE_PROGRESS1)

export const match: ParamMatcher = (param) => {
    return /^[a-zA-Z0-9_\s]+$/.test(param);
};
