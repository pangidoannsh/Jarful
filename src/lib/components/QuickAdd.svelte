<script lang="ts">
	import { CheckIcon, PlusIcon, MoonIcon } from '@lucide/svelte';
	import { cn } from '#lib/utils.js';
	import { addTodo, newTodoId } from '#lib/stores/todos.svelte.js';
	import { jar, resolvedMarbleColor } from '#lib/stores/jar.svelte.js';
	import { haptic, nextCombo, playComplete, playGolden, praise, rollGolden } from '#lib/feedback.js';

	let {
		uid,
		date,
		mode = 'today'
	}: { uid: string; date: string; mode?: 'today' | 'plan' } = $props();

	let title = $state('');
	let logged = $state(false);
	let input = $state<HTMLInputElement | null>(null);

	const placeholder = $derived(
		mode === 'plan'
			? 'Tambah rencana untuk besok…'
			: logged
				? 'Baru saja kulakukan…'
				: 'Tambah todo hari ini…'
	);

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const t = title.trim();
		if (!t) return;
		if (mode === 'today' && logged) {
			const id = newTodoId(uid);
			const golden = rollGolden();
			const combo = nextCombo();
			playComplete(combo);
			haptic(12);
			if (golden) {
				playGolden();
				jar.showLabel(praise(), true);
			} else if (combo >= 2) jar.showLabel(`Combo x${combo}`);
			const todo = addTodo(uid, { id, title: t, date, done: true, source: 'logged', golden });
			const rect = input?.getBoundingClientRect();
			if (rect) jar.launch(id, rect, resolvedMarbleColor(todo.color, golden), golden);
		} else {
			addTodo(uid, { title: t, date, source: 'planned' });
		}
		title = '';
		input?.focus();
	}
</script>

<form
	onsubmit={submit}
	class="bg-card/95 ring-border mx-auto flex w-full max-w-xl items-center gap-2 rounded-full p-1.5 pl-4 shadow-lg ring-1 backdrop-blur"
>
	{#if mode === 'plan'}
		<span
			class="bg-primary/15 text-primary flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
		>
			<MoonIcon class="size-3.5" /> Besok
		</span>
	{/if}
	<input
		bind:this={input}
		bind:value={title}
		{placeholder}
		maxlength={140}
		enterkeyhint="done"
		aria-label={placeholder}
		class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none"
	/>
	{#if mode === 'today'}
		<button
			type="button"
			onclick={() => (logged = !logged)}
			aria-pressed={logged}
			title="Catat sebagai sudah selesai"
			class={cn(
				'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors',
				logged
					? 'border-primary bg-primary/15 text-primary'
					: 'text-muted-foreground hover:bg-muted border-transparent'
			)}
		>
			<CheckIcon class="size-3.5" strokeWidth={3} />
			<span class="hidden sm:inline">Sudah selesai</span>
		</button>
	{/if}
	<button
		type="submit"
		aria-label="Tambah"
		disabled={!title.trim()}
		class="bg-primary text-primary-foreground grid size-10 shrink-0 place-items-center rounded-full transition disabled:opacity-40"
	>
		<PlusIcon class="size-5" strokeWidth={2.5} />
	</button>
</form>
