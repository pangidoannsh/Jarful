/// <reference types="vite/client" />
// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface ImportMetaEnv {
		readonly VITE_FIREBASE_API_KEY: string;
		readonly VITE_FIREBASE_AUTH_DOMAIN: string;
		readonly VITE_FIREBASE_PROJECT_ID: string;
		readonly VITE_FIREBASE_STORAGE_BUCKET: string;
		readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
		readonly VITE_FIREBASE_APP_ID: string;
		/** Web Push key pair from Firebase Console → Cloud Messaging. Optional: reminders stay off without it. */
		readonly VITE_FIREBASE_VAPID_KEY?: string;
	}
}

export {};
