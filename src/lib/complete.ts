import { toast } from 'svelte-sonner';
import { jar, resolvedMarbleColor } from '#lib/stores/jar.svelte.js';
import {
	confettiBurst,
	haptic,
	nextCombo,
	playComplete,
	playFanfare,
	playGolden,
	playSoft,
	praise,
	rollGolden
} from '#lib/feedback.js';
import { marbleScale } from '#lib/weight.js';
import { playCelebration } from '#lib/sounds.js';
import type { Weight } from '#lib/types.js';

/**
 * Everything that happens the moment a todo is done: sound, vibration, combo,
 * the lucky gold roll and the marble flying into the jar.
 * Reminders (weight 0) only get a soft tick: they are not productivity.
 */
export function celebrate(opts: { id: string; rect?: DOMRect; color: number; weight: Weight; isFocus?: boolean }) {
	const { id, rect, color, weight } = opts;
	if (weight === 0) {
		playSoft();
		haptic(6);
		return { golden: false };
	}
	const combo = nextCombo();
	const golden = rollGolden();
	playComplete(combo, weight);
	playCelebration(weight, opts.isFocus);
	haptic(golden ? [10, 50, 14] : weight === 3 ? [16, 40, 26] : weight === 2 ? 18 : 12);
	if (golden) {
		playGolden();
		jar.showLabel(praise(), true);
	} else if (weight === 3) {
		jar.showLabel(combo >= 2 ? `Berat! Combo x${combo}` : 'Tugas berat beres!');
	} else if (combo >= 2) {
		jar.showLabel(`Combo x${combo}`);
	}
	if (rect) jar.launch(id, rect, resolvedMarbleColor(color, golden), golden, marbleScale(weight));

	const origin = rect && {
		x: (rect.left + rect.width / 2) / window.innerWidth,
		y: (rect.top + rect.height / 2) / window.innerHeight
	};
	if (opts.isFocus && origin) {
		playFanfare();
		confettiBurst(origin);
		toast.success('Fokus hari ini tuntas!');
	} else if (weight === 3 && origin) {
		confettiBurst(origin, false, 0.45);
	}
	return { golden };
}
