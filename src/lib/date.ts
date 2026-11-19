/** Dates are stored as local "YYYY-MM-DD" keys so a day always means the user's own day. */
export function toKey(d: Date) {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function fromKey(key: string) {
	const [y, m, d] = key.split('-').map(Number);
	return new Date(y, m - 1, d);
}

export function todayKey() {
	return toKey(new Date());
}

export function addDays(key: string, n: number) {
	const d = fromKey(key);
	d.setDate(d.getDate() + n);
	return toKey(d);
}

export function formatDay(key: string, opts: Intl.DateTimeFormatOptions = {}) {
	return new Intl.DateTimeFormat('id-ID', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		...opts
	}).format(fromKey(key));
}

export function formatTime(d: Date) {
	return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(d);
}

/** After 20:00 the app nudges toward recap and planning tomorrow. */
export function isEvening(now = new Date()) {
	return now.getHours() >= 20;
}

export function greeting(now = new Date()) {
	const h = now.getHours();
	if (h < 11) return 'Selamat pagi';
	if (h < 15) return 'Selamat siang';
	if (h < 18) return 'Selamat sore';
	return 'Selamat malam';
}
