import { error, json } from '@sveltejs/kit';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb, adminFailure, requireAdmin, tempPassword } from '#lib/server/admin.js';
import { USERNAME_DOMAIN, USERNAME_PATTERN, normalizeUsername, usernameToEmail } from '#lib/username.js';
import type { AdminUser } from '#lib/types.js';
import type { RequestHandler } from './$types';


export const GET: RequestHandler = async ({ request }) => {
	await requireAdmin(request);
	const { users } = await adminAuth()
		.listUsers(1000)
		.catch((e) => adminFailure(e, 'Memuat pengguna'));
	const mine = users.filter((u) => u.email?.endsWith(`@${USERNAME_DOMAIN}`));
	const refs = mine.map((u) => adminDb().doc(`users/${u.uid}`));
	const profiles = refs.length ? await adminDb().getAll(...refs) : [];
	const list: AdminUser[] = mine.map((u, i) => {
		const p = profiles[i]?.data() ?? {};
		return {
			uid: u.uid,
			username: String(p.username ?? u.email!.split('@')[0]),
			displayName: String(p.displayName ?? u.displayName ?? ''),
			admin: u.customClaims?.admin === true,
			disabled: u.disabled,
			createdAt: u.metadata.creationTime ?? null,
			lastSignIn: u.metadata.lastSignInTime ?? null,
			mustChangePassword: Boolean(p.mustChangePassword)
		};
	});
	list.sort((a, b) => Number(b.admin) - Number(a.admin) || a.username.localeCompare(b.username));
	return json(list);
};

export const POST: RequestHandler = async ({ request }) => {
	await requireAdmin(request);
	const body = await request.json().catch(() => ({}));
	const username = normalizeUsername(String(body.username ?? ''));
	const displayName = String(body.displayName ?? '').trim().slice(0, 40) || username;
	const makeAdmin = body.admin === true;
	if (!USERNAME_PATTERN.test(username)) {
		error(400, 'Username 3–24 karakter: huruf kecil, angka, titik, minus, atau garis bawah.');
	}
	const password = tempPassword();
	try {
		const user = await adminAuth().createUser({
			email: usernameToEmail(username),
			password,
			displayName
		});
		await adminAuth().setCustomUserClaims(user.uid, { member: true, admin: makeAdmin });
		await adminDb().doc(`users/${user.uid}`).set({
			username,
			displayName,
			mustChangePassword: true,
			createdAt: FieldValue.serverTimestamp()
		});
		return json({ uid: user.uid, username, password }, { status: 201 });
	} catch (e) {
		const code = (e as { code?: string }).code;
		if (code === 'auth/email-already-exists') error(409, 'Username sudah dipakai.');
		adminFailure(e, 'Membuat akun');
	}
};
