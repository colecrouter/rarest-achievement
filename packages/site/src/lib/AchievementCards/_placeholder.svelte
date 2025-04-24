<script lang="ts">
    interface Props {
        secondary?: boolean;
    }
    let { secondary }: Props = $props();
</script>

<div class="card p-4">
    {#if secondary}
        <div class="flex items-center gap-3">
            <div
                class="aspect-square h-12 w-12 animate-pulse rounded-full bg-gray-600"
            ></div>
            <div class="flex-1 space-y-2">
                <div class="h-4 animate-pulse rounded bg-gray-600"></div>
                <div class="h-4 w-3/4 animate-pulse rounded bg-gray-600"></div>
            </div>
        </div>
    {:else}
        <div class="animate-pulse space-y-4">
            <div class="h-12 rounded bg-gray-600"></div>
            <div class="h-4 w-5/6 rounded bg-gray-600"></div>
            <div class="h-4 w-3/4 rounded bg-gray-600"></div>
        </div>
    {/if}
</div>
