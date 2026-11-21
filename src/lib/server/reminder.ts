import { adminDb, adminMessaging } from '#lib/server/admin.js';
import { isScheduled } from '#lib/schedule.js';

/** Reminders follow Indonesian Western Time (WIB), matching the 21:00 schedule. */
export const REMINDER_TZ = 'Asia/Jakarta';

export function dayKeyIn(timeZone: string, offsetDays = 0) {
	const d = new Date(Date.now() + offsetDays * 864e5);
	// en-CA formats as YYYY-MM-DD.
	return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

interface Device {
	uid: string;
	ref: FirebaseFirestore.DocumentReference;
	token: string;
}

export type NotifyKind = 'evening' | 'morning';

interface Message {
	title: string;
	body: string;
	url: string;
}

/**
 * Morning digest for today:
 * - every reminder (~), including reminders from routines, so a daily routine reminder
 *   such as "Minum creatine ~" is announced every morning;
 * - todos the user gave a date to (typed like "25/11" or picked with the calendar).
 * Plain todos and non-reminder routines are left out. Null when there is nothing to say.
 */
async function morningMessage(uid: string): Promise<Message | null> {
	const db = adminDb();
	const today = dayKeyIn(REMINDER_TZ);
	const [todoSnap, routineSnap, daySnap] = await Promise.all([
		db.collection(`users/${uid}/todos`).where('date', '==', today).get(),
		db.collection(`users/${uid}/routines`).where('active', '==', true).get(),
		db.doc(`users/${uid}/days/${today}`).get()
	]);
	const todos = todoSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown> & { id: string });
	const items = todos
		.filter((t) => !t.done && (t.weight === 0 || t.scheduled === true))
		.sort(
			(a, b) =>
				Number(Boolean(b.isFocus)) - Number(Boolean(a.isFocus)) ||
				Number(b.weight === 0) - Number(a.weight === 0) ||
				Number(a.order ?? 0) - Number(b.order ?? 0)
		)
		.map((t) => ({ title: String(t.title), reminder: t.weight === 0 }));

	// Routine reminders whose todo has not been created yet (the app was not opened today).
	const existing = new Set(todos.map((t) => t.id));
	const skipped = new Set<string>((daySnap.data()?.skippedRoutines as string[] | undefined) ?? []);
	for (const r of routineSnap.docs) {
		const data = r.data();
		if (data.weight !== 0 || skipped.has(r.id) || existing.has(`rt-${r.id}-${today}`)) continue;
		if (!isScheduled({ days: data.days, monthDays: data.monthDays }, today)) continue;
		items.push({ title: String(data.title), reminder: true });
	}

	if (!items.length) return null;
	const names = items.slice(0, 4).map((t) => t.title);
	const more = items.length - names.length;
	const reminders = items.filter((t) => t.reminder).length;
	return {
		title:
			items.length === 1
				? `Hari ini: ${names[0]}`
				: `Hari ini: ${items.length} hal${reminders ? ` (${reminders} pengingat)` : ''}`,
		body:
			items.length === 1
				? 'Pengingat untuk hari ini dari Jarful.'
				: `${names.join(' · ')}${more > 0 ? ` +${more} lainnya` : ''}`,
		url: '/'
	};
}

async function messageFor(uid: string) {
	const db = adminDb();
	const today = dayKeyIn(REMINDER_TZ);
	const tomorrow = dayKeyIn(REMINDER_TZ, 1);
	const [day, planned] = await Promise.all([
		db.doc(`users/${uid}/days/${today}`).get(),
		db.collection(`users/${uid}/todos`).where('date', '==', tomorrow).count().get()
	]);
	const done = Number(day.data()?.doneCount ?? 0);
	const plannedTomorrow = planned.data().count;

	if (plannedTomorrow > 0) {
		return {
			title: `Rencana besok sudah siap: ${plannedTomorrow} hal`,
			body: done
				? `Hari ini ${done} kelereng masuk toples. Lihat rekapnya, lalu istirahat.`
				: 'Lihat rekap hari ini, lalu istirahat. Besok sudah terarah.',
			url: '/rekap'
		};
	}
	return {
		title: 'Rencanakan besok?',
		body: done
			? `Hari ini ${done} kelereng masuk toples. Tulis 3 hal untuk besok sebelum tidur.`
			: 'Toples hari ini masih kosong, tidak apa-apa. Rencanakan besok supaya lebih terarah.',
		url: '/besok'
	};
}

/**
 * Sends a reminder to every device that turned that kind on (optionally one user only).
 * With `test`, it goes to all of that user's registered devices, and a morning test with
 * nothing scheduled still sends a sample so the delivery can be checked.
 */
export async function sendNotifications(kind: NotifyKind, onlyUid?: string, test = false) {
	const db = adminDb();
	const flag = kind === 'morning' ? 'morning' : 'reminder';
	const snap = onlyUid
		? await db.collection(`users/${onlyUid}/devices`).get()
		: await db.collectionGroup('devices').get();

	const byUser = new Map<string, Device[]>();
	let flagOff = 0;
	for (const d of snap.docs) {
		const data = d.data();
		const uid = d.ref.parent.parent?.id;
		if (!uid || !data.token) continue;
		if (!test && !data[flag]) {
			flagOff++;
			continue;
		}
		const list = byUser.get(uid) ?? [];
		list.push({ uid, ref: d.ref, token: String(data.token) });
		byUser.set(uid, list);
	}

	let sent = 0;
	let removed = 0;
	let skipped = 0;
	const errors: string[] = [];
	for (const [uid, devices] of byUser) {
		let msg: Message | null = kind === 'morning' ? await morningMessage(uid) : await messageFor(uid);
		if (!msg && test) {
			msg = {
				title: 'Tes pengingat pagi',
				body: 'Tidak ada yang kamu jadwalkan untuk hari ini. Notifikasi sudah berfungsi.',
				url: '/'
			};
		}
		if (!msg) {
			skipped++;
			continue;
		}
		const res = await adminMessaging().sendEach(
			devices.map((d) => ({
				token: d.token,
				// Data-only, so our own service worker decides how the notification looks.
				data: { ...msg, tag: `jarful-${kind}` },
				webpush: { headers: { Urgency: 'high', TTL: String(3 * 3600) } }
			}))
		);
		await Promise.all(
			res.responses.map(async (r, i) => {
				if (r.success) return sent++;
				const code = r.error?.code ?? '';
				if (
					code === 'messaging/registration-token-not-registered' ||
					code === 'messaging/invalid-registration-token' ||
					code === 'messaging/invalid-argument'
				) {
					removed++;
					await devices[i].ref.delete();
				} else {
					console.error('[reminder]', uid, code, r.error?.message);
					errors.push(code || r.error?.message || 'unknown');
				}
			})
		);
	}
	// devicesTotal / flagOff / skipped (nothing to say that day) explain a run with sent = 0.
	return { users: byUser.size, devicesTotal: snap.size, flagOff, sent, removed, skipped, errors };
}

/** The evening reminder (kept for the existing cron route). */
export const sendReminders = (onlyUid?: string) => sendNotifications('evening', onlyUid);
