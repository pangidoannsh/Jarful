<script lang="ts">
	import { FlameIcon, TrophyIcon, CalendarCheckIcon, SparklesIcon } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { session } from '#lib/stores/session.svelte.js';
	import { currentStreak, loadDayCounts, longestStreak } from '#lib/stores/todos.svelte.js';
	import { addDays, formatDay, fromKey, todayKey } from '#lib/date.js';
	import { cn } from '#lib/utils.js';
	import AppNav from '#lib/components/AppNav.svelte';
	import WeeklyStats from '#lib/components/WeeklyStats.svelte';

	const uid = $derived(session.user!.uid);
	const today = todayKey();

	// 53 columns of Monday→Sunday weeks, the last one holding today.
	const WEEKS = 53;
	const monday = (key: string) => addDays(key, -((fromKey(key).getDay() + 6) % 7));
	const start = addDays(monday(today), -(WEEKS - 1) * 7);

	let counts = $state<Map<string, number> | null>(null);
	let failed = $state(false);
	$effect(() => {
		loadDayCounts(uid, start)
			.then((c) => (counts = c))
			.catch((e) => {
				console.error(e);
				failed = true;
			});
	});

	const stats = $derived.by(() => {
		if (!counts) return null;
		let total = 0;
		let best: [string, number] | null = null;
		for (const [d, n] of counts) {
			total += n;
			if (!best || n > best[1]) best = [d, n];
		}
		const active = counts.size;
		return {
			total,
			active,
			avg: active ? total / active : 0,
			best,
			streak: currentStreak(counts, today),
			longest: longestStreak(counts)
		};
	});

	function level(n: number) {
		if (n <= 0) return 0;
		if (n <= 2) return 1;
		if (n <= 4) return 2;
		if (n <= 7) return 3;
		return 4;
	}
	const FILL = [
		'var(--muted)',
		'color-mix(in oklch, var(--primary) 28%, var(--muted))',
		'color-mix(in oklch, var(--primary) 52%, var(--muted))',
		'color-mix(in oklch, var(--primary) 78%, var(--muted))',
		'var(--primary)'
	];

	const CELL = 12;
	const STEP = 15;
	const LEFT = 28;
	const TOP = 18;
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

	const grid = $derived.by(() => {
		const cells: { key: string; x: number; y: number; n: number }[] = [];
		const months: { x: number; label: string }[] = [];
		let lastMonth = -1;
		for (let w = 0; w < WEEKS; w++) {
			const first = addDays(start, w * 7);
			const m = fromKey(first).getMonth();
			if (m !== lastMonth) {
				if (w < WEEKS - 2) months.push({ x: LEFT + w * STEP, label: MONTHS[m] });
				lastMonth = m;
			}
			for (let d = 0; d < 7; d++) {
				const key = addDays(first, d);
				if (key > today) continue;
				cells.push({ key, x: LEFT + w * STEP, y: TOP + d * STEP, n: counts?.get(key) ?? 0 });
			}
		}
		return { cells, months };
	});
	const width = LEFT + WEEKS * STEP;
	const height = TOP + 7 * STEP;

	function scrollEnd(node: HTMLElement) {
		node.scrollLeft = node.scrollWidth;
	}
</script>

