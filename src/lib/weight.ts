import type { Todo, Weight } from '#lib/types.js';

export const WEIGHTS: { value: Weight; label: string; hint: string }[] = [
	{ value: 1, label: 'Ringan', hint: 'kelereng biasa' },
	{ value: 2, label: 'Sedang', hint: 'kelereng besar · ketik !' },
	{ value: 3, label: 'Berat', hint: 'kelereng paling besar · ketik !!' },
	{ value: 0, label: 'Pengingat', hint: 'tanpa kelereng · ketik ~' }
];

export const weightLabel = (w: Weight) => WEIGHTS.find((x) => x.value === w)?.label ?? 'Ringan';

/** Reminders and notes: ticked off, but never a marble and never counted as productivity. */
export const isReminder = (t: Pick<Todo, 'weight'>) => t.weight === 0;

/** Marbles count as productivity; reminders do not. */
export const counts = (t: Pick<Todo, 'weight'>) => t.weight !== 0;

/** Marble size relative to a light one. */
export const marbleScale = (w: Weight | undefined) => (w === 3 ? 1.5 : w === 2 ? 1.25 : 1);

/** Effort points for stats: ringan 1, sedang 2, berat 3, pengingat 0. */
export const effortPoints = (t: Pick<Todo, 'weight'>) => t.weight;
