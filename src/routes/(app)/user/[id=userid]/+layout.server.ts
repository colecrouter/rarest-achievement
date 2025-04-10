import type { Breadcrumb } from "$lib/breadcrumbs/breadcrumbs.js";
import { EnhancedSteamRepository } from "$lib/server/enhanced/repo";
import { error } from "@sveltejs/kit";

export const load = async ({ params }) => {
    const { id } = params;

    const repo = new EnhancedSteamRepository();

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
