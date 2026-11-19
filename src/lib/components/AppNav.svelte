<script lang="ts">
	import { MoonStarIcon, SettingsIcon, ShieldIcon, SparklesIcon, SunIcon } from '@lucide/svelte';
	import { page } from '$app/state';
	import { cn } from '#lib/utils.js';
	import { session } from '#lib/stores/session.svelte.js';

	const links = $derived([
		{ href: '/', label: 'Hari Ini', icon: SunIcon },
		{ href: '/besok', label: 'Besok', icon: MoonStarIcon },
		{ href: '/rekap', label: 'Rekap', icon: SparklesIcon },
		...(session.isAdmin ? [{ href: '/admin', label: 'Admin', icon: ShieldIcon }] : []),
		{ href: '/pengaturan', label: 'Pengaturan', icon: SettingsIcon }
	]);
</script>

<nav class="flex items-center gap-1" aria-label="Navigasi utama">
	{#each links as l (l.href)}
		{@const active = page.url.pathname === l.href}
		<a
			href={l.href}
			aria-label={l.label}
			title={l.label}
			aria-current={active ? 'page' : undefined}
			class={cn(
				'grid size-9 place-items-center rounded-full transition-colors',
				active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'
			)}
		>
			<l.icon class="size-[18px]" />
		</a>
	{/each}
</nav>
