<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { doc, getDoc, setDoc } from 'firebase/firestore';
	import { ChevronLeftIcon, ChevronRightIcon, FlameIcon, MoonStarIcon, StarIcon } from '@lucide/svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { db } from '#lib/firebase.js';
	import { session } from '#lib/stores/session.svelte.js';
	import { DayTodos, loadStreak } from '#lib/stores/todos.svelte.js';
	import { addDays, formatDay, formatTime, todayKey } from '#lib/date.js';
	import { confettiBurst, playFanfare } from '#lib/feedback.js';
	import { marbleColor } from '#lib/stores/jar.svelte.js';
	import { cn } from '#lib/utils.js';
	import Jar from '#lib/components/Jar.svelte';
	import AppNav from '#lib/components/AppNav.svelte';
	import type { DayNote } from '#lib/types.js';

	const uid = $derived(session.user!.uid);
	const today = todayKey();
	const date = $derived(page.url.searchParams.get('d') ?? today);
	const isToday = $derived(date === today);

	let day = $state<DayTodos | null>(null);
	$effect(() => {
		const d = new DayTodos(uid, date);
		day = d;
		return d.start();
	});

	const done = $derived(day?.done ?? []);
	const timeline = $derived([...done].reverse());
	const planned = $derived(day?.planned.length ?? 0);
	const plannedDone = $derived(day?.plannedDone ?? 0);
	const logged = $derived(done.length - plannedDone);
	const golden = $derived(done.filter((t) => t.golden).length);
	const perfect = $derived(planned > 0 && plannedDone === planned);

	const count = new Tween(0, { duration: 1200, easing: cubicOut });
	$effect(() => {
		count.set(done.length);
	});

	let streak = $state<number | null>(null);
	$effect(() => {
		loadStreak(uid, today)
			.then((s) => (streak = s))
			.catch(() => (streak = null));
	});

	// Celebrate once the day's data is in.
	let celebrated = '';
	$effect(() => {
		if (!day?.loaded || celebrated === date || done.length === 0) return;
		celebrated = date;
		setTimeout(() => {
			if (perfect) {
				playFanfare();
				confettiBurst(undefined, true);
			} else {
				confettiBurst({ x: 0.5, y: 0.3 });
			}
		}, 500);
	});

	const MOODS = [
		{ v: 1, e: '😫', l: 'Berat' },
		{ v: 2, e: '😕', l: 'Kurang' },
		{ v: 3, e: '😐', l: 'Biasa' },
		{ v: 4, e: '🙂', l: 'Baik' },
		{ v: 5, e: '🤩', l: 'Luar biasa' }
	];
	let note = $state<DayNote>({});
	let savedNote = '';
	$effect(() => {
		const ref = doc(db, 'users', uid, 'days', date);
		getDoc(ref)
			.then((s) => {
				note = (s.data() as DayNote) ?? {};
				savedNote = note.note ?? '';
			})
			.catch(() => {});
	});
	function saveNote(patch: Partial<DayNote>) {
		note = { ...note, ...patch };
		setDoc(doc(db, 'users', uid, 'days', date), patch, { merge: true }).catch(() => {});
	}
</script>

