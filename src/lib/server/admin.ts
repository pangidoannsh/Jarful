import { randomInt } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

let app: App | null = null;

/** Firebase Admin, configured from FIREBASE_ADMIN_* server-only environment variables. */
export function adminApp() {
	if (app) return app;
	const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
	const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
	const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
	if (!projectId || !clientEmail || !privateKey) {
		error(500, 'Server belum dikonfigurasi: isi FIREBASE_ADMIN_* di environment variables.');
	}
	app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
	return app;
}

export const adminAuth = () => getAuth(adminApp());
export const adminDb = () => getFirestore(adminApp());
export const adminMessaging = () => getMessaging(adminApp());

/** Verifies the caller's Firebase ID token and that it carries the admin claim. */
export async function requireAdmin(request: Request) {
	const header = request.headers.get('authorization') ?? '';
	const token = header.startsWith('Bearer ') ? header.slice(7) : '';
	if (!token) error(401, 'Belum login');
	try {
		const decoded = await adminAuth().verifyIdToken(token, true);
		if (decoded.admin !== true) error(403, 'Khusus admin');
		return decoded;
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		error(401, 'Sesi tidak valid, silakan login ulang');
	}
}

/** Verifies the caller's Firebase ID token and that it belongs to an account made by an admin. */
export async function requireMember(request: Request) {
	const header = request.headers.get('authorization') ?? '';
	const token = header.startsWith('Bearer ') ? header.slice(7) : '';
	if (!token) error(401, 'Belum login');
	try {
		const decoded = await adminAuth().verifyIdToken(token, true);
		if (decoded.member !== true && decoded.admin !== true) error(403, 'Akun belum diaktifkan');
		return decoded;
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		error(401, 'Sesi tidak valid, silakan login ulang');
	}
}

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Random password without look-alike characters, so it can be read out or retyped. */
export function tempPassword(length = 12) {
	let out = '';
	for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
	return out;
}
