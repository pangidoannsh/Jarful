import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	onSnapshot,
	query,
	setDoc,
	Timestamp,
	updateDoc,
	where,
	type Unsubscribe
} from 'firebase/firestore';
import { toast } from 'svelte-sonner';
import { db } from '#lib/firebase.js';
import { fromKey } from '#lib/date.js';
import { tagColor } from '#lib/tags.js';
import type { Weight } from '#lib/types.js';

export interface Routine {
	id: string;
	title: string;
	/** Weekdays it appears on, 0 = Minggu … 6 = Sabtu. */
	days: number[];
	tag?: string;
	estimateMin?: number;
	weight?: Weight;
	active: boolean;
}

export const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
/** Display order, Monday first. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const col = (uid: string) => collection(db, 'users', uid, 'routines');

function fromData(id: string, d: Record<string, unknown>): Routine {
	return {
		id,
		title: String(d.title ?? ''),
		days: Array.isArray(d.days) ? (d.days as number[]) : [],
		tag: d.tag ? String(d.tag) : undefined,
		estimateMin: d.estimateMin ? Number(d.estimateMin) : undefined,
		weight: d.weight === undefined ? undefined : (Number(d.weight) as Weight),
		active: d.active !== false
	};
}

export class RoutineList {
	items = $state<Routine[]>([]);
	loaded = $state(false);
	#unsub: Unsubscribe | null = null;
	constructor(public uid: string) {}
	start() {
		this.#unsub = onSnapshot(col(this.uid), (snap) => {
			this.items = snap.docs
				.map((d) => fromData(d.id, d.data()))
				.sort((a, b) => a.title.localeCompare(b.title));
			this.loaded = true;
		});
		return () => this.#unsub?.();
	}
}

export function describeDays(days: number[]) {
	const s = [...days].sort();
	if (s.length === 7) return 'Setiap hari';
	if (s.join() === '1,2,3,4,5') return 'Hari kerja';
	if (s.join() === '0,6') return 'Akhir pekan';
	return WEEK_ORDER.filter((d) => s.includes(d))
		.map((d) => WEEKDAYS[d])
		.join(', ');
}

export async function saveRoutine(uid: string, r: Omit<Routine, 'id'>, id?: string) {
	const ref = id ? doc(col(uid), id) : doc(col(uid));
	const data: Record<string, unknown> = { title: r.title, days: r.days, active: r.active };
	if (r.tag) data.tag = r.tag;
	if (r.estimateMin) data.estimateMin = r.estimateMin;
	if (r.weight !== undefined) data.weight = r.weight;
	await setDoc(ref, { ...data, updatedAt: Timestamp.now() });
}

export function setRoutineActive(uid: string, id: string, active: boolean) {
	updateDoc(doc(col(uid), id), { active }).catch(() => toast.error('Gagal menyimpan'));
}

export function deleteRoutine(uid: string, id: string) {
	deleteDoc(doc(col(uid), id)).catch(() => toast.error('Gagal menghapus'));
}

export const routineTodoId = (routineId: string, date: string) => `rt-${routineId}-${date}`;

const ensured = new Set<string>();

/**
 * Creates the day's todos for active routines, once per day per session.
 * Each has a fixed id, so it is never doubled, and a deleted one is remembered as skipped.
 */
export async function ensureRoutineTodos(uid: string, date: string, force = false) {
	const key = `${uid}:${date}`;
	if (ensured.has(key) && !force) return;
	ensured.add(key);
	try {
		const weekday = fromKey(date).getDay();
		const [routines, day] = await Promise.all([
			getDocs(query(col(uid), where('active', '==', true))),
			getDoc(doc(db, 'users', uid, 'days', date))
		]);
		const skipped = new Set<string>((day.data()?.skippedRoutines as string[] | undefined) ?? []);
		for (const snap of routines.docs) {
			const r = fromData(snap.id, snap.data());
			if (!r.days.includes(weekday) || skipped.has(r.id)) continue;
			const ref = doc(db, 'users', uid, 'todos', routineTodoId(r.id, date));
			if ((await getDoc(ref)).exists()) continue;
			const now = Timestamp.now();
			const todo: Record<string, unknown> = {
				title: r.title,
				date,
				done: false,
				doneAt: null,
				createdAt: now,
				source: 'planned',
				isFocus: false,
				order: 0,
				color: r.tag ? tagColor(r.tag) : 1 + Math.floor(Math.random() * 5),
				golden: false,
				weight: r.weight ?? 1,
				routineId: r.id
			};
			if (r.tag) todo.tag = r.tag;
			if (r.estimateMin) todo.estimateMin = r.estimateMin;
			await setDoc(ref, todo);
		}
	} catch (e) {
		ensured.delete(key);
		console.error('[jarful] routines', e);
	}
}
