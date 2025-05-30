<script lang="ts">
    import { quartOut } from "svelte/easing";
    import { crossfade } from "svelte/transition";

    interface Props {
        translate: boolean;
        class?: string;
    }

    let { translate = $bindable(true), class: customClass = "" }: Props =
        $props();

    const [send, receive] = crossfade({
        duration: 300,
        easing: quartOut,
        // when you remove an element
        fallback() {
            return {
                duration: 300,
                css: (t) => `opacity: ${t}`,
            };
        },
    });
</script>

<button class="btn p-1 {customClass}" onclick={() => (translate = !translate)}>
    <!-- These are just Languages and BookA from Lucide -->
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="lucide-icon lucide lucide-languages"
    >
        {#if translate}
            <path d="m5 8 6 6" in:receive={{ key: 2 }} out:send={{ key: 2 }}>
            </path>
            <path
                d="m4 14 6-6 2-3"
                in:receive={{ key: 3 }}
                out:send={{ key: 3 }}
            >
            </path>
            <path d="M2 5h12" in:receive={{ key: 4 }} out:send={{ key: 4 }}>
            </path>
            <path d="M7 2h1" in:receive={{ key: 5 }} out:send={{ key: 5 }}>
            </path>
            <path
                d="m22 22-5-10-5 10"
                in:receive={{ key: 0 }}
                out:send={{ key: 0 }}
            >
            </path>
            <path d="M14 18h6" in:receive={{ key: 1 }} out:send={{ key: 1 }}>
            </path>
        {:else}
            <path
                d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"
                in:receive={{ key: 6 }}
                out:send={{ key: 6 }}
            >
            </path>
            <path
                d="m8 13 4-7 4 7"
                in:receive={{ key: 0 }}
                out:send={{ key: 0 }}
            >
            </path>
            <path d="M9.1 11h5.7" in:receive={{ key: 1 }} out:send={{ key: 1 }}>
            </path>
        {/if}
    </svg>
</button>
