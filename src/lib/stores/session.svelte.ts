import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { auth, db, firebaseConfigured } from '#lib/firebase.js';
import { emailToUsername } from '#lib/username.js';
import type { Profile } from '#lib/types.js';

class Session {
	user = $state<User | null>(null);
	isAdmin = $state(false);
	isMember = $state(false);
	profile = $state<Profile | null>(null);
	ready = $state(false);

	username = $derived(this.profile?.username ?? emailToUsername(this.user?.email));
	displayName = $derived(this.profile?.displayName || this.username);

	#profileUnsub: Unsubscribe | null = null;
	#started = false;

	start() {
		if (this.#started) return;
		this.#started = true;
		if (!firebaseConfigured) {
			this.ready = true;
			return;
		}
		onAuthStateChanged(auth, async (u) => {
			this.#profileUnsub?.();
			this.#profileUnsub = null;
			this.user = u;
			if (!u) {
				this.isAdmin = false;
				this.isMember = false;
				this.profile = null;
				this.ready = true;
				return;
			}
			try {
				const token = await u.getIdTokenResult();
				this.isAdmin = token.claims.admin === true;
				this.isMember = token.claims.member === true || this.isAdmin;
			} catch {
				this.isAdmin = false;
				this.isMember = false;
			}
			this.#profileUnsub = onSnapshot(
				doc(db, 'users', u.uid),
				(snap) => {
					this.profile = (snap.data() as Profile | undefined) ?? null;
					this.ready = true;
				},
				() => {
					this.ready = true;
				}
			);
		});
	}

	async idToken() {
		if (!this.user) throw new Error('Belum login');
		return this.user.getIdToken();
	}

	async logout() {
		await signOut(auth);
	}
}

export const session = new Session();
