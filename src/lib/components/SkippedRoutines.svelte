<script lang="ts">
	import { RotateCcwIcon } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import { arrayRemove, doc, getDoc, getDocs, query, collection, where, setDoc } from 'firebase/firestore';
	import { toast } from 'svelte-sonner';
	import { db } from '#lib/firebase.js';
	import { fromKey } from '#lib/date.js';
	import { ensureRoutineTodos } from '#lib/stores/routines.svelte.js';

	/** Routines skipped for one day (their todo was deleted that day), with a way to bring them back. */
	let { uid, date }: { uid: string; date: string } = $props();

	let skipped = $state<{ id: string; title: string }[]>([]);
	let busy = $state(false);

	async function load() {
		try {
			const weekday = fromKey(date).getDay();
			const [day, routines] = await Promise.all([
				getDoc(doc(db, 'users', uid, 'days', date)),
				getDocs(query(collection(db, 'users', uid, 'routines'), where('active', '==', true)))
			]);
			const ids = new Set<string>((day.data()?.skippedRoutines as string[] | undefined) ?? []);
			skipped = routines.docs
				.filter((r) => ids.has(r.id) && ((r.data().days as number[]) ?? []).includes(weekday))
				.map((r) => ({ id: r.id, title: String(r.data().title) }));
		} catch {
			skipped = [];
		}
	}

	$effect(() => {
		void date;
		load();
	});

	async function restore(ids: string[]) {
		busy = true;
		try {
			await setDoc(doc(db, 'users', uid, 'days', date), { skippedRoutines: arrayRemove(...ids) }, { merge: true });
			await ensureRoutineTodos(uid, date, true);
			skipped = skipped.filter((s) => !ids.includes(s.id));
			toast.success('Rutinitas dimunculkan lagi');
		} catch {
			toast.error('Gagal memunculkan rutinitas');
		} finally {
			busy = false;
		}
	}
</script>

{#if skipped.length}
	<section transition:slide class="border-border rounded-2xl border border-dashed px-4 py-3">
		<div class="flex items-center gap-2">
			<p class="text-muted-foreground flex-1 text-xs">
				{skipped.length} rutinitas dilewati untuk hari ini karena todo-nya pernah dihapus.
			</p>
			{#if skipped.length > 1}
				<button class="text-primary text-xs font-semibold" disabled={busy} onclick={() => restore(skipped.map((s) => s.id))}>
					Munculkan semua
				</button>
			{/if}
		</div>
		<ul class="mt-1">
			{#each skipped as s (s.id)}
				<li class="flex items-center gap-2 py-1">
					<span class="flex-1 truncate text-sm">{s.title}</span>
					<button
						class="border-primary/40 text-primary hover:bg-primary/10 flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
						disabled={busy}
						onclick={() => restore([s.id])}
					>
						<RotateCcwIcon class="size-3" /> Munculkan
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/if}
