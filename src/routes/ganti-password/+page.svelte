<script lang="ts">
	import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
	import { FirebaseError } from 'firebase/app';
	import { doc, updateDoc } from 'firebase/firestore';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { db } from '#lib/firebase.js';
	import { session } from '#lib/stores/session.svelte.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	let current = $state('');
	let next = $state('');
	let confirm = $state('');
	let error = $state('');
	let busy = $state(false);

	const forced = $derived(Boolean(session.profile?.mustChangePassword));

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		if (next.length < 8) return (error = 'Password baru minimal 8 karakter.');
		if (next !== confirm) return (error = 'Konfirmasi password tidak sama.');
		if (next === current) return (error = 'Password baru harus berbeda dari yang lama.');
		const user = session.user;
		if (!user?.email) return;
		busy = true;
		try {
			await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
			await updatePassword(user, next);
			await updateDoc(doc(db, 'users', user.uid), { mustChangePassword: false });
			toast.success('Password berhasil diganti');
			goto('/', { replace: true });
		} catch (err) {
			const code = err instanceof FirebaseError ? err.code : '';
			error =
				code === 'auth/invalid-credential' || code === 'auth/wrong-password'
					? 'Password saat ini salah.'
					: code === 'auth/weak-password'
						? 'Password terlalu lemah.'
						: 'Gagal mengganti password. Coba lagi.';
		} finally {
			busy = false;
		}
	}
</script>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
	<h1 class="font-display text-3xl font-semibold">Ganti password</h1>
	<p class="text-muted-foreground mt-2 text-sm">
		{forced
			? 'Ini login pertamamu. Ganti password sementara dari admin dengan password milikmu sendiri.'
			: 'Masukkan password saat ini, lalu password baru.'}
	</p>
	<form onsubmit={submit} class="bg-card ring-border mt-6 space-y-4 rounded-3xl p-6 ring-1">
		<div class="space-y-1.5">
			<Label for="current">Password saat ini</Label>
			<Input id="current" type="password" bind:value={current} autocomplete="current-password" class="h-11" />
		</div>
		<div class="space-y-1.5">
			<Label for="next">Password baru (min. 8 karakter)</Label>
			<Input id="next" type="password" bind:value={next} autocomplete="new-password" class="h-11" />
		</div>
		<div class="space-y-1.5">
			<Label for="confirm">Ulangi password baru</Label>
			<Input id="confirm" type="password" bind:value={confirm} autocomplete="new-password" class="h-11" />
		</div>
		{#if error}<p class="text-destructive text-sm" role="alert">{error}</p>{/if}
		<Button type="submit" class="h-11 w-full rounded-xl" disabled={busy}>
			{busy ? 'Menyimpan…' : 'Simpan password'}
		</Button>
		{#if forced}
			<button type="button" class="text-muted-foreground w-full text-xs underline" onclick={() => session.logout()}>
				Keluar
			</button>
		{:else}
			<a href="/pengaturan" class="text-muted-foreground block text-center text-xs underline">Batal</a>
		{/if}
	</form>
</main>
