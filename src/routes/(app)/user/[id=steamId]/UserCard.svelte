<script lang="ts">
    import type { GetPlayerSummariesResponse } from "$lib/steam/api/steampowered/auth/playerSummary";
    import { Avatar } from "@skeletonlabs/skeleton-svelte";

    interface Props {
        user: GetPlayerSummariesResponse["response"]["players"][number];
    }

    let { user }: Props = $props();
</script>

<div class="flex gap-4">
    <div class="flex-none">
        <Avatar
            src={user.avatarfull}
            size="w-[128px]"
            name={user.personaname}
        />
    </div>
    <div class="flex-auto">
        <h1 class="h1">{user.personaname}</h1>
        <p>{user.profileurl}</p>
        <p class="text-gray-400">
            Last online: {new Date(user.lastlogoff * 1000).toLocaleString()}
        </p>
    </div>
</div>
