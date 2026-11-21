<script lang="ts">
	import {
		SunIcon,
		MoonStarIcon,
		SparklesIcon,
		ChartColumnIcon,
		RepeatIcon,
		GraduationCapIcon,
		SettingsIcon,
		ShieldIcon,
		PlusIcon,
		PaletteIcon,
		SearchIcon,
		CalendarDaysIcon
	} from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { session } from '#lib/stores/session.svelte.js';
	import { prefs } from '#lib/stores/prefs.svelte.js';
	import { cn } from '#lib/utils.js';
	import { FOCUS_INPUT_EVENT } from '#lib/events.js';

	let open = $state(false);
	let q = $state('');
	let active = $state(0);

	function newTodo() {
		if (location.pathname !== '/' && location.pathname !== '/besok') goto('/');
		setTimeout(() => dispatchEvent(new Event(FOCUS_INPUT_EVENT)), 50);
	}

	const commands = $derived(
		[
			{ label: 'Todo baru', hint: 'N', icon: PlusIcon, run: newTodo },
			{ label: 'Hari Ini', hint: 'H', icon: SunIcon, run: () => goto('/') },
			{ label: 'Rencana Besok', hint: 'B', icon: MoonStarIcon, run: () => goto('/besok') },
			{ label: 'Terjadwal', hint: 'J', icon: CalendarDaysIcon, run: () => goto('/terjadwal') },
			{ label: 'Rekap Malam', hint: 'R', icon: SparklesIcon, run: () => goto('/rekap') },
			{ label: 'Statistik', hint: 'S', icon: ChartColumnIcon, run: () => goto('/statistik') },
			{ label: 'Saran Belajar', hint: 'L', icon: GraduationCapIcon, run: () => goto('/belajar') },
			{ label: 'Rutinitas', hint: '', icon: RepeatIcon, run: () => goto('/rutinitas') },
			{ label: 'Pengaturan', hint: '', icon: SettingsIcon, run: () => goto('/pengaturan') },
			{
				label: `Ganti tema (sekarang: ${prefs.theme === 'auto' ? 'otomatis' : prefs.theme === 'light' ? 'terang' : 'gelap'})`,
				hint: '',
				icon: PaletteIcon,
				run: () => (prefs.theme = prefs.theme === 'auto' ? 'light' : prefs.theme === 'light' ? 'dark' : 'auto')
			},
			...(session.isAdmin ? [{ label: 'Panel admin', hint: '', icon: ShieldIcon, run: () => goto('/admin') }] : [])
		].filter((c) => c.label.toLowerCase().includes(q.trim().toLowerCase()))
	);

	$effect(() => {
		void q;
		active = 0;
	});

	function run(i: number) {
		const c = commands[i];
		if (!c) return;
		open = false;
		q = '';
		c.run();
	}

	function typing(t: EventTarget | null) {
		const el = t as HTMLElement | null;
		return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
	}

	function onKey(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			open = !open;
			return;
		}
		if (open || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
		const map: Record<string, () => void> = {
			n: newTodo,
			h: () => goto('/'),
			t: () => goto('/'),
			b: () => goto('/besok'),
			j: () => goto('/terjadwal'),
			r: () => goto('/rekap'),
			s: () => goto('/statistik'),
			l: () => goto('/belajar'),
			'?': () => (open = true)
		};
		const fn = map[e.key.toLowerCase()];
		if (fn) {
			e.preventDefault();
			fn();
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<Dialog.Root bind:open>
	<Dialog.Content class="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
		<Dialog.Title class="sr-only">Palet perintah</Dialog.Title>
		<div class="flex items-center gap-2 border-b px-4">
			<SearchIcon class="text-muted-foreground size-4" />
			<!-- svelte-ignore a11y_autofocus -->
			<input
				autofocus
				bind:value={q}
				placeholder="Cari perintah…"
				class="h-12 flex-1 bg-transparent text-sm outline-none"
				onkeydown={(e) => {
					if (e.key === 'ArrowDown') {
						e.preventDefault();
						active = Math.min(active + 1, commands.length - 1);
					} else if (e.key === 'ArrowUp') {
						e.preventDefault();
						active = Math.max(active - 1, 0);
					} else if (e.key === 'Enter') {
						e.preventDefault();
						run(active);
					}
				}}
			/>
		</div>
		<ul class="max-h-80 overflow-y-auto p-1.5">
			{#each commands as c, i (c.label)}
				<li>
					<button
						class={cn(
							'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm',
							i === active ? 'bg-muted' : 'hover:bg-muted/60'
						)}
						onmouseenter={() => (active = i)}
						onclick={() => run(i)}
					>
						<c.icon class="text-muted-foreground size-4" />
						<span class="flex-1">{c.label}</span>
						{#if c.hint}<kbd class="bg-background ring-border rounded px-1.5 text-[11px] ring-1">{c.hint}</kbd>{/if}
					</button>
				</li>
			{:else}
				<li class="text-muted-foreground px-3 py-6 text-center text-sm">Tidak ada perintah</li>
			{/each}
		</ul>
		<p class="text-muted-foreground border-t px-4 py-2 text-[11px]">
			Tekan <kbd>Ctrl/⌘ K</kbd> kapan saja · <kbd>?</kbd> untuk membuka ini
		</p>
	</Dialog.Content>
</Dialog.Root>
