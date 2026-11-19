<script lang="ts">
	import {
		CopyIcon,
		EllipsisIcon,
		KeyRoundIcon,
		ShieldIcon,
		ShieldOffIcon,
		Trash2Icon,
		UserCheckIcon,
		UserPlusIcon,
		UserXIcon,
		RefreshCwIcon
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { session } from '#lib/stores/session.svelte.js';
	import { cn } from '#lib/utils.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import AppNav from '#lib/components/AppNav.svelte';
	import type { AdminUser } from '#lib/types.js';

	$effect(() => {
		if (session.ready && !session.isAdmin) goto('/', { replaceState: true });
	});

	let users = $state<AdminUser[]>([]);
	let loading = $state(true);

	async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
		const token = await session.idToken();
		const res = await fetch(path, {
			...init,
			headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.message ?? 'Permintaan gagal');
		return data as T;
	}

	async function load() {
		loading = true;
		try {
			users = await api<AdminUser[]>('/api/admin/users');
		} catch (e) {
			toast.error((e as Error).message);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (session.isAdmin) load();
	});

	// Create user
	let createOpen = $state(false);
	let newUsername = $state('');
	let newName = $state('');
	let newAdmin = $state(false);
	let creating = $state(false);

	// Shows a one-time password after create or reset
	let secret = $state<{ username: string; password: string; title: string } | null>(null);

	async function createUser(e: SubmitEvent) {
		e.preventDefault();
		creating = true;
		try {
			const r = await api<{ username: string; password: string }>('/api/admin/users', {
				method: 'POST',
				body: JSON.stringify({ username: newUsername, displayName: newName, admin: newAdmin })
			});
			createOpen = false;
			newUsername = newName = '';
			newAdmin = false;
			secret = { ...r, title: 'Pengguna dibuat' };
			load();
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			creating = false;
		}
	}

	async function act(u: AdminUser, action: string) {
		try {
			const r = await api<{ password?: string }>(`/api/admin/users/${u.uid}`, {
				method: 'PATCH',
				body: JSON.stringify({ action })
			});
			if (r.password) secret = { username: u.username, password: r.password, title: 'Password direset' };
			else toast.success('Tersimpan');
			load();
		} catch (err) {
			toast.error((err as Error).message);
		}
	}

	// Delete
	let toDelete = $state<AdminUser | null>(null);
	let confirmText = $state('');
	async function remove() {
		if (!toDelete) return;
		const u = toDelete;
		try {
			await api(`/api/admin/users/${u.uid}`, { method: 'DELETE' });
			toast.success(`@${u.username} dihapus`);
			toDelete = null;
			load();
		} catch (err) {
			toast.error((err as Error).message);
		}
	}

	function copy(text: string) {
		navigator.clipboard?.writeText(text).then(
			() => toast.success('Disalin'),
			() => toast.error('Tidak bisa menyalin, salin manual ya')
		);
	}

	function when(s: string | null) {
		if (!s) return 'belum pernah';
		return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s));
	}
</script>

