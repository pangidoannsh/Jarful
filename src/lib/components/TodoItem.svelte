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
		NotebookPenIcon
	} from '@lucide/svelte';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { focus, FOCUS_MIN } from '#lib/stores/focus.svelte.js';
	import { toast } from 'svelte-sonner';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { cn } from '#lib/utils.js';
	import { addDays, todayKey } from '#lib/date.js';
	import { prefs } from '#lib/stores/prefs.svelte.js';
	import { jar, resolvedMarbleColor } from '#lib/stores/jar.svelte.js';
	import { moveTodo, removeTodo, renameTodo, setDone, setFocus, setNote } from '#lib/stores/todos.svelte.js';
	import {
		confettiBurst,
		haptic,
		nextCombo,
		playComplete,
		playFanfare,
		playGolden,
		praise,
		rollGolden
	} from '#lib/feedback.js';
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

	function toggle() {
		if (todo.done) {
			setDone(uid, todo, false);
			return;
		}
		const rect = box?.getBoundingClientRect();
		const combo = nextCombo();
		const golden = rollGolden();
		popping = false;
		requestAnimationFrame(() => (popping = true));

		playComplete(combo);
		haptic(golden ? [10, 50, 14] : 12);
		if (golden) {
			playGolden();
			jar.showLabel(praise(), true);
		} else if (combo >= 2) {
			jar.showLabel(`Combo x${combo}`);
		}
		if (rect) jar.launch(todo.id, rect, resolvedMarbleColor(todo.color, golden), golden);
		setDone(uid, todo, true, golden);
		if (todo.tag === 'belajar' && !todo.note) {
			toast('Apa yang kamu pelajari?', {
				description: 'Catatan singkat membantu Saran Belajar lebih tepat.',
				action: { label: 'Tulis catatan', onClick: openNote }
			});
		}

		if (todo.isFocus && rect) {
			playFanfare();
			confettiBurst({
				x: (rect.left + rect.width / 2) / window.innerWidth,
				y: (rect.top + rect.height / 2) / window.innerHeight
			});
			toast.success('Fokus hari ini tuntas!');
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
			'grid size-6 shrink-0 place-items-center rounded-lg border-2 transition-colors',
			todo.done
				? 'border-primary bg-primary/20 text-primary'
				: 'border-foreground/30 hover:border-primary hover:bg-primary/10',
			popping && 'animate-pop'
		)}
	>
		{#if todo.done}
			<CheckIcon class="size-4" strokeWidth={3} />
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
					'block w-full truncate text-left text-[15px] leading-snug',
					todo.done && 'text-muted-foreground',
					todo.done && prefs.strike && 'decoration-primary line-through decoration-2',
					todo.isFocus && !todo.done && 'font-semibold'
				)}
			>
				{todo.title}
			</button>
		{/if}
	</div>

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
			{#if !todo.done}
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
			{#if !todo.done && mode === 'today'}
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
