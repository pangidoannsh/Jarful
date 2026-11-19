<script lang="ts">
	import { flip } from 'svelte/animate';
	import { fade, fly } from 'svelte/transition';
	import { MoonStarIcon, SparklesIcon, StarIcon, PartyPopperIcon } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { session } from '#lib/stores/session.svelte.js';
	import { DayTodos } from '#lib/stores/todos.svelte.js';
	import { todayKey, formatDay, greeting, isEvening } from '#lib/date.js';
	import { confettiBurst, playFanfare } from '#lib/feedback.js';
	import Jar from '#lib/components/Jar.svelte';
	import TodoItem from '#lib/components/TodoItem.svelte';
	import QuickAdd from '#lib/components/QuickAdd.svelte';
	import AppNav from '#lib/components/AppNav.svelte';
	import CarryOver from '#lib/components/CarryOver.svelte';

	const uid = $derived(session.user!.uid);
	let today = $state(todayKey());
	let now = $state(new Date());

	$effect(() => {
		const t = setInterval(() => {
			now = new Date();
			const k = todayKey();
			if (k !== today) today = k;
		}, 30_000);
		return () => clearInterval(t);
	});

	let day = $state<DayTodos | null>(null);
	$effect(() => {
		const d = new DayTodos(uid, today);
		day = d;
		return d.start();
	});

	const items = $derived(day?.items ?? []);
	const pending = $derived(day?.pending ?? []);
	const done = $derived(day?.done ?? []);
	const focus = $derived(day?.focus ?? null);
	const listPending = $derived(pending.filter((t) => !t.isFocus));
	const plannedCount = $derived(day?.planned.length ?? 0);
	const plannedDone = $derived(day?.plannedDone ?? 0);
	const allDone = $derived(plannedCount > 0 && plannedDone === plannedCount);
	const progress = $derived(plannedCount ? Math.round((plannedDone / plannedCount) * 100) : 0);

	// Celebrate once, at the moment the last planned todo is done (not on page load).
	let wasAllDone: boolean | null = null;
	$effect(() => {
		if (!day?.loaded) return;
		const now = allDone;
		if (wasAllDone === false && now) {
			setTimeout(() => {
				playFanfare();
				confettiBurst(undefined, true);
				toast.success('Hari sempurna! Semua rencana hari ini tuntas.');
			}, 650);
		}
		wasAllDone = now;
	});
</script>

<div class="mx-auto min-h-dvh max-w-xl px-4 pt-5 pb-36">
	<header class="flex items-center justify-between">
		<span class="font-display text-lg font-semibold tracking-tight">Jarful</span>
		<AppNav />
	</header>

	<section class="mt-6 flex items-end justify-between gap-4">
		<div class="min-w-0">
			<p class="text-muted-foreground text-sm">{greeting(now)}, {session.displayName}</p>
			<h1 class="font-display mt-1 text-[2rem] leading-tight font-semibold tracking-tight capitalize">
				{formatDay(today)}
			</h1>
			<p class="text-muted-foreground mt-2 text-sm">
				{#if plannedCount}
					<span class="text-foreground font-semibold">{plannedDone} dari {plannedCount}</span> rencana
					selesai{done.length > plannedDone ? ` · ${done.length - plannedDone} dicatat` : ''}
				{:else if done.length}
					<span class="text-foreground font-semibold">{done.length}</span> hal produktif tercatat
				{:else}
					Toples masih kosong. Ayo isi kelereng pertama.
				{/if}
			</p>
			<div class="bg-muted mt-3 h-1.5 w-48 overflow-hidden rounded-full">
				<div
					class="bg-primary h-full rounded-full transition-[width] duration-700 ease-out"
					style="width: {progress}%"
				></div>
			</div>
		</div>
		<Jar
			register
			full={allDone}
			marbles={done.map((t) => ({ id: t.id, color: t.color, golden: t.golden }))}
			class="h-32 w-26 shrink-0"
		/>
	</section>

	<div class="mt-6 space-y-4">
		{#if isEvening(now)}
			<a
				href="/rekap"
				class="from-primary/15 to-primary/5 ring-primary/20 flex items-center gap-3 rounded-3xl bg-gradient-to-br p-4 ring-1"
			>
				<MoonStarIcon class="text-primary size-5 shrink-0" />
				<div class="flex-1">
					<p class="text-sm font-semibold">Sudah malam</p>
					<p class="text-muted-foreground text-xs">Lihat rekap hari ini, lalu rencanakan besok.</p>
				</div>
				<SparklesIcon class="text-primary size-4" />
			</a>
		{/if}

		<CarryOver {uid} {today} target={today} />

		{#if focus}
			<section
				class="ring-primary/30 bg-card overflow-hidden rounded-3xl shadow-sm ring-1"
				in:fade
			>
				<p
					class="text-primary flex items-center gap-1.5 px-4 pt-3 text-[11px] font-bold tracking-widest uppercase"
				>
					{#if focus.done}
						<PartyPopperIcon class="size-3.5" /> Fokus utama tuntas
					{:else}
						<StarIcon class="size-3.5" fill="currentColor" /> Fokus utama
					{/if}
				</p>
				<div class="p-1.5 text-lg">
					<TodoItem todo={focus} {uid} dayItems={items} />
				</div>
			</section>
		{:else if pending.length > 0}
			<p class="text-muted-foreground flex items-center gap-1.5 px-1 text-xs">
				<StarIcon class="size-3.5" /> Tip: pilih satu Fokus Utama lewat menu ⋯ pada todo.
			</p>
		{/if}

		{#if listPending.length}
			<section>
				<h2 class="text-muted-foreground px-1 text-[11px] font-bold tracking-widest uppercase">
					Belum
				</h2>
				<ul class="mt-1">
					{#each listPending as t (t.id)}
						<li animate:flip={{ duration: 350 }} in:fly={{ y: 16, duration: 250 }} out:fade={{ duration: 150 }}>
							<TodoItem todo={t} {uid} dayItems={items} />
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if done.filter((t) => !t.isFocus).length}
			<section>
				<h2 class="text-muted-foreground px-1 text-[11px] font-bold tracking-widest uppercase">
					Selesai
				</h2>
				<ul class="mt-1">
					{#each done.filter((t) => !t.isFocus) as t (t.id)}
						<li animate:flip={{ duration: 350 }} in:fly={{ y: -10, duration: 300 }} out:fade={{ duration: 150 }}>
							<TodoItem todo={t} {uid} dayItems={items} />
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if day?.loaded && items.length === 0}
			<div class="text-muted-foreground px-6 py-12 text-center text-sm">
				<p class="font-display text-foreground text-xl">Hari baru, toples baru.</p>
				<p class="mt-2">
					Tulis rencana hari ini di bawah, atau nyalakan <b>Sudah selesai</b> untuk mencatat hal
					produktif yang baru saja kamu lakukan.
				</p>
			</div>
		{/if}
	</div>
</div>

<div class="fixed inset-x-0 bottom-0 z-40 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]">
	<QuickAdd {uid} date={today} />
</div>
