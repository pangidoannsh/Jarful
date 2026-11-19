<script lang="ts">
	import { RepeatIcon, Trash2Icon, PlusIcon } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { session } from '#lib/stores/session.svelte.js';
	import {
		RoutineList,
		WEEKDAYS,
		WEEK_ORDER,
		deleteRoutine,
		ensureRoutineTodos,
		describeDays,
		saveRoutine,
		setRoutineActive
	} from '#lib/stores/routines.svelte.js';
	import { parseSmart, formatMinutes } from '#lib/smart-input.js';
	import { addDays, todayKey } from '#lib/date.js';
	import { tagColor } from '#lib/tags.js';
	import { weightLabel } from '#lib/weight.js';
	import { cn } from '#lib/utils.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import AppNav from '#lib/components/AppNav.svelte';

	const uid = $derived(session.user!.uid);
	let list = $state<RoutineList | null>(null);
	$effect(() => {
		const l = new RoutineList(uid);
		list = l;
		return l.start();
	});

	let title = $state('');
	let days = $state<number[]>([1, 2, 3, 4, 5, 6, 0]);
	let saving = $state(false);
	const parsed = $derived(parseSmart(title, todayKey()));

	const PRESETS = [
		{ l: 'Setiap hari', d: [0, 1, 2, 3, 4, 5, 6] },
		{ l: 'Hari kerja', d: [1, 2, 3, 4, 5] },
		{ l: 'Akhir pekan', d: [0, 6] }
	];

	function toggleDay(d: number) {
		days = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
	}

	async function add(e: SubmitEvent) {
		e.preventDefault();
		if (!parsed.title.trim() || !days.length) return;
		saving = true;
		try {
			await saveRoutine(uid, {
				title: parsed.title,
				days: [...days].sort(),
				tag: parsed.tag,
				estimateMin: parsed.estimateMin,
				weight: parsed.weight,
				active: true
			});
			const today = todayKey();
			await Promise.all([ensureRoutineTodos(uid, today, true), ensureRoutineTodos(uid, addDays(today, 1), true)]);
			toast.success('Rutinitas ditambahkan ke daftar harianmu');
			title = '';
		} catch {
			toast.error('Gagal menyimpan rutinitas');
		} finally {
			saving = false;
		}
	}
</script>

<div class="mx-auto min-h-dvh max-w-xl px-4 pt-5 pb-16">
	<header class="flex items-center justify-between">
		<span class="font-display text-lg font-semibold tracking-tight">Jarful</span>
		<AppNav />
	</header>

	<h1 class="font-display mt-6 text-3xl font-semibold">Rutinitas</h1>
	<p class="text-muted-foreground mt-1 text-sm">
		Kebiasaan yang muncul otomatis di daftar harian, jadi tidak perlu diketik ulang.
	</p>

	<form onsubmit={add} class="bg-card ring-border mt-6 space-y-4 rounded-3xl p-5 ring-1">
		<Input bind:value={title} placeholder="contoh: Minum creatine ~" class="h-11" maxlength={140} />
		{#if parsed.tokens.length}
			<p class="text-muted-foreground -mt-2 text-xs">{parsed.tokens.map((t) => t.label).join(' · ')}</p>
		{/if}
		<p class="text-muted-foreground -mt-2 text-xs">
			Tips: akhiri dengan <b>~</b> untuk pengingat kecil tanpa kelereng (misalnya "Minum creatine ~"), atau <b>!</b> / <b>!!</b> untuk tugas sedang / berat.
		</p>
		<div class="flex flex-wrap gap-1.5">
			{#each PRESETS as p (p.l)}
				<button
					type="button"
					class={cn(
						'rounded-full border px-3 py-1 text-xs font-medium',
						[...days].sort().join() === [...p.d].sort().join()
							? 'border-primary bg-primary/10 text-primary'
							: 'text-muted-foreground'
					)}
					onclick={() => (days = [...p.d])}>{p.l}</button
				>
			{/each}
		</div>
		<div class="grid grid-cols-7 gap-1.5">
			{#each WEEK_ORDER as d (d)}
				<button
					type="button"
					aria-pressed={days.includes(d)}
					onclick={() => toggleDay(d)}
					class={cn(
						'rounded-xl py-2 text-xs font-semibold transition',
						days.includes(d) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
					)}>{WEEKDAYS[d]}</button
				>
			{/each}
		</div>
		<Button type="submit" class="h-11 w-full rounded-xl" disabled={saving || !title.trim() || !days.length}>
			<PlusIcon class="size-4" /> Tambah rutinitas
		</Button>
	</form>

	<ul class="mt-4 space-y-2">
		{#each list?.items ?? [] as r (r.id)}
			<li class={cn('bg-card ring-border flex items-center gap-3 rounded-2xl p-4 ring-1', !r.active && 'opacity-60')}>
				<RepeatIcon class="text-primary size-4 shrink-0" />
				<div class="min-w-0 flex-1">
					<p class="truncate font-medium">{r.title}</p>
					<p class="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
						{describeDays(r.days)}
						{#if r.tag}
							<span style="color: var(--marble-{tagColor(r.tag)})">#{r.tag}</span>
						{/if}
						{#if r.estimateMin}<span>{formatMinutes(r.estimateMin)}</span>{/if}
						{#if r.weight !== undefined && r.weight !== 1}<span>{weightLabel(r.weight)}</span>{/if}
					</p>
				</div>
				<Switch
					checked={r.active}
					onCheckedChange={(v) => setRoutineActive(uid, r.id, v)}
					aria-label="Aktifkan rutinitas"
				/>
				<button
					class="text-muted-foreground hover:text-destructive grid size-8 place-items-center rounded-lg"
					aria-label="Hapus rutinitas"
					onclick={() => {
						if (confirm(`Hapus rutinitas "${r.title}"?`)) deleteRoutine(uid, r.id);
					}}
				>
					<Trash2Icon class="size-4" />
				</button>
			</li>
		{:else}
			{#if list?.loaded}
				<li class="text-muted-foreground px-4 py-8 text-center text-sm">
					Belum ada rutinitas. Coba tambahkan "Olahraga 30m #sehat" setiap hari kerja.
				</li>
			{/if}
		{/each}
	</ul>
</div>
