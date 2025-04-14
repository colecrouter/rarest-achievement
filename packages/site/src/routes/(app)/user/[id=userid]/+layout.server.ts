import type { Breadcrumb } from "$lib/breadcrumbs.js";
import { error } from "@sveltejs/kit";
import { EnhancedSteamRepository } from "lib";

export const load = async ({ params, locals }) => {
    const { id } = params;

    const repo = new EnhancedSteamRepository(locals);

    const { data } = await repo.getUsers([id]);
    const user = data.get(id);
    if (!user) {
        error(404, "User not found");
    }

    const breadcrumbs = [
        {
            label: user.displayName,
            href: `/user/${user.id}`,
        },
    ] satisfies Breadcrumb[];

    return {
        user,
        breadcrumbs,
    };
};
