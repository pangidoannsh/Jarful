import {
	collection,
	deleteDoc,
	doc,
	documentId,
	getDoc,
	getDocs,
	increment,
	onSnapshot,
	query,
	setDoc,
	Timestamp,
	updateDoc,
	where,
	writeBatch,
	type Unsubscribe
} from 'firebase/firestore';
import { toast } from 'svelte-sonner';
import { db } from '#lib/firebase.js';
import { addDays } from '#lib/date.js';
import type { Todo, TodoSource } from '#lib/types.js';

const todosCol = (uid: string) => collection(db, 'users', uid, 'todos');
const todoDoc = (uid: string, id: string) => doc(db, 'users', uid, 'todos', id);
const dayDoc = (uid: string, date: string) => doc(db, 'users', uid, 'days', date);

/** Keeps users/{uid}/days/{date}.doneCount in step, so stats never have to read every todo. */
function bumpDay(batch: ReturnType<typeof writeBatch>, uid: string, date: string, by: number) {
	batch.set(dayDoc(uid, date), { doneCount: increment(by) }, { merge: true });
}

function fromSnap(id: string, data: Record<string, unknown>): Todo {
	return {
		id,
		title: String(data.title ?? ''),
		date: String(data.date ?? ''),
		done: Boolean(data.done),
		doneAt: (data.doneAt as Timestamp | null) ?? null,
		createdAt: (data.createdAt as Timestamp) ?? Timestamp.now(),
		source: (data.source as TodoSource) ?? 'planned',
		isFocus: Boolean(data.isFocus),
		order: Number(data.order ?? 0),
		color: Number(data.color ?? 1),
		golden: Boolean(data.golden),
		tag: data.tag ? String(data.tag) : undefined,
		estimateMin: data.estimateMin ? Number(data.estimateMin) : undefined
	};
}

/** Writes are local-first: the UI updates at once and Firestore syncs in the background. */
function fail(e: unknown) {
	console.error(e);
	toast.error('Gagal menyimpan. Perubahan akan dicoba lagi saat koneksi kembali.');
}

/** Live list of todos for one day. */
export class DayTodos {
	items = $state<Todo[]>([]);
	loaded = $state(false);

	pending = $derived(this.items.filter((t) => !t.done).sort((a, b) => a.order - b.order));
	done = $derived(
		this.items
			.filter((t) => t.done)
			.sort((a, b) => (b.doneAt?.toMillis() ?? 0) - (a.doneAt?.toMillis() ?? 0))
	);
	planned = $derived(this.items.filter((t) => t.source === 'planned'));
	plannedDone = $derived(this.planned.filter((t) => t.done).length);
	focus = $derived(this.items.find((t) => t.isFocus) ?? null);

	#unsub: Unsubscribe | null = null;

	constructor(
		public uid: string,
		public date: string
	) {}

	start() {
		this.#unsub?.();
		const q = query(todosCol(this.uid), where('date', '==', this.date));
		this.#unsub = onSnapshot(
			q,
			(snap) => {
				this.items = snap.docs.map((d) => fromSnap(d.id, d.data()));
				this.loaded = true;
			},
			(e) => {
				console.error(e);
				this.loaded = true;
				toast.error('Tidak bisa memuat todo. Periksa koneksi atau aturan Firestore.');
			}
		);
		return () => this.stop();
	}

	stop() {
		this.#unsub?.();
		this.#unsub = null;
	}
}

export function newTodoId(uid: string) {
	return doc(todosCol(uid)).id;
}

export function addTodo(
	uid: string,
	input: {
		title: string;
		date: string;
		done?: boolean;
		source?: TodoSource;
		id?: string;
		golden?: boolean;
		tag?: string;
		estimateMin?: number;
	}
) {
	const id = input.id ?? newTodoId(uid);
	const now = Timestamp.now();
	const todo: Omit<Todo, 'id'> = {
		title: input.title.trim(),
		date: input.date,
		done: Boolean(input.done),
		doneAt: input.done ? now : null,
		createdAt: now,
		source: input.source ?? 'planned',
		isFocus: false,
		order: Date.now(),
		color: 1 + Math.floor(Math.random() * 5),
		golden: Boolean(input.golden)
	};
	if (input.tag) todo.tag = input.tag;
	if (input.estimateMin) todo.estimateMin = input.estimateMin;
	const batch = writeBatch(db);
	batch.set(todoDoc(uid, id), todo);
	if (todo.done) bumpDay(batch, uid, todo.date, 1);
	batch.commit().catch(fail);
	return { id, ...todo } as Todo;
}

