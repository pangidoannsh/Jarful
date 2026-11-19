import { prefersReducedMotion, playLand } from '#lib/feedback.js';

/** Coordinates the flight of a marble from a checkbox into the jar. */
class JarState {
	/** The jar's element on screen, registered by the Jar component. */
	target = $state<HTMLElement | null>(null);
	/** Todo ids whose marble is still flying; the jar hides them until they land. */
	inFlight = $state<string[]>([]);
	/** Increments on every landing so the jar can wobble. */
	bumps = $state(0);
	/** Floating label above the jar, e.g. "x3" or a gold-marble praise. */
	label = $state<{ id: number; text: string; gold: boolean } | null>(null);

	showLabel(text: string, gold = false) {
		this.label = { id: Date.now(), text, gold };
	}

	launch(id: string, from: DOMRect, color: string, golden: boolean) {
		const target = this.target;
		if (!target || prefersReducedMotion() || typeof document === 'undefined') {
			this.bumps++;
			return;
		}
		const to = target.getBoundingClientRect();
		const size = 18;
		const sx = from.left + from.width / 2 - size / 2;
		const sy = from.top + from.height / 2 - size / 2;
		const ex = to.left + to.width / 2 - size / 2;
		const ey = to.top + to.height * 0.35 - size / 2;
		// Arc: control point above the higher of the two ends.
		const cx = (sx + ex) / 2 + (ex > sx ? -40 : 40);
		const cy = Math.min(sy, ey) - 120;

		const el = document.createElement('div');
		el.setAttribute('aria-hidden', 'true');
		el.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;border-radius:9999px;pointer-events:none;z-index:60;background:radial-gradient(circle at 32% 30%, rgba(255,255,255,.85) 0 18%, transparent 19%), ${color};box-shadow:0 4px 12px -2px ${color};`;
		document.body.appendChild(el);

		const frames: Keyframe[] = [];
		const steps = 16;
		for (let i = 0; i <= steps; i++) {
			const t = i / steps;
			const x = (1 - t) ** 2 * sx + 2 * (1 - t) * t * cx + t ** 2 * ex;
			const y = (1 - t) ** 2 * sy + 2 * (1 - t) * t * cy + t ** 2 * ey;
			const s = t < 0.15 ? 0.6 + t * 4 : 1.2 - t * 0.35;
			frames.push({ transform: `translate(${x}px, ${y}px) scale(${s})`, offset: t });
		}
		this.inFlight = [...this.inFlight, id];
		const anim = el.animate(frames, {
			duration: golden ? 780 : 620,
			easing: 'cubic-bezier(.45,.05,.55,.95)'
		});
		const done = () => {
			el.remove();
			this.inFlight = this.inFlight.filter((x) => x !== id);
			this.bumps++;
			playLand();
		};
		anim.onfinish = done;
		anim.oncancel = done;
	}
}

export const jar = new JarState();

export function marbleColor(n: number, golden?: boolean) {
	if (golden) return 'var(--gold)';
	return `var(--marble-${((n - 1) % 8) + 1})`;
}

/** Same as marbleColor but resolved to a concrete value, for elements outside the SVG. */
export function resolvedMarbleColor(n: number, golden?: boolean) {
	const v = golden ? '--gold' : `--marble-${((n - 1) % 8) + 1}`;
	return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#e8673a';
}
