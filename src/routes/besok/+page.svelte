<script lang="ts">
	import { flip } from 'svelte/animate';
	import { fade, fly } from 'svelte/transition';
	import { MoonStarIcon, StarIcon, TriangleAlertIcon, BellIcon } from '@lucide/svelte';
	import { session } from '#lib/stores/session.svelte.js';
	import { DayTodos } from '#lib/stores/todos.svelte.js';
	import { addDays, formatDay, todayKey } from '#lib/date.js';
	import TodoItem from '#lib/components/TodoItem.svelte';
	import QuickAdd from '#lib/components/QuickAdd.svelte';
	import AppNav from '#lib/components/AppNav.svelte';
	import CarryOver from '#lib/components/CarryOver.svelte';
	import { formatMinutes } from '#lib/smart-input.js';

	const uid = $derived(session.user!.uid);
	const tomorrow = addDays(todayKey(), 1);

	let day = $state<DayTodos | null>(null);
	$effect(() => {
		const d = new DayTodos(uid, tomorrow);
		day = d;
		return d.start();
	});

	const items = $derived(day?.items ?? []);
	const list = $derived(
		[...items].sort((a, b) => Number(b.isFocus) - Number(a.isFocus) || a.order - b.order)
	);
	const totalMin = $derived(items.reduce((sum, t) => sum + (t.estimateMin ?? 0), 0));
	const tooMany = $derived(items.length > 7 || totalMin > 8 * 60);
	const hasFocus = $derived(items.some((t) => t.isFocus));
</script>

<div class="mx-auto min-h-dvh max-w-xl px-4 pt-5 pb-36">
	<header class="flex items-center justify-between">
		<span class="font-display text-lg font-semibold tracking-tight">Jarful</span>
		<AppNav />
	</header>

	<section class="mt-6">
		<p class="text-primary flex items-center gap-1.5 text-sm font-semibold">
			<MoonStarIcon class="size-4" /> Rencana Besok
		</p>
		<h1 class="font-display mt-1 text-[2rem] leading-tight font-semibold tracking-tight capitalize">
			{formatDay(tomorrow)}
		</h1>
		<p class="text-muted-foreground mt-2 text-sm">
			Tulis 3–7 hal yang ingin kamu selesaikan besok, lalu pilih satu sebagai Fokus Utama.
		</p>
	</section>

	<div class="mt-6 space-y-4">
		<CarryOver {uid} today={tomorrow} target={tomorrow} title="Belum selesai, bawa ke besok?" />

		{#if list.length}
			<section>
				<h2 class="text-muted-foreground px-1 text-[11px] font-bold tracking-widest uppercase">
					Rencana · {items.length} item{totalMin ? ` · estimasi ${formatMinutes(totalMin)}` : ''}
				</h2>
				<ul class="mt-1">
					{#each list as t (t.id)}
						<li animate:flip={{ duration: 300 }} in:fly={{ y: 16, duration: 250 }} out:fade={{ duration: 150 }}>
							<TodoItem todo={t} {uid} dayItems={items} mode="plan" />
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if items.length && !hasFocus}
			<p class="text-muted-foreground flex items-center gap-1.5 px-1 text-xs">
				<StarIcon class="size-3.5" /> Pilih satu Fokus Utama lewat menu ⋯, hal terpenting besok.
			</p>
		{/if}

		{#if tooMany}
			<div class="flex gap-3 rounded-2xl bg-amber-500/10 p-4 text-sm" in:fade>
				<TriangleAlertIcon class="mt-0.5 size-4 shrink-0 text-amber-600" />
				<p>
					<b>{items.length} rencana{totalMin ? `, sekitar ${formatMinutes(totalMin)}` : ''}</b> mungkin terlalu banyak untuk satu hari. Rencana yang realistis
					lebih sering selesai, dan itu jauh lebih memuaskan. Pertimbangkan memindah sebagian.
				</p>
			</div>
		{:else if items.length >= 3}
			<p class="text-good px-1 text-sm font-medium">Ukurannya pas. Selamat beristirahat!</p>
		{/if}

		{#if day?.loaded && items.length === 0}
			<div class="text-muted-foreground px-6 py-12 text-center text-sm">
				<p class="font-display text-foreground text-xl">Besok mau ngapain?</p>
				<p class="mt-2">Rencana yang ditulis malam ini membuat pagimu langsung terarah.</p>
				<p class="mt-4 inline-flex items-center gap-1.5 text-xs">
					<BellIcon class="size-3.5" /> Pengingat malam akan hadir di versi berikutnya.
				</p>
			</div>
		{/if}
	</div>
</div>

<div class="fixed inset-x-0 bottom-0 z-40 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]">
	<QuickAdd {uid} date={tomorrow} mode="plan" />
</div>
