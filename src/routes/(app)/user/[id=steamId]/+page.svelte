<script lang="ts">
    import UserCard from "./UserCard.svelte";

    let { data } = $props();
</script>

<UserCard user={data.user} />

{#each data.joined ?? [] as achievement}
    <div class="mb-4 flex gap-4">
        <img
            src={achievement.icon}
            alt={achievement.name}
            height="64"
            width="64"
        />
        <div>
            <h2>{achievement.name}</h2>
            <p>{achievement.percent}%</p>
        </div>
    </div>
{/each}
