<script lang="ts">
	import { BellRingIcon, DownloadIcon, RepeatIcon, PartyPopperIcon, PlayIcon, SunriseIcon, FlaskConicalIcon, CircleCheckIcon, CircleXIcon, KeyRoundIcon, LogOutIcon, ShieldIcon, SmartphoneIcon } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { device, type ReminderFlag } from '#lib/stores/device.svelte.js';
	import { CUSTOM_SOUNDS, SOUND_OPTIONS, playSoundOption, preloadCelebration } from '#lib/sounds.js';
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

	const FLAG_LABEL = { reminder: 'Pengingat malam', morning: 'Pengingat pagi' } as const;

	async function toggle(flag: ReminderFlag, on: boolean) {
		try {
			if (on) {
				await device.enable(uid, flag);
				toast.success(`${FLAG_LABEL[flag]} aktif di perangkat ini`);
			} else {
				await device.disable(uid, flag);
				toast(`${FLAG_LABEL[flag]} dimatikan di perangkat ini`);
			}
		} catch (e) {
			device[flag] = false;
			toast.error((e as Error).message);
		}
	}

	interface TestResult {
		sent: number;
		removed: number;
		users: number;
		errors?: string[];
		server?: { messaging: boolean; cronSecret: boolean };
	}

	let testing = $state<'' | 'evening' | 'morning' | 'local'>('');
	let lastTest = $state<{ kind: string; result: TestResult | null; error: string | null } | null>(null);

	async function sendTest(kind: 'evening' | 'morning') {
		testing = kind;
		try {
			const res = await fetch('/api/reminder/test', {
				method: 'POST',
				headers: { 'content-type': 'application/json', authorization: `Bearer ${await session.idToken()}` },
				body: JSON.stringify({ kind })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.message ?? 'Gagal mengirim');
			lastTest = { kind, result: data, error: null };
			if (data.sent) toast.success(`Notifikasi tes terkirim ke ${data.sent} perangkat`);
			else toast.error('Belum ada perangkat terdaftar untuk akun ini');
		} catch (e) {
			lastTest = { kind, result: null, error: (e as Error).message };
			toast.error((e as Error).message);
		} finally {
			testing = '';
		}
	}

	async function localTest() {
		testing = 'local';
		try {
			await device.localTest();
			toast.success('Notifikasi lokal ditampilkan');
		} catch (e) {
			toast.error((e as Error).message);
		} finally {
			testing = '';
		}
	}

	let permission = $state<string>('');
	let pushSupported = $state<string | null>(null);
	$effect(() => {
		permission = 'Notification' in window ? Notification.permission : 'unsupported';
		device.unsupportedReason().then((r) => (pushSupported = r ?? ''));
	});

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
		{#if prefs.sound}
			<div class="space-y-3 p-5">
				<div class="flex gap-3">
					<PartyPopperIcon class="text-primary mt-0.5 size-5 shrink-0" />
					<div>
						<p class="font-medium">Suara perayaan</p>
						<p class="text-muted-foreground text-sm">Diputar tepat setelah bunyi "tik" saat todo selesai. Pengingat tidak ikut.</p>
					</div>
				</div>
				<div class="flex gap-2">
					<select
						bind:value={prefs.celebration}
						onchange={() => {
							preloadCelebration();
							playSoundOption(prefs.celebration);
						}}
						class="bg-muted h-10 min-w-0 flex-1 rounded-xl px-3 text-sm outline-none"
						aria-label="Pilih suara perayaan"
					>
						{#each SOUND_OPTIONS as o (o.id)}
							<option value={o.id}>{o.label}</option>
						{/each}
					</select>
					<Button
						variant="outline"
						size="icon"
						class="size-10 rounded-xl"
						aria-label="Dengarkan"
						disabled={prefs.celebration === 'none'}
						onclick={() => playSoundOption(prefs.celebration)}
					>
						<PlayIcon class="size-4" />
					</Button>
				</div>
				{#if prefs.celebration !== 'none'}
					<div class="bg-muted grid grid-cols-2 gap-1 rounded-full p-1">
						{#each [{ v: 'every', l: 'Setiap selesai' }, { v: 'big', l: 'Tugas berat & Fokus' }] as w (w.v)}
							<button
								class={cn(
									'rounded-full py-2 text-sm font-medium transition',
									prefs.celebrationWhen === w.v ? 'bg-card shadow-sm' : 'text-muted-foreground'
								)}
								onclick={() => (prefs.celebrationWhen = w.v as 'every' | 'big')}>{w.l}</button
							>
						{/each}
					</div>
					<label class="flex items-center gap-3 text-sm">
						<span class="text-muted-foreground w-16">Volume</span>
						<input
							type="range"
							min="0"
							max="1"
							step="0.05"
							bind:value={prefs.celebrationVolume}
							onchange={() => playSoundOption(prefs.celebration)}
							class="accent-primary flex-1"
						/>
						<span class="w-10 text-right tabular-nums">{Math.round(prefs.celebrationVolume * 100)}%</span>
					</label>
				{/if}
				{#if !CUSTOM_SOUNDS.length && session.isAdmin}
					<p class="text-muted-foreground bg-muted/60 rounded-xl p-3 text-xs">
						Untuk developer: taruh file .mp3/.ogg/.wav di <code>src/lib/assets/sounds/</code>, lalu build
						ulang. Semua file di sana otomatis muncul di daftar ini.
					</p>
				{/if}
			</div>
		{/if}
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
				<SunriseIcon class="text-primary mt-0.5 size-5 shrink-0" />
				<div>
					<p class="font-medium">Pengingat pagi</p>
					<p class="text-muted-foreground text-sm">
						Sekitar jam 06.00 WIB: hanya todo dan pengingat yang kamu beri tanggal (diketik seperti
						<b>25/11</b> atau <b>besok</b>, atau dipilih lewat ikon kalender). Tidak dikirim kalau tidak ada.
					</p>
				</div>
			</div>
			<Switch checked={device.morning} disabled={device.busy} onCheckedChange={(v) => toggle('morning', v)} />
		</div>
		<div class="flex items-center justify-between gap-4 p-5">
			<div class="flex gap-3">
				<BellRingIcon class="text-primary mt-0.5 size-5 shrink-0" />
				<div>
					<p class="font-medium">Pengingat malam</p>
					<p class="text-muted-foreground text-sm">
						Sekitar jam 21.00 WIB: rekap singkat hari ini dan ajakan merencanakan besok.
					</p>
				</div>
			</div>
			<Switch checked={device.reminder} disabled={device.busy} onCheckedChange={(v) => toggle('reminder', v)} />
		</div>
		{#if (device.reminder || device.morning) && !session.isAdmin}
			<div class="flex items-center justify-between gap-4 px-5 py-3">
				<p class="text-muted-foreground text-sm">Cek apakah notifikasi sampai di perangkat ini.</p>
				<Button
					variant="outline"
					size="sm"
					class="rounded-full"
					disabled={!!testing}
					onclick={() => sendTest(device.morning ? 'morning' : 'evening')}
				>
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

	{#if session.isAdmin}
		<section class="bg-card ring-border mt-4 rounded-3xl p-5 ring-1">
			<p class="flex items-center gap-2 font-medium"><FlaskConicalIcon class="text-primary size-5" /> Tes notifikasi (admin)</p>
			<p class="text-muted-foreground mt-1 text-sm">Cek setiap bagian yang dibutuhkan notifikasi, lalu kirim tes ke perangkat ini.</p>

			<ul class="mt-4 space-y-2 text-sm">
				{#each [
					{ ok: device.pushConfigured, label: 'Kunci VAPID terpasang', bad: 'VITE_FIREBASE_VAPID_KEY belum diisi' },
					{ ok: pushSupported === '', label: 'Browser mendukung push', bad: pushSupported ?? 'Memeriksa…' },
					{ ok: permission === 'granted', label: 'Izin notifikasi diberikan', bad: permission === 'denied' ? 'Ditolak: izinkan lewat pengaturan situs/aplikasi' : 'Belum diminta' },
					{ ok: device.registered, label: 'Perangkat ini terdaftar', bad: 'Belum terdaftar: nyalakan salah satu pengingat atau tekan Daftarkan' },
					{ ok: device.installed || !device.isIos, label: device.isIos ? 'Terpasang di layar utama' : 'Tidak perlu dipasang (bukan iPhone)', bad: 'iPhone: wajib dibuka dari ikon layar utama' }
				] as c (c.label)}
					<li class="flex items-start gap-2">
						{#if c.ok}<CircleCheckIcon class="text-good mt-0.5 size-4 shrink-0" />{:else}<CircleXIcon class="text-destructive mt-0.5 size-4 shrink-0" />{/if}
						<span>{c.ok ? c.label : c.bad}</span>
					</li>
				{/each}
			</ul>

			<div class="mt-4 grid grid-cols-2 gap-2">
				<Button variant="outline" class="rounded-xl" disabled={!!testing} onclick={localTest}>
					{testing === 'local' ? 'Menampilkan…' : '1 · Tes lokal'}
				</Button>
				{#if !device.registered}
					<Button
						variant="outline"
						class="rounded-xl"
						disabled={device.busy}
						onclick={() =>
							device
								.register(uid)
								.then(() => {
									permission = Notification.permission;
									toast.success('Perangkat terdaftar');
								})
								.catch((e) => toast.error(e.message))}
					>
						Daftarkan perangkat
					</Button>
				{:else}
					<span></span>
				{/if}
				<Button class="rounded-xl" disabled={!!testing || !device.registered} onclick={() => sendTest('morning')}>
					{testing === 'morning' ? 'Mengirim…' : '2 · Tes pagi'}
				</Button>
				<Button class="rounded-xl" disabled={!!testing || !device.registered} onclick={() => sendTest('evening')}>
					{testing === 'evening' ? 'Mengirim…' : '3 · Tes malam'}
				</Button>
			</div>
			<p class="text-muted-foreground mt-2 text-xs">
				Tes lokal memeriksa apakah perangkat bisa menampilkan notifikasi. Tes pagi/malam mengirim lewat server dan
				Firebase, persis seperti jadwal sungguhan.
			</p>

			{#if lastTest}
				<div class="bg-muted/70 mt-3 rounded-2xl p-3 font-mono text-xs leading-relaxed">
					{#if lastTest.error}
						<p class="text-destructive">Tes {lastTest.kind}: {lastTest.error}</p>
					{:else if lastTest.result}
						<p>Tes {lastTest.kind}: terkirim {lastTest.result.sent}, token dibuang {lastTest.result.removed}</p>
						{#if lastTest.result.server}
							<p>Server: kunci admin {lastTest.result.server.messaging ? 'ada' : 'TIDAK ADA'} · CRON_SECRET {lastTest.result.server.cronSecret ? 'ada' : 'TIDAK ADA (jadwal otomatis tidak jalan)'}</p>
						{/if}
						{#if lastTest.result.errors?.length}<p class="text-destructive">Error: {lastTest.result.errors.join(', ')}</p>{/if}
						{#if !lastTest.result.sent && !lastTest.result.errors?.length}<p>Tidak ada perangkat terdaftar untuk akun ini.</p>{/if}
					{/if}
				</div>
			{/if}
		</section>
	{/if}

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
