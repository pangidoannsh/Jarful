<script lang="ts">
	import { PauseIcon, PlayIcon, SquareIcon, CoffeeIcon, TimerIcon } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import { focus } from '#lib/stores/focus.svelte.js';
	import { cn } from '#lib/utils.js';

	const mmss = $derived.by(() => {
		const total = Math.ceil(focus.left / 1000);
		return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
	});
	const R = 16;
	const C = 2 * Math.PI * R;
</script>

{#if focus.session}
	{@const s = focus.session}
	<div
		class="fixed inset-x-0 bottom-[84px] z-50 px-3"
		transition:fly={{ y: 20, duration: 220 }}
		role="timer"
		aria-label={`${s.phase === 'focus' ? 'Fokus' : 'Istirahat'} ${mmss}`}
	>
		<div
			class={cn(
				'mx-auto flex max-w-xl items-center gap-3 rounded-full py-2 pr-2 pl-2 shadow-lg ring-1 backdrop-blur',
				s.phase === 'focus'
					? 'bg-foreground/95 text-background ring-foreground/10'
					: 'bg-good/15 ring-good/30'
			)}
		>
			<svg viewBox="0 0 40 40" class="size-10 shrink-0 -rotate-90">
				<circle cx="20" cy="20" r={R} fill="none" stroke="currentColor" stroke-opacity="0.2" stroke-width="3.5" />
				<circle
					cx="20"
					cy="20"
					r={R}
					fill="none"
					stroke={s.phase === 'focus' ? 'var(--primary)' : 'var(--good)'}
					stroke-width="3.5"
					stroke-linecap="round"
					stroke-dasharray={C}
					stroke-dashoffset={C * (1 - focus.progress)}
					class="transition-[stroke-dashoffset] duration-1000 ease-linear"
				/>
			</svg>
			<div class="min-w-0 flex-1">
				<p class="flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase opacity-70">
					{#if s.phase === 'focus'}<TimerIcon class="size-3" /> Fokus{:else}<CoffeeIcon class="size-3" /> Istirahat{/if}
				</p>
				<p class="truncate text-sm font-medium">{s.title}</p>
			</div>
			<span class="font-display text-xl font-semibold tabular-nums">{mmss}</span>
			<button
				class="grid size-9 place-items-center rounded-full hover:bg-white/10"
				aria-label={focus.running ? 'Jeda' : 'Lanjutkan'}
				onclick={() => (focus.running ? focus.pause() : focus.resume())}
			>
				{#if focus.running}<PauseIcon class="size-4" />{:else}<PlayIcon class="size-4" />{/if}
			</button>
			<button
				class="grid size-9 place-items-center rounded-full hover:bg-white/10"
				aria-label="Hentikan"
				onclick={() => focus.stop()}
			>
				<SquareIcon class="size-4" />
			</button>
		</div>
	</div>
{/if}
