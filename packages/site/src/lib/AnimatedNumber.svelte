<script lang="ts">
	// I don't know if this component is even necessary. I was going weird SSR behavior in production.
	// I'm just rolling with this for now, TODO come back to investigate if this is warranted or not.
	import type NumberFlowComponent from "@number-flow/svelte";
	import { onMount } from "svelte";
	import { getLocale } from "$lib/paraglide/runtime";

	interface Props {
		value: number;
		format?: Intl.NumberFormatOptions;
		prefix?: string;
		suffix?: string;
	}

	let { value, format, prefix, suffix }: Props = $props();

	let NumberFlow = $state<typeof NumberFlowComponent | null>(null);

	const locale = $derived(getLocale());
	const formatted = $derived(new Intl.NumberFormat(locale, format).format(value));

	onMount(() => {
		let mounted = true;

		void import("@number-flow/svelte")
			.then(({ default: component }) => {
				if (mounted) {
					NumberFlow = component;
				}
			})
			.catch(() => {});

		return () => {
			mounted = false;
		};
	});
</script>

{#if NumberFlow}
	<NumberFlow {value} locales={locale} {format} {prefix} {suffix} />
{:else}
	{prefix ?? ""}{formatted}{suffix ?? ""}
{/if}
