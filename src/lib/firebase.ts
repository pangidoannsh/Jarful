import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
	initializeFirestore,
	persistentLocalCache,
	persistentMultipleTabManager,
	type Firestore
} from 'firebase/firestore';

const config = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID
};

/** True when the VITE_FIREBASE_* variables are filled in. */
export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (firebaseConfigured) {
	app = getApps()[0] ?? initializeApp(config);
	auth = getAuth(app);
	// Offline cache: every change shows instantly and syncs when the network is back.
	db = initializeFirestore(app, {
		localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
	});
}

export { app, auth, db };
