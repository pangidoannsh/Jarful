import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { app, db } from '#lib/firebase.js';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const DEVICE_KEY = 'jarful:device';

interface InstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function deviceId() {
	try {
		let id = localStorage.getItem(DEVICE_KEY);
		if (!id) {
			id = crypto.randomUUID();
			localStorage.setItem(DEVICE_KEY, id);
		}
		return id;
	} catch {
		return 'browser';
	}
}

/** Install prompt and evening-reminder subscription for this browser. */
class DeviceStore {
	installEvent = $state<InstallPromptEvent | null>(null);
	installed = $state(false);
	/** Reminder switch for this device, read from Firestore. */
	reminder = $state(false);
	busy = $state(false);

	readonly isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
	readonly pushConfigured = Boolean(VAPID_KEY);

	init() {
		this.installed =
			matchMedia('(display-mode: standalone)').matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone === true;
		addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			this.installEvent = e as InstallPromptEvent;
		});
		addEventListener('appinstalled', () => {
			this.installed = true;
			this.installEvent = null;
		});
	}

	async install() {
		const e = this.installEvent;
		if (!e) return;
		await e.prompt();
		await e.userChoice;
		this.installEvent = null;
	}

	async load(uid: string) {
		try {
			const snap = await getDoc(doc(db, 'users', uid, 'devices', deviceId()));
			this.reminder = Boolean(snap.data()?.reminder) && Notification.permission === 'granted';
		} catch {
			this.reminder = false;
		}
	}

	/** Why reminders cannot work in this browser, or null when they can. */
	async unsupportedReason(): Promise<string | null> {
		if (!VAPID_KEY) return 'Admin belum mengisi VITE_FIREBASE_VAPID_KEY.';
		if (!('serviceWorker' in navigator) || !('Notification' in window)) {
			return 'Browser ini tidak mendukung notifikasi.';
		}
		const { isSupported } = await import('firebase/messaging');
		if (!(await isSupported())) {
			return this.isIos && !this.installed
				? 'Di iPhone, pasang Jarful ke layar utama dulu (Bagikan → Tambah ke Layar Utama), lalu buka dari ikonnya.'
				: 'Browser ini tidak mendukung notifikasi push.';
		}
		return null;
	}

	async enableReminder(uid: string) {
		this.busy = true;
		try {
			const reason = await this.unsupportedReason();
			if (reason) throw new Error(reason);
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				throw new Error('Izin notifikasi ditolak. Aktifkan lewat pengaturan situs di browser.');
			}
			const { getMessaging, getToken } = await import('firebase/messaging');
			const registration = await navigator.serviceWorker.ready;
			const token = await getToken(getMessaging(app), {
				vapidKey: VAPID_KEY,
				serviceWorkerRegistration: registration
			});
			await setDoc(doc(db, 'users', uid, 'devices', deviceId()), {
				token,
				reminder: true,
				userAgent: navigator.userAgent.slice(0, 200),
				timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				updatedAt: serverTimestamp()
			});
			this.reminder = true;
		} finally {
			this.busy = false;
		}
	}

	async disableReminder(uid: string) {
		this.busy = true;
		try {
			await deleteDoc(doc(db, 'users', uid, 'devices', deviceId()));
			this.reminder = false;
		} finally {
			this.busy = false;
		}
	}
}

export const device = new DeviceStore();
