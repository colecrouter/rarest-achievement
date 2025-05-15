<script lang="ts" module>
    const borderClass = new Map([
        ["primary", "preset-outlined-primary-500"],
        ["secondary", "preset-outlined-secondary-500"],
        ["tertiary", "preset-outlined-tertiary-500"],
        ["success", "preset-outlined-success-500"],
        ["warning", "preset-outlined-warning-500"],
        ["error", "preset-outlined-error-500"],
        ["surface", "preset-outlined-surface-500"],
    ]);
    const textClass = new Map([
        ["primary", "text-primary-500"],
        ["secondary", "text-secondary-500"],
        ["tertiary", "text-tertiary-500"],
        ["success", "text-success-500"],
        ["warning", "text-warning-500"],
        ["error", "text-error-500"],
        ["surface", "text-surface-500"],
    ]);
</script>

<script lang="ts">
    import type TriangleAlert from "@lucide/svelte/icons/triangle-alert";

    interface Props {
        icon: typeof TriangleAlert;
        title: string;
        description: string;
        color:
            | "primary"
            | "secondary"
            | "tertiary"
            | "success"
            | "warning"
            | "error"
            | "surface";
    }

    let { icon: Icon, title, description, color }: Props = $props();

    let border = $derived(borderClass.get(color));
    let text = $derived(textClass.get(color));
</script>

<div class="{border} {text} rounded-container mb-4 flex items-center gap-4 p-4">
    <Icon />
    <div>
        <p class="font-bold">{title}</p>
        <p class="text-xs opacity-80">{description}</p>
    </div>
</div>
