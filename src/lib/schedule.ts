/** Shared by the app and the server: whether a routine appears on a date ("YYYY-MM-DD"). */
export function isScheduled(r: { days?: number[]; monthDays?: number[] }, date: string) {
	const [y, m, day] = date.split('-').map(Number);
	const d = new Date(y, m - 1, day);
	if (r.monthDays?.length) {
		const last = new Date(y, m, 0).getDate();
		// A monthly date past the end of a short month falls on that month's last day.
		return r.monthDays.some((md) => md === day || (md > last && day === last));
	}
	return (r.days ?? []).includes(d.getDay());
}
