<script lang="ts">
	import { CheckIcon, PlusIcon, MoonIcon, CalendarIcon, ClockIcon, HashIcon } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import { toast } from 'svelte-sonner';
	import { parseSmart } from '#lib/smart-input.js';
	import { recentTags, tagColor } from '#lib/tags.js';
	import { FOCUS_INPUT_EVENT } from '#lib/events.js';
	import { formatDay, todayKey } from '#lib/date.js';
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

	const parsed = $derived(parseSmart(title, todayKey()));
	// A logged item is something already done now, so a typed date does not apply.
	const tokens = $derived(
		mode === 'today' && logged ? parsed.tokens.filter((t) => t.kind !== 'date') : parsed.tokens
	);
	const ICON = { date: CalendarIcon, duration: ClockIcon, tag: HashIcon };

	// While a #tag is being typed, offer the ones already used.
	const partialTag = $derived(title.match(/(?:^|\s)#([\p{L}\p{N}_-]*)$/u)?.[1] ?? null);
	const tagSuggestions = $derived(
		partialTag === null
			? []
			: recentTags()
					.filter((t) => t.startsWith(partialTag.toLowerCase()) && t !== partialTag.toLowerCase())
					.slice(0, 6)
	);
	function pickTag(tag: string) {
		title = title.replace(/#[\p{L}\p{N}_-]*$/u, `#${tag} `);
		input?.focus();
	}

	const placeholder = $derived(
		mode === 'plan'
			? 'Rencana besok… (coba: gym 1j #sehat)'
			: logged
				? 'Baru saja kulakukan…'
				: 'Tambah todo… (coba: baca 30m #belajar)'
	);

	$effect(() => {
		const f = () => input?.focus();
		addEventListener(FOCUS_INPUT_EVENT, f);
		return () => removeEventListener(FOCUS_INPUT_EVENT, f);
	});

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!title.trim()) return;
		const p = parsed;
		const extra = { tag: p.tag, estimateMin: p.estimateMin };
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
			const todo = addTodo(uid, { id, title: p.title, date, done: true, source: 'logged', golden, ...extra });
			const rect = input?.getBoundingClientRect();
			if (rect) jar.launch(id, rect, resolvedMarbleColor(todo.color, golden), golden);
		} else {
			const target = p.date ?? date;
			addTodo(uid, { title: p.title, date: target, source: 'planned', ...extra });
			if (target !== date) toast(`Ditambahkan ke ${formatDay(target)}`);
		}
		title = '';
		input?.focus();
	}
</script>

{#if tagSuggestions.length}
	<div class="mx-auto mb-2 flex w-full max-w-xl flex-wrap gap-1.5 px-2" transition:fly={{ y: 6, duration: 150 }}>
		{#each tagSuggestions as t (t)}
			<button
				type="button"
				onclick={() => pickTag(t)}
				class="bg-card ring-border flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm ring-1"
			>
				<span class="size-2.5 rounded-full" style="background: var(--marble-{tagColor(t)})"></span>
				#{t}
			</button>
		{/each}
	</div>
{:else if tokens.length}
	<div class="mx-auto mb-2 flex w-full max-w-xl flex-wrap gap-1.5 px-2" transition:fly={{ y: 6, duration: 150 }}>
		{#each tokens as t (t.kind)}
			{@const Icon = ICON[t.kind]}
			<span
				class="bg-card text-foreground ring-border flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm ring-1"
			>
				<Icon class="text-primary size-3.5" />
				{t.label}
			</span>
		{/each}
	</div>
{/if}

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
