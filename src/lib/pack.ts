/**
 * Drops circles one by one into a jar: each lands at the lowest spot it can reach
 * without overlapping the ones already there. Gives a natural pile of marbles of
 * different sizes. Coordinates: x grows right, y grows down, `bottom` is the floor.
 */
export function dropPack(radii: number[], left: number, width: number, bottom: number, jitter: number[] = []) {
	const placed: { x: number; y: number; r: number }[] = [];
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
		const j = jitter[i] ?? 0;
		placed.push({ x: best!.x + j * 0.4, y: best!.y, r });
	}
	return placed;
}
