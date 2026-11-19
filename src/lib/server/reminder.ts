import { adminDb, adminMessaging } from '#lib/server/admin.js';

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

/** Sends the evening reminder to every device that turned it on (optionally one user only). */
export async function sendReminders(onlyUid?: string) {
	const db = adminDb();
	const snap = onlyUid
		? await db.collection(`users/${onlyUid}/devices`).get()
		: await db.collectionGroup('devices').get();

	const byUser = new Map<string, Device[]>();
	for (const d of snap.docs) {
		const data = d.data();
		const uid = d.ref.parent.parent?.id;
		if (!uid || !data.reminder || !data.token) continue;
		const list = byUser.get(uid) ?? [];
		list.push({ uid, ref: d.ref, token: String(data.token) });
		byUser.set(uid, list);
	}

	let sent = 0;
	let removed = 0;
	for (const [uid, devices] of byUser) {
		const msg = await messageFor(uid);
		const res = await adminMessaging().sendEach(
			devices.map((d) => ({
				token: d.token,
				// Data-only, so our own service worker decides how the notification looks.
				data: { ...msg, tag: 'jarful-reminder' },
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
				}
			})
		);
	}
	return { users: byUser.size, sent, removed };
}
