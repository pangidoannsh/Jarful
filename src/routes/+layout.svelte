<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import { session } from '#lib/stores/session.svelte.js';
	import { prefs } from '#lib/stores/prefs.svelte.js';
	import { firebaseConfigured } from '#lib/firebase.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	prefs.init();
	session.start();

	$effect(() => {
		void [prefs.sound, prefs.haptic, prefs.strike, prefs.theme];
		prefs.save();
	});

	$effect(() => {
		document.documentElement.classList.toggle('dark', prefs.dark);
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute('content', prefs.dark ? '#1b1f33' : '#fbf7ef');
	});

	const path = $derived(page.url.pathname);
	const isPublic = $derived(path === '/login');

	$effect(() => {
		if (!session.ready || !firebaseConfigured) return;
		if (!session.user && !isPublic) goto('/login', { replace: true });
		else if (session.user && isPublic) goto('/', { replace: true });
		else if (session.user && session.profile?.mustChangePassword && path !== '/ganti-password')
			goto('/ganti-password', { replace: true });
	});

	const canShow = $derived(
		isPublic || (session.user && (session.isMember || path === '/ganti-password'))
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Toaster position="top-center" richColors={false} />

{#if !firebaseConfigured}
	<main class="mx-auto max-w-md px-6 py-20">
		<h1 class="font-display text-3xl font-semibold">Jarful belum terhubung ke Firebase</h1>
		<p class="text-muted-foreground mt-3">
			Isi variabel <code>VITE_FIREBASE_*</code> di file <code>.env</code> (lokal) atau di pengaturan
			Environment Variables Vercel, lalu jalankan ulang. Panduan lengkapnya ada di README.
		</p>
	</main>
{:else if !session.ready}
	<div class="grid min-h-dvh place-items-center">
		<div class="bg-primary/60 size-4 animate-ping rounded-full"></div>
	</div>
{:else if session.user && !session.isMember && !isPublic}
	<main class="mx-auto max-w-md px-6 py-20 text-center">
		<h1 class="font-display text-2xl font-semibold">Akun belum diaktifkan</h1>
		<p class="text-muted-foreground mt-3">
			Akun ini tidak dibuat lewat panel admin, jadi belum punya akses. Hubungi admin Jarful.
		</p>
		<button class="text-primary mt-6 font-medium underline" onclick={() => session.logout()}>
			Keluar
		</button>
	</main>
{:else if canShow}
	{@render children()}
{/if}
