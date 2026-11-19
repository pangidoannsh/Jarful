import { toast } from 'svelte-sonner';
import { addFocusMinutes } from '#lib/stores/todos.svelte.js';
import { haptic, playFanfare, playGolden } from '#lib/feedback.js';

export const FOCUS_MIN = 25;
export const BREAK_MIN = 5;

interface Session {
	uid: string;
	todoId: string;
	title: string;
	phase: 'focus' | 'break';
	/** Epoch ms when the phase ends (while running). */
	endsAt: number;
	/** Ms left when paused; null while running. */
	pausedLeft: number | null;
	/** Total ms of the phase, for the progress ring. */
	total: number;
}

const KEY = 'jarful:focus';

async function notify(title: string, body: string) {
	try {
		if (Notification.permission !== 'granted') return;
		const reg = await navigator.serviceWorker?.ready;
		if (reg) await reg.showNotification(title, { body, icon: '/icons/icon-192.png', tag: 'jarful-focus' });
		else new Notification(title, { body });
	} catch {
		// Notifications are optional here; the toast and sound still fire.
	}
}

/** Pomodoro timer for one todo. Survives page reloads through localStorage. */
class FocusTimer {
	session = $state<Session | null>(null);
	now = $state(Date.now());
	#tick: ReturnType<typeof setInterval> | null = null;

	left = $derived.by(() => {
		const s = this.session;
		if (!s) return 0;
		return s.pausedLeft ?? Math.max(0, s.endsAt - this.now);
	});
	progress = $derived(this.session ? 1 - this.left / this.session.total : 0);
	running = $derived(Boolean(this.session && this.session.pausedLeft === null));

	init() {
		try {
			const raw = localStorage.getItem(KEY);
			if (raw) this.session = JSON.parse(raw);
		} catch {
			this.session = null;
		}
		this.#tick = setInterval(() => this.#onTick(), 1000);
		this.#onTick();
	}

	#save() {
		try {
			if (this.session) localStorage.setItem(KEY, JSON.stringify(this.session));
			else localStorage.removeItem(KEY);
		} catch {
			// The timer still runs for this visit.
		}
	}

	#onTick() {
		this.now = Date.now();
		const s = this.session;
		if (!s || s.pausedLeft !== null || this.now < s.endsAt) return;
		if (s.phase === 'focus') {
			addFocusMinutes(s.uid, s.todoId, Math.round(s.total / 60000));
			playFanfare();
			haptic([20, 60, 20]);
			toast.success(`Sesi fokus ${FOCUS_MIN} menit selesai! Istirahat ${BREAK_MIN} menit dulu.`);
			notify('Sesi fokus selesai', `${s.title}: istirahat ${BREAK_MIN} menit dulu.`);
			this.#begin({ ...s, phase: 'break' }, BREAK_MIN);
		} else {
			playGolden();
			toast('Istirahat selesai. Siap lanjut?', {
				action: { label: 'Fokus lagi', onClick: () => this.start(s.uid, s.todoId, s.title) }
			});
			notify('Istirahat selesai', 'Siap lanjut fokus?');
			this.session = null;
			this.#save();
		}
	}

	#begin(s: Omit<Session, 'endsAt' | 'pausedLeft' | 'total'> & Partial<Session>, minutes: number) {
		const total = minutes * 60000;
		this.session = { ...s, endsAt: Date.now() + total, pausedLeft: null, total } as Session;
		this.now = Date.now();
		this.#save();
	}

	start(uid: string, todoId: string, title: string) {
		if (this.session?.phase === 'focus') this.stop();
		this.#begin({ uid, todoId, title, phase: 'focus' }, FOCUS_MIN);
		try {
			if (Notification.permission === 'default') void Notification.requestPermission();
		} catch {
			// Not supported: the timer works without notifications.
		}
	}

	pause() {
		const s = this.session;
		if (!s || s.pausedLeft !== null) return;
		this.session = { ...s, pausedLeft: Math.max(0, s.endsAt - Date.now()) };
		this.#save();
	}

	resume() {
		const s = this.session;
		if (!s || s.pausedLeft === null) return;
		this.session = { ...s, endsAt: Date.now() + s.pausedLeft, pausedLeft: null };
		this.#save();
	}

	/** Stops early; minutes already spent in a focus phase are still recorded. */
	stop() {
		const s = this.session;
		if (!s) return;
		if (s.phase === 'focus') {
			const spent = Math.floor((s.total - this.left) / 60000);
			if (spent >= 1) {
				addFocusMinutes(s.uid, s.todoId, spent);
				toast(`${spent} menit fokus tercatat`);
			}
		}
		this.session = null;
		this.#save();
	}
}

export const focus = new FocusTimer();
