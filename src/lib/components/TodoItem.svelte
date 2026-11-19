<script lang="ts">
	import {
		CheckIcon,
		EllipsisIcon,
		PencilIcon,
		StarIcon,
		StarOffIcon,
		Trash2Icon,
		ArrowRightIcon,
		ArrowLeftIcon,
		RepeatIcon,
		TimerIcon,
		NotebookPenIcon,
		BellIcon,
		DumbbellIcon
	} from '@lucide/svelte';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { focus, FOCUS_MIN } from '#lib/stores/focus.svelte.js';
	import { toast } from 'svelte-sonner';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { cn } from '#lib/utils.js';
	import { addDays, todayKey } from '#lib/date.js';
	import { prefs } from '#lib/stores/prefs.svelte.js';
	import { moveTodo, removeTodo, renameTodo, setDone, setFocus, setNote, setWeight } from '#lib/stores/todos.svelte.js';
	import { celebrate } from '#lib/complete.js';
	import { WEIGHTS } from '#lib/weight.js';
	import type { Todo } from '#lib/types.js';
	import { formatMinutes } from '#lib/smart-input.js';
	import { tagColor } from '#lib/tags.js';

	let {
		todo,
		uid,
		dayItems,
		mode = 'today'
	}: {
		todo: Todo;
		uid: string;
		/** All todos of the same day, needed to keep a single Fokus Utama. */
		dayItems: Todo[];
		mode?: 'today' | 'plan';
	} = $props();

	let box = $state<HTMLButtonElement | null>(null);
	let popping = $state(false);
	let editing = $state(false);
	let noteOpen = $state(false);
	let noteDraft = $state('');
	function openNote() {
		noteDraft = todo.note ?? '';
		noteOpen = true;
	}
	let draft = $state('');
	const reminder = $derived(todo.weight === 0);

	function toggle() {
		if (todo.done) {
			setDone(uid, todo, false);
			return;
		}
		popping = false;
		requestAnimationFrame(() => (popping = true));
		const { golden } = celebrate({
			id: todo.id,
			rect: box?.getBoundingClientRect(),
			color: todo.color,
			weight: todo.weight,
			isFocus: todo.isFocus
		});
		setDone(uid, todo, true, golden);
		if (todo.tag === 'belajar' && !todo.note) {
			toast('Apa yang kamu pelajari?', {
				description: 'Catatan singkat membantu Saran Belajar lebih tepat.',
				action: { label: 'Tulis catatan', onClick: openNote }
			});
		}
	}

	function startEdit() {
		draft = todo.title;
		editing = true;
	}

	function saveEdit() {
		const t = draft.trim();
		if (t && t !== todo.title) renameTodo(uid, todo.id, t);
		editing = false;
	}

	function focusInput(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
</script>

<div
	class={cn(
		'group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors',
		todo.isFocus && !todo.done ? 'bg-primary/8' : 'hover:bg-muted/60'
	)}
>
	<button
		bind:this={box}
		type="button"
		onclick={toggle}
		aria-label={todo.done ? `Batalkan selesai: ${todo.title}` : `Selesaikan: ${todo.title}`}
		class={cn(
			'grid shrink-0 place-items-center border-2 transition-colors',
			reminder ? 'mx-0.5 size-5 rounded-full' : 'size-6 rounded-lg',
			todo.done
				? reminder
					? 'border-muted-foreground/50 bg-muted text-muted-foreground'
					: 'border-primary bg-primary/20 text-primary'
				: reminder
					? 'border-foreground/25 border-dashed hover:border-foreground/50'
					: todo.weight === 3
						? 'border-primary/70 hover:bg-primary/10'
						: 'border-foreground/30 hover:border-primary hover:bg-primary/10',
			popping && 'animate-pop'
		)}
	>
		{#if todo.done}
			<CheckIcon class={reminder ? 'size-3' : 'size-4'} strokeWidth={3} />
		{/if}
	</button>

	<div class="min-w-0 flex-1">
		{#if editing}
			<input
				use:focusInput
				bind:value={draft}
				onblur={saveEdit}
				onkeydown={(e) => {
					if (e.key === 'Enter') saveEdit();
					if (e.key === 'Escape') editing = false;
				}}
				class="w-full rounded-md bg-transparent text-[15px] outline-none"
				maxlength={140}
			/>
		{:else}
			<button
				type="button"
				ondblclick={startEdit}
				class={cn(
					'block w-full truncate text-left leading-snug',
					reminder ? 'text-muted-foreground text-sm' : 'text-[15px]',
					todo.done && 'text-muted-foreground',
					todo.done && prefs.strike && 'decoration-primary line-through decoration-2',
					todo.isFocus && !todo.done && 'font-semibold'
				)}
			>
				{todo.title}
			</button>
		{/if}
	</div>

	{#if reminder}
		<BellIcon class="text-muted-foreground/70 size-3.5 shrink-0" aria-label="Pengingat" />
	{:else if todo.weight === 3}
		<span class="text-primary flex shrink-0 items-center gap-0.5 text-[11px] font-semibold" title="Bobot berat">
			<DumbbellIcon class="size-3.5" />Berat
		</span>
	{:else if todo.weight === 2}
		<DumbbellIcon class="text-primary/70 size-3.5 shrink-0" aria-label="Bobot sedang" />
	{/if}
	{#if focus.session?.todoId === todo.id && focus.session.phase === 'focus'}
		<TimerIcon class="text-primary size-4 shrink-0 animate-pulse" aria-label="Sedang fokus" />
	{:else if todo.focusMin}
		<span class="text-muted-foreground flex items-center gap-0.5 text-[11px] tabular-nums" title="Waktu fokus">
			<TimerIcon class="size-3" />{formatMinutes(todo.focusMin)}
		</span>
	{/if}
	{#if todo.estimateMin}
		<span class="text-muted-foreground hidden text-[11px] tabular-nums sm:inline">{formatMinutes(todo.estimateMin)}</span>
	{/if}
	{#if todo.tag}
		<span
			class="max-w-24 truncate rounded-full px-2 py-0.5 text-[11px] font-medium"
			style="color: color-mix(in oklch, var(--marble-{tagColor(todo.tag)}) 80%, var(--foreground)); background: color-mix(in oklch, var(--marble-{tagColor(todo.tag)}) 16%, transparent)"
			>#{todo.tag}</span
		>
	{/if}
	{#if todo.note}
		<NotebookPenIcon class="text-muted-foreground size-3.5 shrink-0" aria-label="Ada catatan" />
	{/if}
	{#if todo.routineId}
		<RepeatIcon class="text-muted-foreground size-3.5 shrink-0" aria-label="Rutinitas" />
	{/if}
	{#if todo.source === 'logged'}
		<span class="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px]">dicatat</span>
	{/if}
	{#if todo.isFocus}
		<StarIcon class="text-primary size-4 shrink-0" fill="currentColor" />
	{/if}

	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			class="text-muted-foreground hover:bg-muted grid size-8 shrink-0 place-items-center rounded-lg opacity-60 transition group-hover:opacity-100"
			aria-label="Pilihan"
		>
			<EllipsisIcon class="size-4" />
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-52">
			{#if !todo.done && !reminder}
				{#if todo.isFocus}
					<DropdownMenu.Item onclick={() => setFocus(uid, dayItems, null)}>
						<StarOffIcon /> Hapus dari Fokus Utama
					</DropdownMenu.Item>
				{:else}
					<DropdownMenu.Item onclick={() => setFocus(uid, dayItems, todo.id)}>
						<StarIcon /> Jadikan Fokus Utama
					</DropdownMenu.Item>
				{/if}
			{/if}
			{#if !todo.done && mode === 'today' && !reminder}
				<DropdownMenu.Item onclick={() => focus.start(uid, todo.id, todo.title)}>
					<TimerIcon /> Mulai fokus {FOCUS_MIN} menit
				</DropdownMenu.Item>
			{/if}
			<DropdownMenu.Item onclick={startEdit}><PencilIcon /> Ubah</DropdownMenu.Item>
			{#if todo.tag === 'belajar'}
				<DropdownMenu.Item onclick={openNote}><NotebookPenIcon /> Catatan belajar</DropdownMenu.Item>
			{/if}
			{#if !todo.done && mode === 'today'}
				<DropdownMenu.Item
					onclick={() => {
						moveTodo(uid, todo.id, addDays(todayKey(), 1));
						toast('Dipindah ke besok');
					}}
				>
					<ArrowRightIcon /> Pindah ke besok
				</DropdownMenu.Item>
			{/if}
			{#if mode === 'plan' && !todo.done}
				<DropdownMenu.Item
					onclick={() => {
						moveTodo(uid, todo.id, todayKey());
						toast('Dipindah ke hari ini');
					}}
				>
					<ArrowLeftIcon /> Kerjakan hari ini
				</DropdownMenu.Item>
			{/if}
			<DropdownMenu.Separator />
			<DropdownMenu.Label class="text-muted-foreground px-2 py-1 text-[11px] font-semibold uppercase">Bobot</DropdownMenu.Label>
			{#each WEIGHTS as w (w.value)}
				<DropdownMenu.Item onclick={() => setWeight(uid, todo, w.value)}>
					{#if w.value === 0}<BellIcon />{:else}<DumbbellIcon class={w.value === 1 ? 'opacity-30' : w.value === 2 ? 'opacity-60' : ''} />{/if}
					<span class="flex-1">{w.label}</span>
					{#if todo.weight === w.value}<CheckIcon class="text-primary" />{/if}
				</DropdownMenu.Item>
			{/each}
			<DropdownMenu.Separator />
			<DropdownMenu.Item variant="destructive" onclick={() => removeTodo(uid, todo)}>
				<Trash2Icon /> Hapus
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>

<Dialog.Root bind:open={noteOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Catatan belajar</Dialog.Title>
			<Dialog.Description>{todo.title}</Dialog.Description>
		</Dialog.Header>
		<textarea
			bind:value={noteDraft}
			rows="4"
			maxlength={500}
			placeholder="Apa yang sudah dipahami? Apa yang masih bingung?"
			class="bg-muted/60 focus:ring-ring/40 w-full resize-none rounded-2xl p-3 text-sm outline-none focus:ring-2"
		></textarea>
		<Dialog.Footer>
			<Button
				onclick={() => {
					setNote(uid, todo.id, noteDraft);
					noteOpen = false;
					toast.success('Catatan disimpan');
				}}>Simpan</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
