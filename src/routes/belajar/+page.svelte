<script lang="ts">
	import {
		GraduationCapIcon,
		RefreshCwIcon,
		CalendarPlusIcon,
		CheckIcon,
		XIcon,
		RotateCcwIcon,
		CreditCardIcon,
		WrenchIcon,
		HourglassIcon,
		NotebookPenIcon,
		ClockIcon
	} from '@lucide/svelte';
	import { doc, getDoc, onSnapshot, addDoc, collection, updateDoc, getDocs, query, where } from 'firebase/firestore';
	import { toast } from 'svelte-sonner';
	import { db } from '#lib/firebase.js';
	import { session } from '#lib/stores/session.svelte.js';
	import { addTodo } from '#lib/stores/todos.svelte.js';
	import { addDays, formatDay, toKey, todayKey } from '#lib/date.js';
	import { formatMinutes } from '#lib/smart-input.js';
	import { cn } from '#lib/utils.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import AppNav from '#lib/components/AppNav.svelte';
	import type { LearningProfile, SaranDay, SaranItem, Todo } from '#lib/types.js';

	const uid = $derived(session.user!.uid);
	const today = todayKey();

	type Code = 'AI_UNPAID' | 'AI_NOT_SETUP' | 'AI_BUSY' | 'AI_LIMIT' | 'NO_DATA' | 'SERVER_NOT_SETUP';
	const MESSAGES: Record<Code, { title: string; body: string; icon: typeof CreditCardIcon }> = {
		AI_UNPAID: {
			title: 'Admin belum bayar tagihan AI',
			body: 'Saran belajar akan muncul lagi setelah tagihan dibayar. Fitur lain tetap berjalan normal.',
			icon: CreditCardIcon
		},
		AI_NOT_SETUP: {
			title: 'Fitur AI belum diaktifkan admin',
			body: 'Admin perlu mengisi ANTHROPIC_API_KEY di Vercel.',
			icon: WrenchIcon
		},
		SERVER_NOT_SETUP: {
			title: 'Server belum dikonfigurasi',
			body: 'Variabel FIREBASE_ADMIN_* belum terbaca oleh server. Di komputer: isi .env lalu jalankan ulang npm run dev. Di Vercel: isi Environment Variables lalu Redeploy.',
			icon: WrenchIcon
		},
		AI_BUSY: {
			title: 'Claude sedang sibuk',
			body: 'Coba lagi sebentar lagi.',
			icon: HourglassIcon
		},
		AI_LIMIT: {
			title: 'Jatah saran hari ini sudah habis',
			body: 'Maksimal 3 permintaan per hari. Besok lagi, ya.',
			icon: HourglassIcon
		},
		NO_DATA: {
			title: 'Belum ada riwayat belajar',
			body: 'Tandai todo belajarmu dengan #belajar, misalnya "baca dokumentasi Svelte 30m #belajar". Setelah selesai, beri catatan singkat lewat menu ⋯ → Catatan belajar.',
			icon: NotebookPenIcon
		}
	};

	let day = $state<SaranDay | null>(null);
	let profile = $state<LearningProfile | null>(null);
	let code = $state<Code | null>(null);
	let loading = $state(false);
	let aiStatus = $state<'ok' | 'unpaid' | 'not_setup'>('ok');
	let history = $state<Todo[]>([]);

	// The server writes system/aiStatus; reading it first avoids a pointless request.
	$effect(() => onSnapshot(doc(db, 'system', 'aiStatus'), (s) => (aiStatus = (s.data()?.status as typeof aiStatus) ?? 'ok'), () => {}));

	$effect(() => {
		getDoc(doc(db, 'users', uid, 'learning', 'profile'))
			.then((s) => (profile = (s.data() as LearningProfile) ?? null))
			.catch(() => {});
		getDocs(query(collection(db, 'users', uid, 'todos'), where('tag', '==', 'belajar'))).then((s) => {
			history = s.docs
				.map((d) => ({ id: d.id, ...d.data() }) as Todo)
				.filter((t) => t.done)
				.sort((a, b) => b.date.localeCompare(a.date))
				.slice(0, 12);
		}).catch(() => {});
	});

	async function request(opts: { ranah?: string; refresh?: boolean; recheck?: boolean } = {}) {
		loading = true;
		code = null;
		try {
			const res = await fetch('/api/saran', {
				method: 'POST',
				headers: { 'content-type': 'application/json', authorization: `Bearer ${await session.idToken()}` },
				body: JSON.stringify(opts)
			});
			const data = await res.json().catch(() => ({ ok: false, code: 'AI_BUSY' }));
			if (data.ok) {
				day = data.day;
				if (data.profile) profile = data.profile;
			} else {
				code = (data.code as Code) ?? 'AI_BUSY';
			}
		} catch {
			code = 'AI_BUSY';
		} finally {
			loading = false;
		}
	}

	// Load today's suggestions once (served from cache when already made today).
	let started = false;
	$effect(() => {
		if (started) return;
		if (aiStatus === 'unpaid') {
			code = 'AI_UNPAID';
			return;
		}
		started = true;
		request();
	});

	async function feedback(i: number, item: SaranItem, verdict: 'added' | 'known' | 'nope') {
		if (!day) return;
		day = { ...day, feedback: { ...(day.feedback ?? {}), [i]: verdict } };
		if (verdict === 'added') {
			addTodo(uid, {
				title: item.judul,
				date: addDays(today, 1),
				tag: 'belajar',
				estimateMin: item.estimasiMenit
			});
			toast.success('Ditambahkan ke rencana besok');
		}
		try {
			await addDoc(collection(db, 'users', uid, 'saranFeedback'), { judul: item.judul, verdict, at: Date.now() });
			const saranDocs = await getDocs(collection(db, 'users', uid, 'saran'));
			const latest = saranDocs.docs.map((d) => d.id).sort().at(-1);
			if (latest) await updateDoc(doc(db, 'users', uid, 'saran', latest), { [`feedback.${i}`]: verdict });
		} catch {
			// Feedback is best-effort; the suggestion itself is unaffected.
		}
	}

	const JARAK = {
		dekat: { label: 'Dekat', hint: 'lanjutan langsung', cls: 'bg-good/15 text-good' },
		sedang: { label: 'Sedang', hint: 'cabang terkait', cls: 'bg-primary/15 text-primary' },
		jauh: { label: 'Jauh', hint: 'jembatan dalam ranah', cls: 'bg-[var(--marble-5)]/15 text-[var(--marble-5)]' }
	} as const;

	const STATUS_CLS = {
		dikuasai: 'bg-good/15 text-good',
		sedang: 'bg-primary/12 text-primary',
		bingung: 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
	} as const;