<div class="mx-auto min-h-dvh max-w-xl px-4 pt-5 pb-16">
	<header class="flex items-center justify-between">
		<span class="font-display text-lg font-semibold tracking-tight">Jarful</span>
		<AppNav />
	</header>

	<h1 class="font-display mt-6 text-3xl font-semibold">Statistik</h1>
	<p class="text-muted-foreground mt-1 text-sm">Pola produktivitasmu: setahun terakhir dan minggu ini.</p>

	{#if failed}
		<p class="text-destructive mt-8 text-sm">Gagal memuat statistik. Periksa koneksi lalu muat ulang.</p>
	{:else}
		<section class="mt-6 grid grid-cols-2 gap-3">
			<div class="bg-card ring-border rounded-3xl p-4 ring-1">
				<FlameIcon class="size-5 text-orange-500" />
				<p class="font-display mt-2 text-4xl font-semibold tabular-nums">{stats?.streak ?? '–'}</p>
				<p class="text-muted-foreground text-sm">hari streak sekarang</p>
			</div>
			<div class="bg-card ring-border rounded-3xl p-4 ring-1">
				<TrophyIcon class="text-gold size-5" />
				<p class="font-display mt-2 text-4xl font-semibold tabular-nums">{stats?.longest ?? '–'}</p>
				<p class="text-muted-foreground text-sm">streak terpanjang</p>
			</div>
			<div class="bg-card ring-border rounded-3xl p-4 ring-1">
				<SparklesIcon class="text-primary size-5" />
				<p class="font-display mt-2 text-4xl font-semibold tabular-nums">{stats?.total ?? '–'}</p>
				<p class="text-muted-foreground text-sm">kelereng setahun ini</p>
			</div>
			<div class="bg-card ring-border rounded-3xl p-4 ring-1">
				<CalendarCheckIcon class="text-good size-5" />
				<p class="font-display mt-2 text-4xl font-semibold tabular-nums">{stats?.active ?? '–'}</p>
				<p class="text-muted-foreground text-sm">
					hari aktif{stats?.active ? ` · rata-rata ${stats.avg.toFixed(1)}` : ''}
				</p>
			</div>
		</section>

		<section class="bg-card ring-border mt-4 rounded-3xl p-4 ring-1">
			<div class="overflow-x-auto pb-1" use:scrollEnd>
				<svg {width} {height} role="img" aria-label="Heatmap todo selesai setahun terakhir" class="block">
					{#each grid.months as m (m.x)}
						<text x={m.x} y="10" font-size="10" fill="var(--muted-foreground)">{m.label}</text>
					{/each}
					<text x="0" y={TOP + 1 * STEP + 10} font-size="10" fill="var(--muted-foreground)">Sel</text>
					<text x="0" y={TOP + 3 * STEP + 10} font-size="10" fill="var(--muted-foreground)">Kam</text>
					<text x="0" y={TOP + 5 * STEP + 10} font-size="10" fill="var(--muted-foreground)">Sab</text>
					{#each grid.cells as c (c.key)}
						<rect
							x={c.x}
							y={c.y}
							width={CELL}
							height={CELL}
							rx="3"
							fill={FILL[level(c.n)]}
							stroke={c.key === today ? 'var(--foreground)' : 'none'}
							stroke-width="1.2"
							class="cursor-pointer transition-opacity hover:opacity-70"
							role="button"
							tabindex="-1"
							aria-label={`${c.n} todo, ${formatDay(c.key)}`}
							onclick={() => goto(c.key === today ? '/rekap' : `/rekap?d=${c.key}`)}
							onkeydown={() => {}}
						>
							<title>{c.n} todo · {formatDay(c.key, { year: 'numeric' })}</title>
						</rect>
					{/each}
				</svg>
			</div>
			<div class="text-muted-foreground mt-3 flex items-center justify-end gap-1.5 text-[11px]">
				Sedikit
				{#each FILL as f, i (i)}
					<span class="size-3 rounded-[3px]" style="background: {f}"></span>
				{/each}
				Banyak
			</div>
		</section>

		<WeeklyStats {uid} />

		{#if stats?.best}
			<a
				href={stats.best[0] === today ? '/rekap' : `/rekap?d=${stats.best[0]}`}
				class={cn('bg-card ring-border mt-4 flex items-center gap-3 rounded-3xl p-4 ring-1')}
			>
				<TrophyIcon class="text-gold size-5 shrink-0" />
				<p class="text-sm">
					Hari terbaikmu: <b>{stats.best[1]} todo</b> pada
					<span class="capitalize">{formatDay(stats.best[0], { year: 'numeric' })}</span>
				</p>
			</a>
		{/if}
	{/if}
</div>