export function setDone(uid: string, todo: Todo, done: boolean, golden = false) {
	if (todo.done === done) return;
	const batch = writeBatch(db);
	batch.update(todoDoc(uid, todo.id), {
		done,
		doneAt: done ? Timestamp.now() : null,
		golden: done ? golden : false
	});
	bumpDay(batch, uid, todo.date, done ? 1 : -1);
	batch.commit().catch(fail);
}

export function renameTodo(uid: string, id: string, title: string) {
	updateDoc(todoDoc(uid, id), { title: title.trim() }).catch(fail);
}

export function moveTodo(uid: string, id: string, date: string) {
	updateDoc(todoDoc(uid, id), { date, isFocus: false, order: Date.now() }).catch(fail);
}

/** Deletes a todo and offers an undo that restores it exactly. */
export function removeTodo(uid: string, todo: Todo) {
	const { id, ...data } = todo;
	const batch = writeBatch(db);
	batch.delete(todoDoc(uid, id));
	if (todo.done) bumpDay(batch, uid, todo.date, -1);
	batch.commit().catch(fail);
	toast('Todo dihapus', {
		action: {
			label: 'Urungkan',
			onClick: () => {
				const undo = writeBatch(db);
				undo.set(todoDoc(uid, id), data);
				if (todo.done) bumpDay(undo, uid, todo.date, 1);
				undo.commit().catch(fail);
			}
		}
	});
}

/** Only one Fokus Utama per day. */
export function setFocus(uid: string, items: Todo[], id: string | null) {
	const batch = writeBatch(db);
	for (const t of items) {
		const want = t.id === id;
		if (t.isFocus !== want) batch.update(todoDoc(uid, t.id), { isFocus: want });
	}
	batch.commit().catch(fail);
}

/** Unfinished todos from the last 7 days before `today`. */
export async function loadCarryOver(uid: string, today: string) {
	const q = query(
		todosCol(uid),
		where('date', '>=', addDays(today, -7)),
		where('date', '<', today)
	);
	const snap = await getDocs(q);
	return snap.docs
		.map((d) => fromSnap(d.id, d.data()))
		.filter((t) => !t.done && t.source === 'planned')
		.sort((a, b) => b.date.localeCompare(a.date) || a.order - b.order);
}

/** doneCount per day key, from `from` up to and including today. */
export async function loadDayCounts(uid: string, from: string) {
	const q = query(collection(db, 'users', uid, 'days'), where(documentId(), '>=', from));
	const snap = await getDocs(q);
	const counts = new Map<string, number>();
	snap.docs.forEach((d) => {
		const n = Number(d.data().doneCount ?? 0);
		if (n > 0) counts.set(d.id, n);
	});
	return counts;
}

/** Consecutive days with at least one completion, ending today (or yesterday if today has none yet). */
export function currentStreak(counts: Map<string, number>, today: string) {
	let day = counts.has(today) ? today : addDays(today, -1);
	let streak = 0;
	while (counts.has(day)) {
		streak++;
		day = addDays(day, -1);
	}
	return streak;
}

export function longestStreak(counts: Map<string, number>) {
	const days = [...counts.keys()].sort();
	let best = 0;
	let run = 0;
	let prev = '';
	for (const d of days) {
		run = prev && addDays(prev, 1) === d ? run + 1 : 1;
		best = Math.max(best, run);
		prev = d;
	}
	return best;
}

export async function loadStreak(uid: string, today: string) {
	return currentStreak(await loadDayCounts(uid, addDays(today, -400)), today);
}

const STATS_VERSION = 1;

/**
 * One-time rebuild of the per-day counts from existing todos (data made before stats existed).
 * Runs once per account; afterwards every completion keeps the counts up to date.
 */
export async function ensureDayCounts(uid: string) {
	const profile = await getDoc(doc(db, 'users', uid));
	if (Number(profile.data()?.statsVersion ?? 0) >= STATS_VERSION) return;
	const snap = await getDocs(query(todosCol(uid), where('done', '==', true)));
	const counts = new Map<string, number>();
	snap.docs.forEach((d) => {
		const date = String(d.data().date);
		counts.set(date, (counts.get(date) ?? 0) + 1);
	});
	const entries = [...counts.entries()];
	for (let i = 0; i < entries.length; i += 400) {
		const batch = writeBatch(db);
		entries.slice(i, i + 400).forEach(([date, n]) => batch.set(dayDoc(uid, date), { doneCount: n }, { merge: true }));
		await batch.commit();
	}
	await setDoc(doc(db, 'users', uid), { statsVersion: STATS_VERSION }, { merge: true });
}
