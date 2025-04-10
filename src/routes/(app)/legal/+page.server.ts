import type { Breadcrumb } from "$lib/breadcrumbs/breadcrumbs";

export const load = async () => {
    const breadcrumbs = [
        {
            label: "Legal",
            href: "/legal",
        },
    ] satisfies Breadcrumb[];

    return {
        breadcrumbs,
    };
};