<div class="mx-auto min-h-dvh max-w-xl px-4 pt-5 pb-16">
	<header class="flex items-center justify-between">
		<span class="font-display text-lg font-semibold tracking-tight">Jarful</span>
		<AppNav />
	</header>

	<section class="mt-6 flex items-center justify-between">
		<button
			class="text-muted-foreground hover:bg-muted grid size-9 place-items-center rounded-full"
			aria-label="Hari sebelumnya"
			onclick={() => goto(`/rekap?d=${addDays(date, -1)}`)}
		>
			<ChevronLeftIcon class="size-5" />
		</button>
		<div class="text-center">
			<p class="text-primary text-sm font-semibold">{isToday ? 'Rekap Malam' : 'Rekap'}</p>
			<h1 class="font-display text-2xl font-semibold capitalize">{formatDay(date)}</h1>
		</div>
		<button
			class="text-muted-foreground hover:bg-muted grid size-9 place-items-center rounded-full disabled:opacity-30"
			aria-label="Hari berikutnya"
			disabled={isToday}
			onclick={() => goto(addDays(date, 1) === today ? '/rekap' : `/rekap?d=${addDays(date, 1)}`)}
		>
			<ChevronRightIcon class="size-5" />
		</button>
	</section>

	{#key date}
		<section class="mt-6 flex flex-col items-center">
			<Jar
				full={perfect}
				marbles={done.map((t) => ({ id: t.id, color: t.color, golden: t.golden }))}
				class="h-56 w-46"
			/>
			<p class="font-display text-primary mt-4 text-7xl leading-none font-semibold tabular-nums">
				{Math.round(count.current)}
			</p>
			<p class="mt-1 font-semibold">todo selesai</p>
			<p class="text-muted-foreground text-sm">
				{plannedDone} dari {planned} rencana · {logged} dicatat{golden ? ` · ${golden} emas` : ''}
			</p>
			<div class="mt-4 flex flex-wrap justify-center gap-2 text-sm">
				{#if streak !== null}
					<span class="bg-card ring-border flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1">
						<FlameIcon class="size-4 text-orange-500" /> Streak <b>{streak}</b> hari
					</span>
				{/if}
				{#if perfect}
					<span class="bg-gold/25 flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold">
						<StarIcon class="size-4" fill="currentColor" /> Hari sempurna
					</span>
				{/if}
			</div>
		</section>

		{#if timeline.length}
			<section class="bg-card ring-border mt-8 rounded-3xl p-5 ring-1">
				<h2 class="text-muted-foreground text-[11px] font-bold tracking-widest uppercase">
					Jejak hari ini
				</h2>
				<ol class="border-border relative mt-4 ml-1.5 space-y-4 border-l-2 pl-5">
					{#each timeline as t, i (t.id)}
						<li class="relative" in:fly={{ x: -12, delay: 300 + i * 90, duration: 300 }}>
							<span
								class={cn(
									'ring-card absolute top-1.5 -left-[27px] rounded-full ring-4',
									t.isFocus ? 'size-3.5' : 'size-3'
								)}
								style="background: {marbleColor(t.color, t.golden)}"
							></span>
							<p class="text-muted-foreground text-xs tabular-nums">
								{t.doneAt ? formatTime(t.doneAt.toDate()) : ''}
								{t.source === 'logged' ? '· dicatat' : ''}
							</p>
							<p class={cn('text-[15px]', t.isFocus && 'font-semibold')}>
								{t.title}
								{#if t.isFocus}<StarIcon class="text-primary ml-1 inline size-3.5" fill="currentColor" />{/if}
							</p>
						</li>
					{/each}
				</ol>
			</section>
		{:else if day?.loaded}
			<p class="text-muted-foreground mt-8 text-center text-sm">
				Belum ada yang selesai di hari ini. Besok kita isi toplesnya, ya.
			</p>
		{/if}

		<section class="bg-card ring-border mt-4 rounded-3xl p-5 ring-1">
			<h2 class="text-muted-foreground text-[11px] font-bold tracking-widest uppercase">
				Hari ini terasa
			</h2>
			<div class="mt-3 flex justify-between">
				{#each MOODS as m (m.v)}
					<button
						class={cn(
							'flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-2xl transition',
							note.mood === m.v ? 'bg-primary/15 scale-110' : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0'
						)}
						aria-pressed={note.mood === m.v}
						onclick={() => saveNote({ mood: m.v })}
					>
						{m.e}<span class="text-muted-foreground text-[10px]">{m.l}</span>
					</button>
				{/each}
			</div>
			<textarea
				class="bg-muted/60 focus:ring-ring/40 mt-4 w-full resize-none rounded-2xl p-3 text-sm outline-none focus:ring-2"
				rows="2"
				maxlength={200}
				placeholder="Satu kalimat refleksi: apa yang paling kamu syukuri hari ini?"
				value={note.note ?? ''}
				oninput={(e) => (note = { ...note, note: e.currentTarget.value })}
				onblur={() => {
					if ((note.note ?? '') !== savedNote) {
						savedNote = note.note ?? '';
						saveNote({ note: savedNote });
					}
				}}
			></textarea>
		</section>
	{/key}

	{#if isToday}
		<a
			href="/besok"
			class="bg-primary text-primary-foreground mt-6 flex items-center justify-center gap-2 rounded-full py-3.5 font-semibold shadow-lg"
		>
			<MoonStarIcon class="size-4" /> Rencanakan besok
		</a>
	{/if}
</div>
