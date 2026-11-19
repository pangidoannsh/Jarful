import { addDays, fromKey } from '#lib/date.js';

export interface SmartToken {
	kind: 'date' | 'duration' | 'tag';
	label: string;
}

export interface SmartParse {
	title: string;
	date?: string;
	tag?: string;
	estimateMin?: number;
	tokens: SmartToken[];
}

const DAYS: Record<string, number> = {
	minggu: 0,
	senin: 1,
	selasa: 2,
	rabu: 3,
	kamis: 4,
	jumat: 5,
	"jum'at": 5,
	sabtu: 6
};

const DAY_LABEL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function formatMinutes(min: number) {
	if (min < 60) return `${min} mnt`;
	const h = Math.floor(min / 60);
	const m = min % 60;
	return m ? `${h} j ${m} mnt` : `${h} jam`;
}

/**
 * Reads quick shorthand from a todo title:
 *   "olahraga 30m #sehat besok" → title "olahraga", 30 minutes, tag "sehat", tomorrow.
 * Dates: hari ini, besok, lusa, or a weekday name (the next one after today).
 * Durations: 30m, 45 menit, 1j, 1.5 jam, 2h.
 */
export function parseSmart(text: string, today: string): SmartParse {
	let rest = ` ${text} `;
	const tokens: SmartToken[] = [];
	const out: SmartParse = { title: text.trim(), tokens };

	const tag = rest.match(/\s#([\p{L}\p{N}_-]{1,24})(?=\s)/u);
	if (tag) {
		out.tag = tag[1].toLowerCase();
		tokens.push({ kind: 'tag', label: `#${out.tag}` });
		rest = rest.replace(tag[0], ' ');
	}

	const dur = rest.match(/\s(\d+(?:[.,]\d+)?)\s?(m|mnt|menit|j|jam|h)(?=\s)/i);
	if (dur) {
		const n = parseFloat(dur[1].replace(',', '.'));
		const unit = dur[2].toLowerCase();
		const min = Math.round(unit === 'j' || unit === 'jam' || unit === 'h' ? n * 60 : n);
		if (min > 0 && min <= 24 * 60) {
			out.estimateMin = min;
			tokens.push({ kind: 'duration', label: formatMinutes(min) });
			rest = rest.replace(dur[0], ' ');
		}
	}

	const rel = rest.match(/\s(hari ini|besok|lusa)(?=\s)/i);
	if (rel) {
		const word = rel[1].toLowerCase();
		out.date = word === 'besok' ? addDays(today, 1) : word === 'lusa' ? addDays(today, 2) : today;
		tokens.push({ kind: 'date', label: word === 'hari ini' ? 'Hari ini' : word === 'besok' ? 'Besok' : 'Lusa' });
		rest = rest.replace(rel[0], ' ');
	} else {
		// "minggu ini / depan / lalu" means "week", not Sunday.
		const day = rest.match(/\s(senin|selasa|rabu|kamis|jum'?at|sabtu|minggu)(?!\s+(?:ini|depan|lalu))(?=\s)/i);
		if (day) {
			const target = DAYS[day[1].toLowerCase()];
			const now = fromKey(today).getDay();
			const ahead = ((target - now + 7) % 7) || 7;
			out.date = addDays(today, ahead);
			tokens.push({ kind: 'date', label: DAY_LABEL[target] });
			rest = rest.replace(day[0], ' ');
		}
	}

	const title = rest.replace(/\s+/g, ' ').trim();
	out.title = title || text.trim();
	return out;
}
