<script lang="ts">
	import { BellRingIcon, DownloadIcon, RepeatIcon, KeyRoundIcon, LogOutIcon, ShieldIcon, SmartphoneIcon } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { device } from '#lib/stores/device.svelte.js';
	import { session } from '#lib/stores/session.svelte.js';
	import { prefs, type ThemePref } from '#lib/stores/prefs.svelte.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { cn } from '#lib/utils.js';
	import AppNav from '#lib/components/AppNav.svelte';
	import { playComplete } from '#lib/feedback.js';

	const uid = $derived(session.user!.uid);
	$effect(() => {
		device.load(uid);
	});

	async function toggleReminder(on: boolean) {
		try {
			if (on) {
				await device.enableReminder(uid);
				toast.success('Pengingat malam aktif di perangkat ini');
			} else {
				await device.disableReminder(uid);
				toast('Pengingat malam dimatikan di perangkat ini');
			}
		} catch (e) {
			device.reminder = false;
			toast.error((e as Error).message);
		}
	}

	let testing = $state(false);
	async function sendTest() {
		testing = true;
		try {
			const res = await fetch('/api/reminder/test', {
				method: 'POST',
				headers: { authorization: `Bearer ${await session.idToken()}` }
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.message ?? 'Gagal mengirim');
			if (data.sent) toast.success(`Notifikasi tes terkirim ke ${data.sent} perangkat`);
			else toast.error('Belum ada perangkat dengan pengingat aktif');
		} catch (e) {
			toast.error((e as Error).message);
		} finally {
			testing = false;
		}
	}

	const themes: { v: ThemePref; l: string }[] = [
		{ v: 'auto', l: 'Otomatis' },
		{ v: 'light', l: 'Terang' },
		{ v: 'dark', l: 'Gelap' }
	];
</script>

<div class="mx-auto min-h-dvh max-w-xl px-4 pt-5 pb-16">
	<header class="flex items-center justify-between">
		<span class="font-display text-lg font-semibold tracking-tight">Jarful</span>
		<AppNav />
	</header>

	<h1 class="font-display mt-6 text-3xl font-semibold">Pengaturan</h1>

	<section class="bg-card ring-border mt-6 rounded-3xl p-5 ring-1">
		<p class="text-muted-foreground text-xs">Masuk sebagai</p>
		<p class="mt-0.5 text-lg font-semibold">{session.displayName}</p>
		<p class="text-muted-foreground text-sm">@{session.username}{session.isAdmin ? ' · admin' : ''}</p>
	</section>

	<section class="bg-card ring-border mt-4 divide-y rounded-3xl ring-1">
		<label class="flex items-center justify-between gap-4 p-5">
			<div>
				<p class="font-medium">Suara</p>
				<p class="text-muted-foreground text-sm">Bunyi "tik" saat todo selesai, nadanya naik saat combo.</p>
			</div>
			<Switch bind:checked={prefs.sound} onCheckedChange={(v) => v && playComplete(1)} />
		</label>
		<label class="flex items-center justify-between gap-4 p-5">
			<div>
				<p class="font-medium">Getar</p>
				<p class="text-muted-foreground text-sm">Getaran halus di HP saat todo selesai.</p>
			</div>
			<Switch bind:checked={prefs.haptic} />
		</label>
		<label class="flex items-center justify-between gap-4 p-5">
			<div>
				<p class="font-medium">Garis coretan</p>
				<p class="text-muted-foreground text-sm">Tampilkan garis coret pada todo yang sudah selesai.</p>
			</div>
			<Switch bind:checked={prefs.strike} />
		</label>
		<div class="p-5">
			<p class="font-medium">Tema</p>
			<p class="text-muted-foreground text-sm">Otomatis: gelap mulai jam 18.00 sampai 06.00.</p>
			<div class="bg-muted mt-3 grid grid-cols-3 gap-1 rounded-full p-1">
				{#each themes as t (t.v)}
					<button
						class={cn(
							'rounded-full py-2 text-sm font-medium transition',
							prefs.theme === t.v ? 'bg-card shadow-sm' : 'text-muted-foreground'
						)}
						onclick={() => (prefs.theme = t.v)}
					>
						{t.l}
					</button>
				{/each}
			</div>
		</div>
	</section>

	<section class="bg-card ring-border mt-4 divide-y rounded-3xl ring-1">
		<div class="flex items-center justify-between gap-4 p-5">
			<div class="flex gap-3">
				<BellRingIcon class="text-primary mt-0.5 size-5 shrink-0" />
				<div>
					<p class="font-medium">Pengingat malam</p>
					<p class="text-muted-foreground text-sm">
						Notifikasi sekitar jam 21.00 WIB: rekap singkat hari ini dan ajakan merencanakan besok.
					</p>
				</div>
			</div>
			<Switch
				checked={device.reminder}
				disabled={device.busy}
				onCheckedChange={(v) => toggleReminder(v)}
			/>
		</div>
		{#if device.reminder}
			<div class="flex items-center justify-between gap-4 px-5 py-3">
				<p class="text-muted-foreground text-sm">Cek apakah notifikasi sampai di perangkat ini.</p>
				<Button variant="outline" size="sm" class="rounded-full" disabled={testing} onclick={sendTest}>
					{testing ? 'Mengirim…' : 'Kirim tes'}
				</Button>
			</div>
		{/if}
		<div class="flex items-center justify-between gap-4 p-5">
			<div class="flex gap-3">
				<SmartphoneIcon class="text-primary mt-0.5 size-5 shrink-0" />
				<div>
					<p class="font-medium">Pasang di layar utama</p>
					<p class="text-muted-foreground text-sm">
						{#if device.installed}
							Jarful sudah terpasang di perangkat ini.
						{:else if device.isIos}
							Di Safari: ketuk Bagikan, lalu <b>Tambah ke Layar Utama</b>. Wajib untuk notifikasi di iPhone.
						{:else if device.installEvent}
							Buka Jarful seperti aplikasi biasa, tanpa bilah browser.
						{:else}
							Buka menu browser, lalu pilih <b>Install app</b> atau <b>Tambahkan ke layar utama</b>.
						{/if}
					</p>
				</div>
			</div>
			{#if device.installEvent && !device.installed}
				<Button size="sm" class="rounded-full" onclick={() => device.install()}>
					<DownloadIcon class="size-4" /> Pasang
				</Button>
			{/if}
		</div>
	</section>

	<section class="mt-4 space-y-2">
		<Button href="/rutinitas" variant="outline" class="h-11 w-full justify-start gap-2 rounded-2xl">
			<RepeatIcon class="size-4" /> Rutinitas harian
		</Button>
		<Button href="/ganti-password" variant="outline" class="h-11 w-full justify-start gap-2 rounded-2xl">
			<KeyRoundIcon class="size-4" /> Ganti password
		</Button>
		{#if session.isAdmin}
			<Button href="/admin" variant="outline" class="h-11 w-full justify-start gap-2 rounded-2xl">
				<ShieldIcon class="size-4" /> Panel admin
			</Button>
		{/if}
		<Button
			variant="ghost"
			class="text-destructive h-11 w-full justify-start gap-2 rounded-2xl"
			onclick={() => session.logout()}
		>
			<LogOutIcon class="size-4" /> Keluar
		</Button>
	</section>
</div>
