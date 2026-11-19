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
