/**
 * Drops circles one by one into a jar: each lands at the lowest spot it can reach
 * without overlapping the ones already there. Gives a natural pile of marbles of
 * different sizes. Coordinates: x grows right, y grows down, `bottom` is the floor.
 *
 * Marbles keep their size. Once the pile reaches `top` the jar is full: a marble that
 * no longer fits is left out (a smaller one later may still slip into a gap), and
 * `i` on each result tells which input it was.
 */
export function dropPack(
	radii: number[],
	left: number,
	width: number,
	bottom: number,
	jitter: number[] = [],
	top = -Infinity
) {
	const placed: { x: number; y: number; r: number; i: number }[] = [];
	let misses = 0;
	for (let i = 0; i < radii.length; i++) {
		const r = radii[i];
		const min = left + r;
		const max = left + width - r;
		let best: { x: number; y: number } | null = null;
		const steps = Math.max(8, Math.ceil((max - min) / 0.75));
		for (let s = 0; s <= steps; s++) {
			const x = min + ((max - min) * s) / steps;
			let y = bottom - r;
			for (const p of placed) {
				const dx = Math.abs(p.x - x);
				const reach = p.r + r;
				if (dx < reach) y = Math.min(y, p.y - Math.sqrt(reach * reach - dx * dx));
			}
			// Lowest wins; on a tie prefer the spot nearer the centre so the pile stays even.
			const centre = Math.abs(x - (left + width / 2));
			if (!best || y > best.y + 0.01 || (Math.abs(y - best.y) <= 0.01 && centre < Math.abs(best.x - (left + width / 2)))) {
				best = { x, y };
			}
		}
		if (best!.y - r < top) {
			// Full here. After a run of misses the jar is simply full: stop looking.
			if (++misses >= 12) break;
			continue;
		}
		misses = 0;
		const j = jitter[i] ?? 0;
		placed.push({ x: best!.x + j * 0.4, y: best!.y, r, i });
	}
	return placed;
}
