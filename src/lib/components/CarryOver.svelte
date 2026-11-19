<script lang="ts">
	import { HistoryIcon, XIcon } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import { formatDay } from '#lib/date.js';
	import { loadCarryOver, moveTodo, removeTodo } from '#lib/stores/todos.svelte.js';
	import type { Todo } from '#lib/types.js';

	let {
		uid,
		today,
		target,
		title = 'Belum selesai dari hari sebelumnya'
	}: { uid: string; today: string; target: string; title?: string } = $props();

	let items = $state<Todo[]>([]);
	let open = $state(true);

	$effect(() => {
		let alive = true;
		loadCarryOver(uid, today)
			.then((r) => {
				if (alive) items = r;
			})
			.catch(() => {});
		return () => {
			alive = false;
		};
	});

	function bring(t: Todo) {
		moveTodo(uid, t.id, target);
		items = items.filter((x) => x.id !== t.id);
	}
	function bringAll() {
		items.forEach((t) => moveTodo(uid, t.id, target));
		items = [];
	}
	function drop(t: Todo) {
		removeTodo(uid, t);
		items = items.filter((x) => x.id !== t.id);
	}
</script>

{#if open && items.length > 0}
	<section transition:slide class="bg-muted/70 ring-border rounded-3xl p-4 ring-1">
		<div class="flex items-center gap-2">
			<HistoryIcon class="text-muted-foreground size-4" />
			<h2 class="flex-1 text-sm font-semibold">{title}</h2>
			<button class="text-primary text-sm font-semibold" onclick={bringAll}>Bawa semua</button>
			<button
				class="text-muted-foreground hover:bg-background grid size-7 place-items-center rounded-full"
				aria-label="Tutup"
				onclick={() => (open = false)}
			>
				<XIcon class="size-4" />
			</button>
		</div>
		<ul class="mt-2 space-y-1">
			{#each items as t (t.id)}
				<li transition:slide class="flex items-center gap-2 py-1">
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm">{t.title}</p>
						<p class="text-muted-foreground text-[11px]">{formatDay(t.date, { month: 'short' })}</p>
					</div>
					<button
						class="border-primary/40 text-primary hover:bg-primary/10 rounded-full border px-3 py-1 text-xs font-semibold"
						onclick={() => bring(t)}>Bawa</button
					>
					<button
						class="text-muted-foreground hover:text-destructive rounded-full px-2 py-1 text-xs"
						onclick={() => drop(t)}>Buang</button
					>
				</li>
			{/each}
		</ul>
	</section>
{/if}
