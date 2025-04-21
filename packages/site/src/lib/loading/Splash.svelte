<script lang="ts">
    import type { LoadingMessage } from "./messages";

    interface Props {
        message: LoadingMessage;
    }

    const { message }: Props = $props();
</script>

<section class="flex min-h-[200px] w-full flex-col items-center justify-center">
    <div class="max-w-[800px]">
        <h1 class="mt-8 text-center text-2xl font-bold text-gray-200">
            Loading...
        </h1>

        <div class="show flex min-h-[400px] flex-col justify-center">
            <h2 class="mb-4 text-center text-lg font-bold">
                "{message.title}"
            </h2>
            <p class="text-md/8 mb-4 text-gray-300">
                {@html message.description}
            </p>

            {#if message?.source}
                <span class="text-gray-400">
                    Source:

                    <a
                        class="underline"
                        href={message.source.url.toString()}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {message.source.text}
                    </a></span
                >
            {/if}
        </div>
    </div>
</section>

<style>
    .show {
        opacity: 0;
        transform: translateY(-20px);
        animation: fadeIn 0.5s ease-in-out;
        animation-delay: 2s;
        animation-fill-mode: forwards;
    }

    @keyframes fadeIn {
        0% {
            opacity: 0;
            transform: translateY(-20px);
        }
        100% {
            opacity: 1;
            transform: translateY(0);
        }
    }
</style>
