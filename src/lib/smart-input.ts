import { addDays, fromKey, toKey } from '#lib/date.js';

import type { Weight } from '#lib/types.js';

export interface SmartToken {
	kind: 'date' | 'duration' | 'tag' | 'weight';
	label: string;
}

export interface SmartParse {
	title: string;
	date?: string;
	tag?: string;
	estimateMin?: number;
	weight?: Weight;
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

const MONTHS: Record<string, number> = {
	jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4, mei: 5,
	jun: 6, juni: 6, jul: 7, juli: 7, agu: 8, agt: 8, ags: 8, agustus: 8, sep: 9, sept: 9,
	september: 9, okt: 10, oktober: 10, nov: 11, november: 11, des: 12, desember: 12
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

function keyOf(y: number, m: number, d: number) {
	const dt = new Date(y, m - 1, d);
	if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
	return toKey(dt);
}

/** A day/month without a year means its next occurrence (this year, or next if it has passed). */
function nextOccurrence(day: number, month: number, today: string, year?: number) {
	if (year) return keyOf(year < 100 ? 2000 + year : year, month, day);
	const y = fromKey(today).getFullYear();
	const key = keyOf(y, month, day);
	return key && key >= today ? key : keyOf(y + 1, month, day);
}

/** "tgl 15": the next 15th, today included. Months without that day are skipped. */
function nextMonthDay(day: number, today: string) {
	const t = fromKey(today);
	for (let i = 0; i < 13; i++) {
		const m = new Date(t.getFullYear(), t.getMonth() + i, 1);
		const key = keyOf(m.getFullYear(), m.getMonth() + 1, day);
		if (key && key >= today) return key;
	}
	return null;
}

export function shortDateLabel(key: string, today: string) {
	if (key === today) return 'Hari ini';
	if (key === addDays(today, 1)) return 'Besok';
	if (key === addDays(today, 2)) return 'Lusa';
	const d = fromKey(key);
	const sameYear = d.getFullYear() === fromKey(today).getFullYear();
	return new Intl.DateTimeFormat('id-ID', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		...(sameYear ? {} : { year: 'numeric' })
	}).format(d);
}

/**
 * Finds a date in the text. Understands: hari ini, besok, lusa, a weekday name,
 * 25/12 or 25-12(-2027), 25 des / 25 desember (2027), tgl 15, 10 hari lagi, minggu depan.
 */
function parseDate(rest: string, today: string): { key: string; label: string; match: string } | null {
	const hit = (key: string | null, match: string) => (key ? { key, label: shortDateLabel(key, today), match } : null);

	const rel = rest.match(/\s(hari ini|besok|lusa)(?=\s)/i);
	if (rel) {
		const w = rel[1].toLowerCase();
		return hit(w === 'besok' ? addDays(today, 1) : w === 'lusa' ? addDays(today, 2) : today, rel[0]);
	}

	const inDays = rest.match(/\s(\d{1,3})\s+hari\s+lagi(?=\s)/i);
	if (inDays) return hit(addDays(today, Number(inDays[1])), inDays[0]);

	const nextWeek = rest.match(/\s(minggu|pekan)\s+depan(?=\s)/i);
	if (nextWeek) return hit(addDays(today, 7), nextWeek[0]);

	const numeric = rest.match(/\s(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?(?=\s)/);
	if (numeric) {
		return hit(nextOccurrence(Number(numeric[1]), Number(numeric[2]), today, numeric[3] ? Number(numeric[3]) : undefined), numeric[0]);
	}

	const named = rest.match(new RegExp(`\\s(\\d{1,2})\\s*(${MONTH_RE})(?:\\s+(\\d{4}))?(?=\\s)`, 'i'));
	if (named) {
		return hit(nextOccurrence(Number(named[1]), MONTHS[named[2].toLowerCase()], today, named[3] ? Number(named[3]) : undefined), named[0]);
	}

	const monthDay = rest.match(/\s(?:tgl\.?|tanggal)\s*(\d{1,2})(?=\s)/i);
	if (monthDay) return hit(nextMonthDay(Number(monthDay[1]), today), monthDay[0]);

	// "minggu ini / depan / lalu" means "week", not Sunday.
	const day = rest.match(/\s(senin|selasa|rabu|kamis|jum'?at|sabtu|minggu)(?!\s+(?:ini|depan|lalu))(?=\s)/i);
	if (day) {
		const target = DAYS[day[1].toLowerCase()];
		const ahead = ((target - fromKey(today).getDay() + 7) % 7) || 7;
		return hit(addDays(today, ahead), day[0]);
	}
	return null;
}

export function formatMinutes(min: number) {
	if (min < 60) return `${min} mnt`;
	const h = Math.floor(min / 60);
	const m = min % 60;
	return m ? `${h} j ${m} mnt` : `${h} jam`;
}

/**
 * Reads quick shorthand from a todo title:
 *   "olahraga 30m #sehat besok" → title "olahraga", 30 minutes, tag "sehat", tomorrow.
 * Dates: hari ini, besok, lusa, a weekday, 25/12, 25 des, tgl 15, 10 hari lagi, minggu depan.
 * Durations: 30m, 45 menit, 1j, 1.5 jam, 2h.
 * Weight: ! = sedang, !! = berat, ~ = pengingat (no marble, not counted).
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

	const weight = rest.match(/\s(!!|!|~)(?=\s)/);
	if (weight) {
		out.weight = weight[1] === '!!' ? 3 : weight[1] === '!' ? 2 : 0;
		tokens.push({ kind: 'weight', label: weight[1] === '!!' ? 'Berat' : weight[1] === '!' ? 'Sedang' : 'Pengingat' });
		rest = rest.replace(weight[0], ' ');
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

	const date = parseDate(rest, today);
	if (date) {
		out.date = date.key;
		tokens.push({ kind: 'date', label: date.label });
		rest = rest.replace(date.match, ' ');
	}

	const title = rest.replace(/\s+/g, ' ').trim();
	out.title = title || text.trim();
	return out;
}

/** Writes a todo back as editable text, so its tag, duration and weight can be changed by typing. */
export function toEditableText(t: { title: string; tag?: string; estimateMin?: number; weight?: Weight }) {
	const parts = [t.title];
	if (t.tag) parts.push(`#${t.tag}`);
	if (t.estimateMin) {
		const m = t.estimateMin;
		parts.push(m % 60 === 0 ? `${m / 60}j` : m > 60 ? `${(m / 60).toFixed(1).replace(/\.0$/, '')}j` : `${m}m`);
	}
	if (t.weight === 0) parts.push('~');
	else if (t.weight === 2) parts.push('!');
	else if (t.weight === 3) parts.push('!!');
	return parts.join(' ');
}
