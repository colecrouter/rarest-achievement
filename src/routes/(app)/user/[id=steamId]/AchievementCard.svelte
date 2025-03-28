<script lang="ts">
    interface Props {
        icon: string;
        name: string;
        game: string;
        description: string;
        unlocked: Date;
        rarity: number;
    }

    let { icon, name, game, description, unlocked, rarity }: Props = $props();
</script>

<div class="card overflow-hidden border-[1px] border-gray-700 bg-gray-800">
    <article class="flex h-full flex-col justify-between p-0">
        <div class="flex items-start gap-3 p-4">
            <div class="relative flex-shrink-0">
                <img
                    src={icon || "/placeholder.svg"}
                    alt={name}
                    width="48"
                    height="48"
                    class="rounded-md border border-gray-700 bg-gray-900"
                />
                <div
                    class="absolute -right-2 -bottom-2 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-gray-900"
                >
                    {rarity}%
                </div>
            </div>
            <div>
                <h3 class="text-sm font-bold">
                    {name}
                </h3>
                <p class="mb-1 text-xs text-gray-400">
                    {game}
                </p>
                <p class="line-clamp-2 text-xs text-gray-300">
                    {description}
                </p>
            </div>
        </div>
        <div
            class="flex items-center justify-between bg-gray-900 px-4 py-2 text-xs text-gray-400"
        >
            <span>Unlocked: {new Date(unlocked).toLocaleDateString()}</span>
            <a href="#" class="text-amber-500 hover:text-amber-400">Details</a>
        </div>
    </article>
</div>