</script>

<div class="mx-auto min-h-dvh max-w-xl px-4 pt-5 pb-16">
	<header class="flex items-center justify-between">
		<span class="font-display text-lg font-semibold tracking-tight">Jarful</span>
		<AppNav />
	</header>

	<div class="mt-6 flex items-end justify-between gap-3">
		<div>
			<p class="text-primary flex items-center gap-1.5 text-sm font-semibold">
				<GraduationCapIcon class="size-4" /> Saran Belajar
			</p>
			<h1 class="font-display mt-1 text-3xl font-semibold">Mau belajar apa lagi?</h1>
			<p class="text-muted-foreground mt-1 text-sm">
				Dari riwayat todo <b>#belajar</b>-mu. Hanya todo bertanda itu yang dikirim ke Claude.
			</p>
		</div>
	</div>

	{#if profile?.domains.length}
		<div class="mt-5 flex flex-wrap gap-1.5">
			{#each profile.domains as d (d.name)}
				<button
					class={cn(
						'rounded-full border px-3 py-1.5 text-sm font-medium transition',
						day?.ranah === d.name ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
					)}
					disabled={loading}
					onclick={() => request({ ranah: d.name })}>{d.name}</button
				>
			{/each}
		</div>
	{/if}

	{#if code}
		{@const m = MESSAGES[code]}
		<section class="bg-card ring-border mt-6 flex gap-4 rounded-3xl p-5 ring-1" role="status">
			<m.icon class="text-muted-foreground mt-0.5 size-6 shrink-0" />
			<div class="flex-1">
				<p class="font-semibold">{m.title}</p>
				<p class="text-muted-foreground mt-1 text-sm">{m.body}</p>
				{#if (code === 'AI_UNPAID' || code === 'AI_NOT_SETUP') && session.isAdmin}
					<Button variant="outline" size="sm" class="mt-3 rounded-full" disabled={loading} onclick={() => request({ recheck: true })}>
						<RefreshCwIcon class={cn('size-4', loading && 'animate-spin')} /> Cek ulang sekarang
					</Button>
				{:else if code === 'AI_BUSY'}
					<Button variant="outline" size="sm" class="mt-3 rounded-full" disabled={loading} onclick={() => request()}>
						Coba lagi
					</Button>
				{/if}
			</div>
		</section>
	{:else if loading && !day}
		<div class="mt-6 space-y-3">
			{#each [0, 1, 2] as i (i)}
				<div class="bg-muted h-36 animate-pulse rounded-3xl"></div>
			{/each}
			<p class="text-muted-foreground text-center text-sm">Claude sedang membaca riwayat belajarmu…</p>
		</div>
	{/if}

	{#if day && !code}
		<p class="text-muted-foreground mt-6 text-xs font-bold tracking-widest uppercase">Ranah: {day.ranah}</p>
		<ul class="mt-2 space-y-3">
			{#each day.items as item, i (i)}
				{@const j = JARAK[item.jarak] ?? JARAK.sedang}
				{@const fb = day.feedback?.[i]}
				<li class={cn('bg-card ring-border rounded-3xl p-5 ring-1', fb && fb !== 'added' && 'opacity-50')}>
					<div class="flex items-center gap-2">
						<span class={cn('rounded-full px-2.5 py-0.5 text-[11px] font-bold', j.cls)}>{j.label}</span>
						<span class="text-muted-foreground text-xs">{j.hint}</span>
						<span class="text-muted-foreground ml-auto flex items-center gap-1 text-xs">
							<ClockIcon class="size-3" />{formatMinutes(item.estimasiMenit)}
						</span>
					</div>
					<h2 class="font-display mt-2 text-xl font-semibold">{item.judul}</h2>
					<p class="mt-1 text-sm">{item.alasan}</p>
					{#if item.terkait?.length}
						<p class="text-muted-foreground mt-2 text-xs">Menyambung dari: {item.terkait.join(', ')}</p>
					{/if}
					<p class="bg-muted/70 mt-3 rounded-2xl p-3 text-sm"><b>Langkah pertama:</b> {item.langkahPertama}</p>
					{#if fb}
						<p class="text-muted-foreground mt-3 text-sm">
							{fb === 'added' ? '✓ Sudah masuk rencana besok' : fb === 'known' ? 'Ditandai sudah tahu' : 'Ditandai tidak tertarik'}
						</p>
					{:else}
						<div class="mt-3 flex flex-wrap gap-2">
							<Button size="sm" class="rounded-full" onclick={() => feedback(i, item, 'added')}>
								<CalendarPlusIcon class="size-4" /> Jadikan todo besok
							</Button>
							<Button size="sm" variant="outline" class="rounded-full" onclick={() => feedback(i, item, 'known')}>
								<CheckIcon class="size-4" /> Sudah tahu
							</Button>
							<Button size="sm" variant="ghost" class="rounded-full" onclick={() => feedback(i, item, 'nope')}>
								<XIcon class="size-4" /> Tidak tertarik
							</Button>
						</div>
					{/if}
				</li>
			{/each}
		</ul>

		{#if day.ulang}
			<section class="mt-3 flex gap-3 rounded-3xl bg-amber-500/10 p-5">
				<RotateCcwIcon class="mt-0.5 size-5 shrink-0 text-amber-600" />
				<div>
					<p class="font-semibold">Ulangi: {day.ulang.topik}</p>
					<p class="text-muted-foreground mt-1 text-sm">{day.ulang.alasan}</p>
				</div>
			</section>
		{/if}

		<div class="mt-4 flex items-center justify-between">
			<p class="text-muted-foreground text-xs">Permintaan hari ini: {day.requests}/3</p>
			<Button variant="outline" size="sm" class="rounded-full" disabled={loading || day.requests >= 3} onclick={() => request({ ranah: day?.ranah, refresh: true })}>
				<RefreshCwIcon class={cn('size-4', loading && 'animate-spin')} /> Saran baru
			</Button>
		</div>
	{/if}

	{#if profile}
		<section class="bg-card ring-border mt-8 rounded-3xl p-5 ring-1">
			<h2 class="text-muted-foreground text-[11px] font-bold tracking-widest uppercase">Peta Belajar</h2>
			<p class="mt-2 text-sm">{profile.summary}</p>
			{#each profile.domains as d (d.name)}
				<div class="mt-4">
					<p class="text-sm font-semibold">{d.name}</p>
					<div class="mt-1.5 flex flex-wrap gap-1.5">
						{#each d.topics as t (t.name)}
							<span class={cn('rounded-full px-2.5 py-1 text-xs font-medium', STATUS_CLS[t.status] ?? STATUS_CLS.sedang)}>{t.name}</span>
						{/each}
					</div>
				</div>
			{/each}
			<p class="text-muted-foreground mt-4 flex flex-wrap gap-3 text-[11px]">
				<span class="flex items-center gap-1"><span class="bg-good size-2 rounded-full"></span>dikuasai</span>
				<span class="flex items-center gap-1"><span class="bg-primary size-2 rounded-full"></span>sedang dipelajari</span>
				<span class="flex items-center gap-1"><span class="size-2 rounded-full bg-amber-500"></span>masih bingung</span>
				<span>· diperbarui {formatDay(toKey(new Date(profile.updatedAt)), { weekday: undefined })}</span>
			</p>
		</section>
	{/if}

	{#if history.length}
		<section class="mt-4">
			<h2 class="text-muted-foreground px-1 text-[11px] font-bold tracking-widest uppercase">Riwayat belajar</h2>
			<ul class="mt-2 space-y-2">
				{#each history as t (t.id)}
					<li class="bg-card ring-border rounded-2xl px-4 py-3 ring-1">
						<p class="text-sm font-medium">{t.title}</p>
						<p class="text-muted-foreground text-xs">{formatDay(t.date, { weekday: undefined, month: 'short' })}</p>
						{#if t.note}<p class="mt-1 text-sm italic">“{t.note}”</p>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
