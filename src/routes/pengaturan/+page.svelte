<script lang="ts">
	import { KeyRoundIcon, LogOutIcon, ShieldIcon } from '@lucide/svelte';
	import { session } from '#lib/stores/session.svelte.js';
	import { prefs, type ThemePref } from '#lib/stores/prefs.svelte.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { cn } from '#lib/utils.js';
	import AppNav from '#lib/components/AppNav.svelte';
	import { playComplete } from '#lib/feedback.js';

	const themes: { v: ThemePref; l: string }[] = [
		{ v: 'auto', l: 'Otomatis' },
		{ v: 'light', l: 'Terang' },
		{ v: 'dark', l: 'Gelap' }
	];
</script>

<div class="mx-auto min-h-dvh max-w-xl px-4 pt-5 pb-16">
	<header class="flex items-center justify-between">
		<span class="font-display text-lg font-semibold tracking-tight">Jarful</span>
		<AppNav />
	</header>

	<h1 class="font-display mt-6 text-3xl font-semibold">Pengaturan</h1>

	<section class="bg-card ring-border mt-6 rounded-3xl p-5 ring-1">
		<p class="text-muted-foreground text-xs">Masuk sebagai</p>
		<p class="mt-0.5 text-lg font-semibold">{session.displayName}</p>
		<p class="text-muted-foreground text-sm">@{session.username}{session.isAdmin ? ' · admin' : ''}</p>
	</section>

	<section class="bg-card ring-border mt-4 divide-y rounded-3xl ring-1">
		<label class="flex items-center justify-between gap-4 p-5">
			<div>
				<p class="font-medium">Suara</p>
				<p class="text-muted-foreground text-sm">Bunyi "tik" saat todo selesai, nadanya naik saat combo.</p>
			</div>
			<Switch bind:checked={prefs.sound} onCheckedChange={(v) => v && playComplete(1)} />
		</label>
		<label class="flex items-center justify-between gap-4 p-5">
			<div>
				<p class="font-medium">Getar</p>
				<p class="text-muted-foreground text-sm">Getaran halus di HP saat todo selesai.</p>
			</div>
			<Switch bind:checked={prefs.haptic} />
		</label>
		<label class="flex items-center justify-between gap-4 p-5">
			<div>
				<p class="font-medium">Garis coretan</p>
				<p class="text-muted-foreground text-sm">Tampilkan garis coret pada todo yang sudah selesai.</p>
			</div>
			<Switch bind:checked={prefs.strike} />
		</label>
		<div class="p-5">
			<p class="font-medium">Tema</p>
			<p class="text-muted-foreground text-sm">Otomatis: gelap mulai jam 18.00 sampai 06.00.</p>
			<div class="bg-muted mt-3 grid grid-cols-3 gap-1 rounded-full p-1">
				{#each themes as t (t.v)}
					<button
						class={cn(
							'rounded-full py-2 text-sm font-medium transition',
							prefs.theme === t.v ? 'bg-card shadow-sm' : 'text-muted-foreground'
						)}
						onclick={() => (prefs.theme = t.v)}
					>
						{t.l}
					</button>
				{/each}
			</div>
		</div>
	</section>

	<section class="mt-4 space-y-2">
		<Button href="/ganti-password" variant="outline" class="h-11 w-full justify-start gap-2 rounded-2xl">
			<KeyRoundIcon class="size-4" /> Ganti password
		</Button>
		{#if session.isAdmin}
			<Button href="/admin" variant="outline" class="h-11 w-full justify-start gap-2 rounded-2xl">
				<ShieldIcon class="size-4" /> Panel admin
			</Button>
		{/if}
		<Button
			variant="ghost"
			class="text-destructive h-11 w-full justify-start gap-2 rounded-2xl"
			onclick={() => session.logout()}
		>
			<LogOutIcon class="size-4" /> Keluar
		</Button>
	</section>
</div>
