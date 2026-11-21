import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

export type ReminderFlag = 'reminder' | 'morning';
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
	/** Evening reminder switch for this device, read from Firestore. */
	reminder = $state(false);
	/** Morning digest switch for this device. */
	morning = $state(false);
	/** Whether this browser has a push token saved for the account. */
	registered = $state(false);
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
			const granted = 'Notification' in window && Notification.permission === 'granted';
			this.registered = Boolean(snap.data()?.token) && granted;
			this.reminder = Boolean(snap.data()?.reminder) && granted;
			this.morning = Boolean(snap.data()?.morning) && granted;
		} catch {
			this.reminder = false;
			this.morning = false;
			this.registered = false;
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

	/** Asks permission, registers this browser for push and turns one reminder on. */
	async enable(uid: string, flag: ReminderFlag) {
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
			await setDoc(
				doc(db, 'users', uid, 'devices', deviceId()),
				{
					token,
					[flag]: true,
					userAgent: navigator.userAgent.slice(0, 200),
					timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
					updatedAt: serverTimestamp()
				},
				{ merge: true }
			);
			this[flag] = true;
			this.registered = true;
		} finally {
			this.busy = false;
		}
	}

	/** Turns one reminder off; with both off, this browser is unregistered. */
	async disable(uid: string, flag: ReminderFlag) {
		this.busy = true;
		try {
			const ref = doc(db, 'users', uid, 'devices', deviceId());
			const other: ReminderFlag = flag === 'reminder' ? 'morning' : 'reminder';
			if (this[other]) {
				await setDoc(ref, { [flag]: false, updatedAt: serverTimestamp() }, { merge: true });
			} else {
				await deleteDoc(ref);
				this.registered = false;
			}
			this[flag] = false;
		} finally {
			this.busy = false;
		}
	}

	/** Registers this browser for push without turning any reminder on (used by the admin test). */
	async register(uid: string) {
		this.busy = true;
		try {
			const reason = await this.unsupportedReason();
			if (reason) throw new Error(reason);
			if ((await Notification.requestPermission()) !== 'granted') {
				throw new Error('Izin notifikasi ditolak. Aktifkan lewat pengaturan situs di browser.');
			}
			const { getMessaging, getToken } = await import('firebase/messaging');
			const token = await getToken(getMessaging(app), {
				vapidKey: VAPID_KEY,
				serviceWorkerRegistration: await navigator.serviceWorker.ready
			});
			await setDoc(
				doc(db, 'users', uid, 'devices', deviceId()),
				{ token, userAgent: navigator.userAgent.slice(0, 200), updatedAt: serverTimestamp() },
				{ merge: true }
			);
			this.registered = true;
		} finally {
			this.busy = false;
		}
	}

	/** Shows a notification straight from the service worker: checks display without the server. */
	async localTest() {
		if (!('Notification' in window) || Notification.permission !== 'granted') {
			throw new Error('Izin notifikasi belum diberikan.');
		}
		const reg = await navigator.serviceWorker.ready;
		await reg.showNotification('Tes lokal Jarful', {
			body: 'Kalau ini muncul, perangkat bisa menampilkan notifikasi.',
			icon: '/icons/icon-192.png',
			tag: 'jarful-local-test'
		});
	}
}

export const device = new DeviceStore();