<div class="mx-auto min-h-dvh max-w-2xl px-4 pt-5 pb-16">
	<header class="flex items-center justify-between">
		<span class="font-display text-lg font-semibold tracking-tight">Jarful</span>
		<AppNav />
	</header>

	<div class="mt-6 flex items-end justify-between gap-4">
		<div>
			<h1 class="font-display text-3xl font-semibold">Panel admin</h1>
			<p class="text-muted-foreground mt-1 text-sm">
				Hanya admin yang bisa membuat akun. Admin tidak bisa melihat isi todo pengguna.
			</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" size="icon" class="rounded-full" aria-label="Muat ulang" onclick={load}>
				<RefreshCwIcon class={cn('size-4', loading && 'animate-spin')} />
			</Button>
			<Button class="rounded-full" onclick={() => (createOpen = true)}>
				<UserPlusIcon class="size-4" /> Tambah
			</Button>
		</div>
	</div>

	<ul class="bg-card ring-border mt-6 divide-y rounded-3xl ring-1">
		{#each users as u (u.uid)}
			<li class={cn('flex items-center gap-3 p-4', u.disabled && 'opacity-60')}>
				<div
					class="bg-primary/15 text-primary grid size-10 shrink-0 place-items-center rounded-full font-semibold uppercase"
				>
					{u.username.slice(0, 1)}
				</div>
				<div class="min-w-0 flex-1">
					<p class="flex flex-wrap items-center gap-1.5 font-medium">
						{u.displayName || u.username}
						{#if u.admin}<Badge>admin</Badge>{/if}
						{#if u.disabled}<Badge variant="destructive">nonaktif</Badge>{/if}
						{#if u.mustChangePassword}<Badge variant="outline">password sementara</Badge>{/if}
					</p>
					<p class="text-muted-foreground truncate text-xs">
						@{u.username} · login terakhir {when(u.lastSignIn)}
					</p>
				</div>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class="hover:bg-muted grid size-9 place-items-center rounded-full"
						aria-label={`Aksi untuk ${u.username}`}
					>
						<EllipsisIcon class="size-4" />
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-56">
						<DropdownMenu.Item onclick={() => act(u, 'reset')}>
							<KeyRoundIcon /> Reset password
						</DropdownMenu.Item>
						{#if u.uid !== session.user?.uid}
							{#if u.disabled}
								<DropdownMenu.Item onclick={() => act(u, 'enable')}>
									<UserCheckIcon /> Aktifkan
								</DropdownMenu.Item>
							{:else}
								<DropdownMenu.Item onclick={() => act(u, 'disable')}>
									<UserXIcon /> Nonaktifkan
								</DropdownMenu.Item>
							{/if}
							{#if u.admin}
								<DropdownMenu.Item onclick={() => act(u, 'removeAdmin')}>
									<ShieldOffIcon /> Cabut hak admin
								</DropdownMenu.Item>
							{:else}
								<DropdownMenu.Item onclick={() => act(u, 'makeAdmin')}>
									<ShieldIcon /> Jadikan admin
								</DropdownMenu.Item>
							{/if}
							<DropdownMenu.Separator />
							<DropdownMenu.Item
								variant="destructive"
								onclick={() => {
									confirmText = '';
									toDelete = u;
								}}
							>
								<Trash2Icon /> Hapus pengguna
							</DropdownMenu.Item>
						{/if}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</li>
		{:else}
			<li class="text-muted-foreground p-8 text-center text-sm">
				{loading ? 'Memuat…' : 'Belum ada pengguna.'}
			</li>
		{/each}
	</ul>
</div>

<Dialog.Root bind:open={createOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Tambah pengguna</Dialog.Title>
			<Dialog.Description>
				Password sementara dibuat otomatis. Pengguna wajib menggantinya saat login pertama.
			</Dialog.Description>
		</Dialog.Header>
		<form onsubmit={createUser} class="space-y-4">
			<div class="space-y-1.5">
				<Label for="nu">Username</Label>
				<Input
					id="nu"
					bind:value={newUsername}
					placeholder="contoh: budi"
					autocapitalize="none"
					spellcheck={false}
					required
				/>
				<p class="text-muted-foreground text-xs">3–24 karakter: huruf kecil, angka, titik, minus, garis bawah.</p>
			</div>
			<div class="space-y-1.5">
				<Label for="nn">Nama tampilan</Label>
				<Input id="nn" bind:value={newName} placeholder="Budi Santoso" />
			</div>
			<label class="flex items-center justify-between gap-4">
				<span class="text-sm">Jadikan admin</span>
				<Switch bind:checked={newAdmin} />
			</label>
			<Dialog.Footer>
				<Button type="submit" disabled={creating}>{creating ? 'Membuat…' : 'Buat akun'}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root open={secret !== null} onOpenChange={(o) => !o && (secret = null)}>
	<Dialog.Content class="sm:max-w-md">
		{#if secret}
			<Dialog.Header>
				<Dialog.Title>{secret.title}</Dialog.Title>
				<Dialog.Description>
					Berikan data ini ke pengguna. Password hanya ditampilkan sekali di sini.
				</Dialog.Description>
			</Dialog.Header>
			<div class="bg-muted space-y-2 rounded-2xl p-4 font-mono text-sm">
				<p>username: <b>{secret.username}</b></p>
				<p class="flex items-center justify-between gap-2">
					<span>password: <b>{secret.password}</b></span>
					<Button size="icon-sm" variant="ghost" aria-label="Salin password" onclick={() => copy(secret!.password)}>
						<CopyIcon />
					</Button>
				</p>
			</div>
			<Dialog.Footer>
				<Button
					variant="outline"
					onclick={() => copy(`Login Jarful\nusername: ${secret!.username}\npassword: ${secret!.password}`)}
				>
					<CopyIcon class="size-4" /> Salin semua
				</Button>
				<Button onclick={() => (secret = null)}>Selesai</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root open={toDelete !== null} onOpenChange={(o) => !o && (toDelete = null)}>
	<AlertDialog.Content>
		{#if toDelete}
			<AlertDialog.Header>
				<AlertDialog.Title>Hapus @{toDelete.username}?</AlertDialog.Title>
				<AlertDialog.Description>
					Akun dan semua todo, rekap, serta catatannya akan dihapus permanen. Ketik
					<b>{toDelete.username}</b> untuk konfirmasi.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<Input bind:value={confirmText} placeholder={toDelete.username} autocapitalize="none" />
			<AlertDialog.Footer>
				<AlertDialog.Cancel>Batal</AlertDialog.Cancel>
				<AlertDialog.Action
					variant="destructive"
					disabled={confirmText.trim().toLowerCase() !== toDelete.username}
					onclick={remove}
				>
					Hapus permanen
				</AlertDialog.Action>
			</AlertDialog.Footer>
		{/if}
	</AlertDialog.Content>
</AlertDialog.Root>
