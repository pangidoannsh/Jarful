<script lang="ts">
	import { TrendingUpIcon, TrendingDownIcon, ClockIcon, TargetIcon, TagIcon } from '@lucide/svelte';
	import { addDays, fromKey, todayKey } from '#lib/date.js';
	import { loadTodosBetween } from '#lib/stores/todos.svelte.js';
	import { tagColor } from '#lib/tags.js';
	import { cn } from '#lib/utils.js';
	import type { Todo } from '#lib/types.js';

	let { uid }: { uid: string } = $props();

	const today = todayKey();
	const monday = addDays(today, -((fromKey(today).getDay() + 6) % 7));
	const lastMonday = addDays(monday, -7);
	const from28 = addDays(today, -27);
	const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

	let todos = $state<Todo[] | null>(null);
	$effect(() => {
		loadTodosBetween(uid, from28 < lastMonday ? from28 : lastMonday, today)
			.then((t) => (todos = t))
			.catch(() => (todos = []));
	});

	const s = $derived.by(() => {
		if (!todos) return null;
		const done = todos.filter((t) => t.done);
		const thisWeek = done.filter((t) => t.date >= monday).length;
		// Same span of last week, so Wednesday is compared with Wednesday.
		const span = Math.round((fromKey(today).getTime() - fromKey(monday).getTime()) / 864e5);
		const lastWeek = done.filter((t) => t.date >= lastMonday && t.date <= addDays(lastMonday, span)).length;
		const perDay = DAYS.map((_, i) => {
			const key = addDays(monday, i);
			return { label: DAYS[i], key, n: done.filter((t) => t.date === key).length, future: key > today };
		});
		const recent = done.filter((t) => t.date >= from28);
		const hours = Array.from({ length: 24 }, () => 0);
		recent.forEach((t) => {
			if (t.doneAt) hours[t.doneAt.toDate().getHours()]++;
		});
		const peak = hours.indexOf(Math.max(...hours));
		const tags = new Map<string, number>();
		recent.forEach((t) => t.tag && tags.set(t.tag, (tags.get(t.tag) ?? 0) + 1));
		const topTags = [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
		const planned = todos.filter((t) => t.source === 'planned' && t.date >= from28 && t.date < today);
		const rate = planned.length ? Math.round((planned.filter((t) => t.done).length / planned.length) * 100) : null;
		return { thisWeek, lastWeek, perDay, hours, peak, hasHours: recent.some((t) => t.doneAt), topTags, rate };
	});
	const maxDay = $derived(Math.max(1, ...(s?.perDay.map((d) => d.n) ?? [1])));
	const maxHour = $derived(Math.max(1, ...(s?.hours ?? [1])));
	const maxTag = $derived(Math.max(1, ...(s?.topTags.map((t) => t[1]) ?? [1])));
	const delta = $derived(
		s && s.lastWeek ? Math.round(((s.thisWeek - s.lastWeek) / s.lastWeek) * 100) : null
	);
</script>

{#if s}
	<section class="bg-card ring-border mt-4 rounded-3xl p-5 ring-1">
		<div class="flex items-end justify-between gap-4">
			<div>
				<h2 class="text-muted-foreground text-[11px] font-bold tracking-widest uppercase">Minggu ini</h2>
				<p class="font-display mt-1 text-4xl font-semibold tabular-nums">{s.thisWeek}</p>
				<p class="text-muted-foreground text-sm">todo selesai sejak Senin</p>
			</div>
			{#if delta !== null}
				<p
					class={cn(
						'flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold',
						delta >= 0 ? 'bg-good/15 text-good' : 'bg-muted text-muted-foreground'
					)}
				>
					{#if delta >= 0}<TrendingUpIcon class="size-4" />{:else}<TrendingDownIcon class="size-4" />{/if}
					{delta >= 0 ? '+' : ''}{delta}% vs minggu lalu
				</p>
			{:else if s.lastWeek === 0 && s.thisWeek > 0}
				<p class="bg-good/15 text-good rounded-full px-3 py-1 text-sm font-semibold">Awal yang bagus!</p>
			{/if}
		</div>
		<div class="mt-5 grid h-28 grid-cols-7 items-end gap-2">
			{#each s.perDay as d (d.key)}
				<div class="flex h-full flex-col items-center justify-end gap-1">
					<span class="text-muted-foreground text-[11px] tabular-nums">{d.future ? '' : d.n}</span>
					<div
						class={cn('w-full rounded-lg', d.key === today ? 'bg-primary' : 'bg-primary/40', d.future && 'bg-muted')}
						style="height: {d.future ? 4 : Math.max(4, (d.n / maxDay) * 80)}px"
					></div>
					<span class={cn('text-[11px]', d.key === today ? 'font-bold' : 'text-muted-foreground')}>{d.label}</span>
				</div>
			{/each}
		</div>
	</section>

	<div class="mt-4 grid gap-4 sm:grid-cols-2">
		<section class="bg-card ring-border rounded-3xl p-5 ring-1">
			<h2 class="text-muted-foreground flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase">
				<ClockIcon class="size-3.5" /> Jam paling produktif
			</h2>
			{#if s.hasHours}
				<p class="mt-2 text-sm">
					Paling banyak selesai sekitar <b>jam {String(s.peak).padStart(2, '0')}.00</b>
				</p>
				<div class="mt-3 flex h-16 items-end gap-[2px]">
					{#each s.hours as n, h (h)}
						<div
							class={cn('flex-1 rounded-sm', h === s.peak ? 'bg-primary' : 'bg-primary/30')}
							style="height: {Math.max(2, (n / maxHour) * 64)}px"
							title={`${String(h).padStart(2, '0')}.00 · ${n} todo`}
						></div>
					{/each}
				</div>
				<div class="text-muted-foreground mt-1 flex justify-between text-[10px]">
					<span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
				</div>
			{:else}
				<p class="text-muted-foreground mt-2 text-sm">Belum cukup data. Selesaikan beberapa todo dulu.</p>
			{/if}
		</section>

		<section class="bg-card ring-border rounded-3xl p-5 ring-1">
			<h2 class="text-muted-foreground flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase">
				<TargetIcon class="size-3.5" /> Rencana yang tuntas
			</h2>
			{#if s.rate !== null}
				<p class="font-display mt-1 text-4xl font-semibold tabular-nums">{s.rate}%</p>
				<p class="text-muted-foreground text-sm">
					dari rencana 4 minggu terakhir.
					{s.rate >= 80
						? 'Rencanamu realistis.'
						: s.rate >= 50
							? 'Lumayan. Coba rencanakan sedikit lebih ringan.'
							: 'Coba kurangi jumlah rencana per hari.'}
				</p>
			{:else}
				<p class="text-muted-foreground mt-2 text-sm">Belum ada rencana dari hari-hari sebelumnya.</p>
			{/if}
		</section>
	</div>

	{#if s.topTags.length}
		<section class="bg-card ring-border mt-4 rounded-3xl p-5 ring-1">
			<h2 class="text-muted-foreground flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase">
				<TagIcon class="size-3.5" /> Kategori terbanyak · 4 minggu
			</h2>
			<ul class="mt-3 space-y-2">
				{#each s.topTags as [tag, n] (tag)}
					<li class="flex items-center gap-3 text-sm">
						<span class="w-20 truncate">#{tag}</span>
						<div class="bg-muted h-2.5 flex-1 overflow-hidden rounded-full">
							<div class="h-full rounded-full" style="width: {(n / maxTag) * 100}%; background: var(--marble-{tagColor(tag)})"></div>
						</div>
						<span class="w-6 text-right tabular-nums">{n}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
{/if}
