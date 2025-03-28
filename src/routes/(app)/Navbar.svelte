<script lang="ts">
    import { Trophy, User } from "lucide-svelte";
</script>

<header class="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
    <div
        class="container mx-auto flex items-center justify-between gap-4 px-4 py-4"
    >
        <a href="/" class="flex items-center gap-2">
            <Trophy class="h-6 w-6 text-amber-500" />
            <h1 class="text-xl font-bold">Achievement Vault</h1>
        </a>
        <form class="flex-grow" action="/?/search" method="post">
            <input class="input" type="text" name="q" placeholder="Search" />
        </form>
        <div class="flex items-center gap-4">
            <button class="btn btn-sm text-gray-400 hover:text-gray-100">
                <User class="mr-2 h-5 w-5" />
                <span>SteamUser123</span>
            </button>
        </div>
    </div>
</header>
