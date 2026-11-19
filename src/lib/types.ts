import type { Timestamp } from 'firebase/firestore';

export type TodoSource = 'planned' | 'logged';

export interface Todo {
	id: string;
	title: string;
	/** Local day key "YYYY-MM-DD" the todo belongs to. */
	date: string;
	done: boolean;
	doneAt: Timestamp | null;
	createdAt: Timestamp;
	source: TodoSource;
	isFocus: boolean;
	order: number;
	/** Marble colour, 1–5. */
	color: number;
	/** A lucky completion: shows as a gold marble. */
	golden?: boolean;
	/** From smart input, e.g. "sehat" for #sehat. */
	tag?: string;
	/** Estimated minutes, e.g. 30 for "30m". */
	estimateMin?: number;
	/** Set when the todo was created by a routine. */
	routineId?: string;
	/** Minutes spent in the focus timer on this todo. */
	focusMin?: number;
	/** Learning note, for #belajar todos (used by Saran Belajar). */
	note?: string;
}

export interface Profile {
	username: string;
	displayName: string;
	mustChangePassword?: boolean;
}

export interface DayNote {
	mood?: number;
	note?: string;
}

export interface AdminUser {
	uid: string;
	username: string;
	displayName: string;
	admin: boolean;
	disabled: boolean;
	createdAt: string | null;
	lastSignIn: string | null;
	mustChangePassword: boolean;
}

export interface LearningTopic {
	name: string;
	/** dikuasai = understood, sedang = in progress, bingung = still confusing */
	status: 'dikuasai' | 'sedang' | 'bingung';
}

export interface LearningDomain {
	name: string;
	topics: LearningTopic[];
}

export interface LearningProfile {
	summary: string;
	domains: LearningDomain[];
	updatedAt: number;
}

export type SaranDistance = 'dekat' | 'sedang' | 'jauh';

export interface SaranItem {
	jarak: SaranDistance;
	judul: string;
	alasan: string;
	terkait: string[];
	estimasiMenit: number;
	langkahPertama: string;
}

export interface SaranDay {
	ranah: string;
	items: SaranItem[];
	ulang?: { topik: string; alasan: string } | null;
	requests: number;
	/** Index → what the user did with that card. */
	feedback?: Record<string, 'added' | 'known' | 'nope'>;
	createdAt: number;
}
