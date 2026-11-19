import { error, json } from '@sveltejs/kit';
import { adminAuth, adminDb, requireAdmin, tempPassword } from '#lib/server/admin.js';
import type { RequestHandler } from './$types';

type Action = 'reset' | 'disable' | 'enable' | 'makeAdmin' | 'removeAdmin';

export const PATCH: RequestHandler = async ({ request, params }) => {
	const me = await requireAdmin(request);
	const { action } = (await request.json().catch(() => ({}))) as { action?: Action };
	const uid = params.uid;
	const self = uid === me.uid;
	const auth = adminAuth();
	const user = await auth.getUser(uid).catch(() => error(404, 'Pengguna tidak ditemukan'));
	const claims = user.customClaims ?? {};

	switch (action) {
		case 'reset': {
			const password = tempPassword();
			await auth.updateUser(uid, { password });
			await auth.revokeRefreshTokens(uid);
			await adminDb().doc(`users/${uid}`).set({ mustChangePassword: true }, { merge: true });
			return json({ password });
		}
		case 'disable':
			if (self) error(400, 'Tidak bisa menonaktifkan akunmu sendiri.');
			await auth.updateUser(uid, { disabled: true });
			await auth.revokeRefreshTokens(uid);
			return json({ ok: true });
		case 'enable':
			await auth.updateUser(uid, { disabled: false });
			return json({ ok: true });
		case 'makeAdmin':
			await auth.setCustomUserClaims(uid, { ...claims, member: true, admin: true });
			return json({ ok: true });
		case 'removeAdmin':
			if (self) error(400, 'Tidak bisa mencabut hak admin dari akunmu sendiri.');
			await auth.setCustomUserClaims(uid, { ...claims, admin: false });
			return json({ ok: true });
		default:
			error(400, 'Aksi tidak dikenal');
	}
};

/** Deletes the account and every document under users/{uid}. */
export const DELETE: RequestHandler = async ({ request, params }) => {
	const me = await requireAdmin(request);
	if (params.uid === me.uid) error(400, 'Tidak bisa menghapus akunmu sendiri.');
	await adminDb().recursiveDelete(adminDb().doc(`users/${params.uid}`));
	await adminAuth()
		.deleteUser(params.uid)
		.catch((e) => {
			if ((e as { code?: string }).code !== 'auth/user-not-found') throw e;
		});
	return json({ ok: true });
};
