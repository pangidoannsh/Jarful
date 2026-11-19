// Creates the first Jarful admin account (username "admin") with a random password.
//
//   npm run seed:admin           create the admin account
//   npm run seed:admin -- --reset  give the existing admin a new random password
//
// Reads FIREBASE_ADMIN_* from .env. The password is printed once and must be changed at first login.
import { randomInt } from 'node:crypto';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const USERNAME = process.env.ADMIN_USERNAME?.trim().toLowerCase() || 'admin';
const EMAIL = `${USERNAME}@jarful.app`;
const reset = process.argv.includes('--reset');

const { FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY } = process.env;
if (!FIREBASE_ADMIN_PROJECT_ID || !FIREBASE_ADMIN_CLIENT_EMAIL || !FIREBASE_ADMIN_PRIVATE_KEY) {
	console.error('Isi FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, dan FIREBASE_ADMIN_PRIVATE_KEY di .env dulu.');
	process.exit(1);
}

initializeApp({
	credential: cert({
		projectId: FIREBASE_ADMIN_PROJECT_ID,
		clientEmail: FIREBASE_ADMIN_CLIENT_EMAIL,
		privateKey: FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
	})
});

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const password = Array.from({ length: 16 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

const auth = getAuth();
const db = getFirestore();

let user = await auth.getUserByEmail(EMAIL).catch(() => null);
if (user && !reset) {
	console.log(`Akun "${USERNAME}" sudah ada. Jalankan "npm run seed:admin -- --reset" untuk membuat password baru.`);
	process.exit(0);
}

if (user) {
	await auth.updateUser(user.uid, { password, disabled: false });
	await auth.revokeRefreshTokens(user.uid);
} else {
	user = await auth.createUser({ email: EMAIL, password, displayName: 'Admin' });
}
await auth.setCustomUserClaims(user.uid, { admin: true, member: true });
await db.doc(`users/${user.uid}`).set(
	{
		username: USERNAME,
		displayName: user.displayName || 'Admin',
		mustChangePassword: true,
		createdAt: FieldValue.serverTimestamp()
	},
	{ merge: true }
);

console.log('\n  Akun admin Jarful siap.\n');
console.log(`  username : ${USERNAME}`);
console.log(`  password : ${password}\n`);
console.log('  Password ini hanya ditampilkan sekali dan wajib diganti saat login pertama.\n');
process.exit(0);
