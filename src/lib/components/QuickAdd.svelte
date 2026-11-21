<script lang="ts">
	import { CheckIcon, PlusIcon, MoonIcon, CalendarIcon, CalendarDaysIcon, ClockIcon, HashIcon, DumbbellIcon, XIcon, BellIcon } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import { toast } from 'svelte-sonner';
	import { parseSmart } from '#lib/smart-input.js';
	import { recentTags, tagColor } from '#lib/tags.js';
	import { FOCUS_INPUT_EVENT } from '#lib/events.js';
	import { addDays, formatDay, todayKey } from '#lib/date.js';
	import { shortDateLabel } from '#lib/smart-input.js';
	import { goto } from '$app/navigation';
	import { cn } from '#lib/utils.js';
	import { addTodo, newTodoId } from '#lib/stores/todos.svelte.js';
	import { celebrate } from '#lib/complete.js';

	let {
		uid,
		date,
		mode = 'today'
	}: { uid: string; date: string; mode?: 'today' | 'plan' | 'schedule' } = $props();

	// A date chosen with the calendar button wins over a date typed in the text.
	let pickedDate = $state('');
	let dateInput = $state<HTMLInputElement | null>(null);
	function openPicker() {
		const el = dateInput;
		if (!el) return;
		try {
			el.showPicker();
		} catch {
			el.focus();
			el.click();
		}
	}

	let title = $state('');
	let logged = $state(false);
	let input = $state<HTMLInputElement | null>(null);

	const parsed = $derived(parseSmart(title, todayKey()));
	// A logged item is something already done now, so a typed date does not apply.
	const tokens = $derived.by(() => {
		if (mode === 'today' && logged) return parsed.tokens.filter((t) => t.kind !== 'date');
		// A picked date already shows as a chip inside the input.
		return pickedDate ? parsed.tokens.filter((t) => t.kind !== 'date') : parsed.tokens;
	});
	const targetDate = $derived(pickedDate || parsed.date || (mode === 'schedule' ? '' : date));
	const ICON = { date: CalendarIcon, duration: ClockIcon, tag: HashIcon, weight: DumbbellIcon };

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
		mode === 'schedule'
			? 'Todo/pengingat… (coba: bayar listrik 25/11 ~)'
			: mode === 'plan'
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
		const extra = { tag: p.tag, estimateMin: p.estimateMin, weight: p.weight };
		if (mode === 'today' && logged) {
			const id = newTodoId(uid);
			const weight = p.weight ?? 1;
			// Colour is decided by addTodo; pick the same one up front for the flying marble.
			const color = p.tag ? tagColor(p.tag) : 1 + Math.floor(Math.random() * 5);
			const { golden } = celebrate({ id, rect: input?.getBoundingClientRect(), color, weight });
			addTodo(uid, { id, title: p.title, date, done: true, source: 'logged', golden, color, ...extra });
		} else {
			const target = targetDate;
			if (!target) {
				toast('Pilih tanggalnya dulu, atau ketik misalnya "25/12" atau "3 des"');
				openPicker();
				return;
			}
			addTodo(uid, { title: p.title, date: target, source: 'planned', ...extra });
			if (target !== date) {
				const later = target > addDays(todayKey(), 1);
				toast(`Ditambahkan ke ${formatDay(target, { year: target.slice(0, 4) !== todayKey().slice(0, 4) ? 'numeric' : undefined })}`, {
					action: later && mode !== 'schedule' ? { label: 'Lihat', onClick: () => goto('/terjadwal') } : undefined
				});
			}
		}
		title = '';
		pickedDate = '';
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
			{@const Icon = t.kind === 'weight' && t.label === 'Pengingat' ? BellIcon : ICON[t.kind]}
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
	{#if pickedDate}
		<button
			type="button"
			onclick={() => (pickedDate = '')}
			title="Hapus tanggal"
			class="bg-primary/15 text-primary flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
		>
			<CalendarDaysIcon class="size-3.5" />
			{shortDateLabel(pickedDate, todayKey())}
			<XIcon class="size-3" />
		</button>
	{:else if mode === 'plan'}
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
	{#if !(mode === 'today' && logged)}
		<button
			type="button"
			onclick={openPicker}
			title="Pilih tanggal"
			aria-label="Pilih tanggal"
			class={cn(
				'relative grid size-9 shrink-0 place-items-center rounded-full transition-colors',
				pickedDate || mode === 'schedule' ? 'text-primary' : 'text-muted-foreground hover:bg-muted'
			)}
		>
			<CalendarDaysIcon class="size-[18px]" />
			<input
				bind:this={dateInput}
				type="date"
				min={todayKey()}
				tabindex="-1"
				aria-hidden="true"
				class="pointer-events-none absolute inset-0 opacity-0"
				onchange={(e) => {
					pickedDate = e.currentTarget.value;
					e.currentTarget.value = '';
					input?.focus();
				}}
			/>
		</button>
	{/if}
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
