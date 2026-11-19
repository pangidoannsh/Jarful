<script lang="ts">
	import { signInWithEmailAndPassword } from 'firebase/auth';
	import { FirebaseError } from 'firebase/app';
	import { auth } from '#lib/firebase.js';
	import { normalizeUsername, usernameToEmail } from '#lib/username.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import Jar from '#lib/components/Jar.svelte';

	let username = $state('');
	let password = $state('');
	let error = $state('');
	let busy = $state(false);

	const demo = [
		{ id: 'a', color: 1 },
		{ id: 'b', color: 2 },
		{ id: 'c', color: 3 },
		{ id: 'd', color: 1, golden: true },
		{ id: 'e', color: 4 },
		{ id: 'f', color: 2 },
		{ id: 'g', color: 5 }
	];

	function message(e: unknown) {
		const code = e instanceof FirebaseError ? e.code : '';
		switch (code) {
			case 'auth/invalid-credential':
			case 'auth/wrong-password':
			case 'auth/user-not-found':
			case 'auth/invalid-email':
				return 'Username atau password salah.';
			case 'auth/user-disabled':
				return 'Akun ini sedang dinonaktifkan admin.';
			case 'auth/too-many-requests':
				return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
			case 'auth/network-request-failed':
				return 'Tidak ada koneksi internet.';
			default:
				return 'Gagal masuk. Coba lagi.';
		}
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		if (!username.trim() || !password) return;
		busy = true;
		try {
			await signInWithEmailAndPassword(auth, usernameToEmail(normalizeUsername(username)), password);
		} catch (err) {
			error = message(err);
		} finally {
			busy = false;
		}
	}
</script>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
	<div class="mb-8 flex items-end gap-4">
		<Jar marbles={demo} class="h-24 w-20" />
		<div>
			<h1 class="font-display text-4xl font-semibold tracking-tight">Jarful</h1>
			<p class="text-muted-foreground mt-1 text-sm">Isi toplesmu, satu tugas setiap kali.</p>
		</div>
	</div>

	<form onsubmit={submit} class="bg-card ring-border space-y-4 rounded-3xl p-6 shadow-sm ring-1">
		<div class="space-y-1.5">
			<Label for="username">Username</Label>
			<Input
				id="username"
				bind:value={username}
				autocomplete="username"
				autocapitalize="none"
				spellcheck={false}
				class="h-11"
			/>
		</div>
		<div class="space-y-1.5">
			<Label for="password">Password</Label>
			<Input
				id="password"
				type="password"
				bind:value={password}
				autocomplete="current-password"
				class="h-11"
			/>
		</div>
		{#if error}
			<p class="text-destructive text-sm" role="alert">{error}</p>
		{/if}
		<Button type="submit" class="h-11 w-full rounded-xl text-base" disabled={busy}>
			{busy ? 'Masuk…' : 'Masuk'}
		</Button>
		<p class="text-muted-foreground text-center text-xs">
			Belum punya akun? Minta admin untuk membuatkannya.
		</p>
	</form>
</main>
