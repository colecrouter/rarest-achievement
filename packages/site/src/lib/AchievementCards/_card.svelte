<script lang="ts">
    import type {
        SteamAppAchievement,
        SteamUserAchievement,
    } from "@project/lib/models";
    import Primary from "./_primary.svelte";
    import Secondary from "./_secondary.svelte";

    interface Props {
        achievement: SteamUserAchievement | SteamAppAchievement;
        secondary?: boolean;
    }

    let { achievement, secondary }: Props = $props();
</script>

{#if secondary}
    <Secondary {achievement} />
{:else}
    <Primary {achievement} />
{/if}
