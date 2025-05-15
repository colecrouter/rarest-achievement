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
                class="bg-surface-600 aspect-square h-12 w-12 animate-pulse rounded-full"
            ></div>
            <div class="flex-1 space-y-2">
                <div class="bg-surface-600 h-4 animate-pulse rounded"></div>
                <div
                    class="bg-surface-600 h-4 w-3/4 animate-pulse rounded"
                ></div>
            </div>
        </div>
    {:else}
        <div class="animate-pulse space-y-4">
            <div class="bg-surface-600 h-12 rounded"></div>
            <div class="bg-surface-600 h-4 w-5/6 rounded"></div>
            <div class="bg-surface-600 h-4 w-3/4 rounded"></div>
        </div>
    {/if}
</div>
