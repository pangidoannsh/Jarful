<script lang="ts">
	import { flip } from 'svelte/animate';
	import { fade, fly } from 'svelte/transition';
	import { CalendarDaysIcon } from '@lucide/svelte';
	import { collection, onSnapshot, query, where } from 'firebase/firestore';
	import { db } from '#lib/firebase.js';
	import { session } from '#lib/stores/session.svelte.js';
	import { addDays, formatDay, fromKey, todayKey } from '#lib/date.js';
	import TodoItem from '#lib/components/TodoItem.svelte';
	import QuickAdd from '#lib/components/QuickAdd.svelte';
	import AppNav from '#lib/components/AppNav.svelte';
	import type { Todo, Weight } from '#lib/types.js';

	const uid = $derived(session.user!.uid);
	const today = todayKey();
	// Today and tomorrow have their own pages; this one is everything after that.
	const from = addDays(today, 2);

	let items = $state<Todo[]>([]);
	let loaded = $state(false);
	$effect(() =>
		onSnapshot(
			query(collection(db, 'users', uid, 'todos'), where('date', '>=', from)),
			(snap) => {
				items = snap.docs.map((d) => {
					const x = d.data();
					return {
						id: d.id,
						...x,
						weight: (x.weight === undefined ? 1 : x.weight) as Weight
					} as Todo;
				});
				loaded = true;
			},
			() => (loaded = true)
		)
	);

	const groups = $derived.by(() => {
		const map = new Map<string, Todo[]>();
		for (const t of [...items].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)) {
			const list = map.get(t.date) ?? [];
			list.push(t);
			map.set(t.date, list);
		}
		return [...map.entries()];
	});

	function inDays(key: string) {
		const n = Math.round((fromKey(key).getTime() - fromKey(today).getTime()) / 864e5);
		if (n < 7) return `${n} hari lagi`;
		if (n < 31) return `${Math.round(n / 7)} minggu lagi`;
		return `${Math.round(n / 30)} bulan lagi`;
	}
</script>

<div class="mx-auto min-h-dvh max-w-xl px-4 pt-5 pb-36">
	<header class="flex items-center justify-between">
		<span class="font-display text-lg font-semibold tracking-tight">Jarful</span>
		<AppNav />
	</header>

	<p class="text-primary mt-6 flex items-center gap-1.5 text-sm font-semibold">
		<CalendarDaysIcon class="size-4" /> Terjadwal
	</p>
	<h1 class="font-display mt-1 text-3xl font-semibold">Yang akan datang</h1>
	<p class="text-muted-foreground mt-1 text-sm">
		Todo dan pengingat setelah besok. Pada harinya, semuanya otomatis muncul di Hari Ini.
	</p>

	<div class="mt-6 space-y-5">
		{#each groups as [date, list] (date)}
			<section>
				<h2 class="flex items-baseline justify-between px-1">
					<span class="text-sm font-semibold capitalize">
						{formatDay(date, { year: date.slice(0, 4) !== today.slice(0, 4) ? 'numeric' : undefined })}
					</span>
					<span class="text-muted-foreground text-xs">{inDays(date)}</span>
				</h2>
				<ul class="mt-1">
					{#each list as t (t.id)}
						<li animate:flip={{ duration: 300 }} in:fly={{ y: 12, duration: 220 }} out:fade={{ duration: 150 }}>
							<TodoItem todo={t} {uid} dayItems={list} mode="plan" />
						</li>
					{/each}
				</ul>
			</section>
		{/each}

		{#if loaded && groups.length === 0}
			<div class="text-muted-foreground px-6 py-12 text-center text-sm">
				<p class="font-display text-foreground text-xl">Belum ada yang terjadwal</p>
				<p class="mt-2">
					Ketik tanggalnya langsung, misalnya <b>bayar listrik 25/11 ~</b>, <b>ulang tahun ibu 3 des</b>,
					<b>servis motor tgl 15</b>, atau <b>perpanjang SIM 10 hari lagi</b>. Bisa juga lewat ikon kalender.
				</p>
			</div>
		{/if}
	</div>
</div>

<div class="fixed inset-x-0 bottom-0 z-40 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]">
	<QuickAdd {uid} date="" mode="schedule" />
</div>
