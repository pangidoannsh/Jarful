<script lang="ts">
	import { bounceOut } from 'svelte/easing';
	import { jar, marbleColor } from '#lib/stores/jar.svelte.js';
	import { cn } from '#lib/utils.js';
	import { marbleScale } from '#lib/weight.js';
	import { dropPack } from '#lib/pack.js';
	import type { Weight } from '#lib/types.js';

	interface Marble {
		id: string;
		color: number;
		golden?: boolean;
		weight?: Weight;
	}

	let {
		marbles,
		register = false,
		full = false,
		class: className = ''
	}: {
		marbles: Marble[];
		/** The jar that flying marbles land in. */
		register?: boolean;
		/** Every planned todo is done: the jar glows. */
		full?: boolean;
		class?: string;
	} = $props();

	let el = $state<HTMLElement | null>(null);
	let wobble = $state(false);

	$effect(() => {
		if (!register || !el) return;
		jar.target = el;
		return () => {
			if (jar.target === el) jar.target = null;
		};
	});

	let lastBumps = jar.bumps;
	$effect(() => {
		const b = jar.bumps;
		if (!register || b === lastBumps) return;
		lastBumps = b;
		wobble = false;
		requestAnimationFrame(() => (wobble = true));
		const t = setTimeout(() => (wobble = false), 600);
		return () => clearTimeout(t);
	});

	const visible = $derived(
		register ? marbles.filter((m) => !jar.inFlight.includes(m.id)) : marbles
	);

	// Pack marbles from the bottom of the jar in staggered rows; shrink them as the jar fills.
	const LEFT = 19;
	const WIDTH = 62;
	const BOTTOM = 113;
	const TOP = 30;
	function radiusFor(n: number) {
		if (n <= 22) return 7;
		if (n <= 40) return 5.4;
		if (n <= 72) return 4.1;
		return 3.2;
	}
	function hash(s: string) {
		let h = 0;
		for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
		return h;
	}
	// Marbles are "dropped" in order and settle on the pile. Heavier todos make bigger
	// marbles, and every marble shrinks as the jar fills up.
	const placed = $derived.by(() => {
		const area = visible.reduce((sum, m) => sum + marbleScale(m.weight) ** 2, 0);
		const base = radiusFor(Math.ceil(area));
		const radii = visible.map((m) => base * marbleScale(m.weight));
		const jitter = visible.map((m) => ((hash(m.id) % 7) / 7 - 0.5) * 0.6);
		return dropPack(radii, LEFT, WIDTH, BOTTOM, jitter)
			.map((p, i) => ({ m: visible[i], ...p }))
			.filter((p) => p.y - p.r >= TOP);
	});

	function drop(_node: Element, { delay = 0 }: { delay?: number } = {}) {
		return {
			delay,
			duration: 650,
			easing: bounceOut,
			css: (t: number) => `transform: translateY(${(1 - t) * -70}px)`
		};
	}
</script>

<div bind:this={el} class={cn('relative select-none', className)}>
	{#if register && jar.label}
		{#key jar.label.id}
			<span
				class={cn(
					'animate-float-up pointer-events-none absolute -top-5 left-1/2 z-10 -translate-x-1/2 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap shadow-sm',
					jar.label.gold ? 'bg-gold text-[oklch(0.3_0.05_80)]' : 'bg-primary text-primary-foreground'
				)}
			>
				{jar.label.text}
			</span>
		{/key}
	{/if}
	<svg
		viewBox="0 0 100 124"
		class={cn('h-full w-full overflow-visible', wobble && 'animate-jar-wobble')}
		style={full ? 'filter: drop-shadow(0 0 10px var(--gold))' : ''}
		role="img"
		aria-label={`Toples berisi ${marbles.length} kelereng`}
	>
		<defs>
			<radialGradient id="marble-shine" cx="0.35" cy="0.3" r="0.6">
				<stop offset="0" stop-color="white" stop-opacity="0.85" />
				<stop offset="0.25" stop-color="white" stop-opacity="0.15" />
				<stop offset="1" stop-color="white" stop-opacity="0" />
			</radialGradient>
			<clipPath id="jar-inside">
				<path d="M18 26 h64 v80 a10 10 0 0 1 -10 10 h-44 a10 10 0 0 1 -10 -10 z" />
			</clipPath>
		</defs>
		<!-- lid -->
		<rect x="26" y="6" width="48" height="10" rx="3" fill="var(--foreground)" opacity="0.85" />
		<rect x="22" y="15" width="56" height="6" rx="2.5" fill="var(--foreground)" opacity="0.65" />
		<!-- glass -->
		<path
			d="M16 24 h68 a2 2 0 0 1 2 2 v80 a12 12 0 0 1 -12 12 h-48 a12 12 0 0 1 -12 -12 v-80 a2 2 0 0 1 2 -2 z"
			fill="var(--jar-glass)"
			stroke="var(--foreground)"
			stroke-opacity="0.55"
			stroke-width="2.4"
		/>
		<g clip-path="url(#jar-inside)">
			{#each placed as p (p.m.id)}
				<g in:drop>
					<circle cx={p.x} cy={p.y} r={p.r} fill={marbleColor(p.m.color, p.m.golden)} />
					<circle cx={p.x} cy={p.y} r={p.r} fill="url(#marble-shine)" />
					{#if p.m.golden}
						<circle
							class="animate-shimmer"
							cx={p.x}
							cy={p.y}
							r={p.r}
							fill="none"
							stroke="white"
							stroke-opacity="0.7"
							stroke-width="0.8"
						/>
					{/if}
				</g>
			{/each}
		</g>
		<!-- glass highlight -->
		<path
			d="M24 34 v58"
			stroke="white"
			stroke-opacity="0.45"
			stroke-width="3"
			stroke-linecap="round"
		/>
	</svg>
</div>
