<script lang="ts">
    import Alert from "$lib/Alert.svelte";
    import GlobeLock from "@lucide/svelte/icons/globe-lock";
</script>

<article>
    <div class="space-y-12">
        <!-- Step 1 -->
        <section>
            <h2 class="text-2xl">Step 1: Go to Your Steam Profile</h2>
            <div class="p-6">
                <p class="mb-6">
                    Log into Steam and navigate to your profile page. You can do
                    this by clicking on your username in the top navigation bar.
                </p>

                <!-- Steam Profile UI Recreation -->
                <div class="text-surface-300 mb-6">
                    <div class="flex items-start p-4">
                        <div class="mr-4">
                            <div class="placeholder h-32 w-32"></div>
                        </div>

                        <div class="flex-1">
                            <div class="flex items-start justify-between">
                                <div>
                                    <h3 class="mb-2 text-2xl font-bold">
                                        Username
                                    </h3>

                                    <!-- Name -->
                                    <div class="placeholder mb-4 w-24"></div>

                                    <!-- Bio -->
                                    <div class="flex flex-col gap-2">
                                        <div class="flex gap-2">
                                            <div class="placeholder w-48"></div>
                                            <div class="placeholder w-16"></div>
                                        </div>

                                        <div class="flex flex-col gap-2">
                                            <div class="flex gap-2">
                                                <div
                                                    class="placeholder w-32"
                                                ></div>
                                                <div
                                                    class="placeholder w-32"
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="flex w-48 flex-col items-start">
                                    <h2 class="mb-2 text-xl">Level 50</h2>
                                    <button
                                        class="bg-surface-800 pointer-events-none rounded px-4 py-2"
                                    >
                                        Edit Profile
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="bg-surface-950 rounded-container p-4">
                        <h4 class="text-surface-300 mb-2">
                            Rarest Achievement Showcase
                        </h4>
                        <div class="mb-4 grid grid-cols-6 gap-2">
                            {#each Array(6)}
                                <div
                                    class="placeholder aspect-square w-full rounded"
                                ></div>
                            {/each}
                        </div>

                        <div class="grid grid-cols-3 gap-4">
                            <div>
                                <p class="text-3xl font-bold">1,234</p>
                                <p class="text-surface-300">Achievements</p>
                            </div>
                            <div>
                                <p class="text-3xl font-bold">3</p>
                                <p class="text-surface-300">Perfect Games</p>
                            </div>
                            <div>
                                <p class="text-3xl font-bold">42%</p>
                                <p class="text-surface-300">Avg. Completion</p>
                            </div>
                        </div>
                    </div>
                </div>

                Click the
                <strong class="text-white">Edit Profile</strong>
                button.
            </div>
        </section>

        <!-- Step 2 -->
        <section>
            <h2 class="text-2xl">Step 2: Navigate to Privacy Settings</h2>
            <div class="p-6">
                <p class="mb-6">
                    In the Edit Profile page, find and click on the "Privacy
                    Settings" option in the left sidebar.
                </p>

                <!-- Steam Edit Profile UI Recreation -->
                <div class="text-surface-300 mb-6">
                    <div class="flex p-4">
                        <div class="flex items-center">
                            <div
                                class="placeholder mr-3 h-12 w-12 rounded"
                            ></div>
                            <div class="flex items-center">
                                <h3 class="text-xl">Username</h3>
                                <span class="text-surface-500 mx-2"
                                    >&raquo;</span
                                >
                                <div class="text-sm">Edit Profile</div>
                            </div>
                        </div>
                    </div>

                    <div class="flex">
                        <!-- Sidebar -->
                        <div class="bg-surface-950 w-48 space-y-3 p-4">
                            {#each ["General", "Avatar", "Profile Background", "Mini Profile"] as item}
                                <div>
                                    {item}
                                </div>
                            {/each}

                            <hr class="border-surface-700" />

                            <div
                                class="bg-surface-700 rounded px-2 py-1 text-white"
                            >
                                Privacy Settings
                            </div>
                        </div>

                        <!-- Main Content -->
                        <div class="flex flex-col gap-2 p-4">
                            <div class="placeholder mb-2 h-8 w-24"></div>
                            <div class="placeholder w-64"></div>
                            <div class="placeholder w-48"></div>

                            <div class="placeholder my-2 h-8 w-32"></div>
                            <div class="placeholder w-64"></div>
                            <div class="placeholder w-48"></div>
                        </div>
                    </div>
                </div>

                Select
                <strong>Privacy Settings</strong>
                from the left side menu.
            </div>
        </section>

        <!-- Step 3 -->
        <section>
            <h2 class="text-2xl">Step 3: Update Your Game Details Privacy</h2>
            <div class="p-6">
                <p class="mb-6">
                    In the Privacy Settings page, look for the
                    <strong>"Game details"</strong>
                    section and set it to
                    <strong>Public.</strong>
                    You may also want to set your
                    <strong>"Friends List"</strong>
                    to
                    <strong>Public</strong>
                    for a better experience.
                </p>

                <!-- Steam Privacy Settings UI Recreation -->
                <div class="text-surface-300">
                    <div class="p-6">
                        <div class="mb-4 flex flex-col gap-2">
                            <h3 class=" text-surface-300">
                                My profile: <span class="text-white"
                                    >Public</span
                                >
                                <span>▼</span>
                            </h3>
                            <div class="flex gap-2">
                                <div class="placeholder w-48"></div>
                                <div class="placeholder w-72"></div>
                                <div class="placeholder w-12"></div>
                            </div>
                            <div class="flex gap-2">
                                <div class="placeholder w-32"></div>
                                <div class="placeholder w-32"></div>
                                <div class="placeholder w-64"></div>
                            </div>
                        </div>

                        <div class="ml-12">
                            <div
                                class="bg-surface-950 rounded-container -mx-4 mb-2 p-4"
                            >
                                <h3 class="text-surface-300 mb-2">
                                    Game details:
                                    <span class="text-white">Public</span>
                                    <span>▼</span>
                                </h3>

                                <div class="flex flex-col gap-2">
                                    <div class="flex gap-2">
                                        <div class="placeholder w-12"></div>
                                        <div class="placeholder w-48"></div>
                                        <div class="placeholder w-72"></div>
                                    </div>
                                    <div class="flex gap-2">
                                        <div class="placeholder w-32"></div>
                                        <div class="placeholder w-64"></div>
                                        <div class="placeholder w-32"></div>
                                    </div>
                                </div>
                            </div>

                            <div class="mb-4">
                                <h3 class="text-surface-300 mb-2">
                                    Friends List:
                                    <span class="text-white">Public</span>
                                    <span>▼</span>
                                </h3>
                                <div class="flex gap-2">
                                    <div class="placeholder w-64"></div>
                                    <div class="placeholder w-12"></div>
                                    <div class="placeholder w-48"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mt-4">
                    <Alert
                        color="warning"
                        icon={GlobeLock}
                        title="Stay Secure!"
                        description="Carefully review these settings before changing them."
                    />
                </div>
            </div>
        </section>

        <!-- Step 4 -->
        <section>
            <h2 class="text-2xl">Step 4: Wait for Changes</h2>
            <div class="p-6">
                After updating your settings, it may take up to 24 hours for the
                changes to take effect.
            </div>
        </section>

        <section>
            <h2 class="text-2xl">Privacy Concerns?</h2>

            <div class="p-6">
                <p class="mb-2">
                    We only access your public achievement data to provide our
                    service. Making your game details public only allows others
                    to see your games, achievements, and playtime. You can
                    change these settings back at any time.
                </p>
                <p>
                    For more information about Steam's privacy settings, visit
                    our
                    <a href="/legal" class="text-primary-500 hover:underline">
                        privacy page.
                    </a>
                </p>
            </div>
        </section>
    </div>

    <!-- <div class="mt-12 rounded-container bg-surface-900 p-6">
        <h2 class="mb-4 text-2xl font-bold text-purple-400">
            Privacy Concerns?
        </h2>
        <p class="mb-4 text-surface-300">
            We only access your public achievement data to provide our service.
            Making your game details public only allows others to see your
            games, achievements, and playtime. You can change these settings
            back at any time.
        </p>
        <p class="text-surface-300">
            For more information about Steam's privacy settings, visit the{" "}
            <a
                href="https://help.steampowered.com/en/faqs/view/588C-C67D-0251-C276"
                target="_blank"
                rel="noopener noreferrer"
                class="text-purple-400 hover:underline"
            >
                Steam Support page
            </a>
            .
        </p>
    </div> -->
</article>

<style>
    article {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
    }
</style>
