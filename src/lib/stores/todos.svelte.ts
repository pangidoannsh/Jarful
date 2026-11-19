import {
	collection,
	deleteDoc,
	doc,
	getDocs,
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
		golden: Boolean(data.golden)
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
	input: { title: string; date: string; done?: boolean; source?: TodoSource; id?: string; golden?: boolean }
) {
	const id = input.id ?? newTodoId(uid);
	const now = Timestamp.now();
	const todo = {
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
	setDoc(todoDoc(uid, id), todo).catch(fail);
	return { id, ...todo } as Todo;
}

export function setDone(uid: string, id: string, done: boolean, golden = false) {
	updateDoc(todoDoc(uid, id), {
		done,
		doneAt: done ? Timestamp.now() : null,
		golden: done ? golden : false
	}).catch(fail);
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
	deleteDoc(todoDoc(uid, id)).catch(fail);
	toast('Todo dihapus', {
		action: {
			label: 'Urungkan',
			onClick: () => {
				setDoc(todoDoc(uid, id), data).catch(fail);
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

/** Days with at least one completion, counted back from today (or yesterday if today has none yet). */
export async function loadStreak(uid: string, today: string) {
	const q = query(todosCol(uid), where('date', '>=', addDays(today, -120)));
	const snap = await getDocs(q);
	const active = new Set<string>();
	snap.docs.forEach((d) => {
		const data = d.data();
		if (data.done) active.add(String(data.date));
	});
	let day = active.has(today) ? today : addDays(today, -1);
	let streak = 0;
	while (active.has(day)) {
		streak++;
		day = addDays(day, -1);
	}
	return streak;
}
