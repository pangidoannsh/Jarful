import { json } from '@sveltejs/kit';
import { adminDb, requireMember } from '#lib/server/admin.js';
import {
	aiClient,
	breakerOpen,
	callTool,
	codeFromStatus,
	mapAiError,
	MODEL_DAILY,
	MODEL_PROFILE,
	readAiStatus,
	resetBreaker,
	tripBreaker,
	type AiCode
} from '#lib/server/ai.js';
import { dayKeyIn, REMINDER_TZ } from '#lib/server/reminder.js';
import type { LearningProfile, SaranDay } from '#lib/types.js';
import type { RequestHandler } from './$types';

const DAILY_LIMIT = 3;
const PROFILE_MAX_AGE = 7 * 864e5;
const LEARNING_TAG = 'belajar';

// The browser always gets 200 with { ok, code }; details stay in the Vercel logs.
const fail = (code: AiCode) => json({ ok: false, code });

const PROFILE_TOOL = {
	name: 'simpan_profil',
	description: 'Simpan profil belajar ringkas pengguna.',
	input_schema: {
		type: 'object',
		properties: {
			summary: { type: 'string', description: 'Ringkasan 2-3 kalimat: yang dikuasai, celah, minat.' },
			domains: {
				type: 'array',
				description: 'Ranah ilmu, misalnya "Pemrograman Web". Maksimal 6.',
				items: {
					type: 'object',
					properties: {
						name: { type: 'string' },
						topics: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									name: { type: 'string' },
									status: { type: 'string', enum: ['dikuasai', 'sedang', 'bingung'] }
								},
								required: ['name', 'status']
							}
						}
					},
					required: ['name', 'topics']
				}
			}
		},
		required: ['summary', 'domains']
	}
};

const SARAN_TOOL = {
	name: 'beri_saran',
	description: 'Berikan tiga saran topik belajar berikutnya dalam satu ranah.',
	input_schema: {
		type: 'object',
		properties: {
			ranah: { type: 'string' },
			saran: {
				type: 'array',
				minItems: 3,
				maxItems: 3,
				items: {
					type: 'object',
					properties: {
						jarak: { type: 'string', enum: ['dekat', 'sedang', 'jauh'] },
						judul: { type: 'string', description: 'Topik konkret, maksimal 8 kata.' },
						alasan: { type: 'string', description: 'Satu kalimat, merujuk topik yang sudah dipelajari.' },
						terkait: { type: 'array', items: { type: 'string' }, description: 'Topik lama yang menyambungkan.' },
						estimasiMenit: { type: 'integer', minimum: 10, maximum: 180 },
						langkahPertama: { type: 'string', description: 'Satu langkah pertama yang konkret.' }
					},
					required: ['jarak', 'judul', 'alasan', 'terkait', 'estimasiMenit', 'langkahPertama']
				}
			},
			ulang: {
				type: ['object', 'null'],
				description: 'Opsional: topik lama yang sebaiknya diulang karena catatannya masih bingung.',
				properties: { topik: { type: 'string' }, alasan: { type: 'string' } }
			}
		},
		required: ['ranah', 'saran']
	}
};

export const POST: RequestHandler = async ({ request }) => {
	// Missing FIREBASE_ADMIN_* is a setup problem, not "Claude is busy": say so plainly.
	if (!process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
		return json({ ok: false, code: 'SERVER_NOT_SETUP' });
	}
	const me = await requireMember(request);
	const body = (await request.json().catch(() => ({}))) as { ranah?: string; refresh?: boolean; recheck?: boolean };
	const db = adminDb();
	const today = dayKeyIn(REMINDER_TZ);
	const dayRef = db.doc(`users/${me.uid}/saran/${today}`);

	// 1. Circuit breaker: after a billing/setup failure, don't call the API for a while.
	//    An admin can force one check right after paying.
	const status = await readAiStatus();
	const forced = body.recheck === true && me.admin === true;
	if (breakerOpen(status) && !forced) return fail(codeFromStatus(status));

	const client = aiClient();
	if (!client) return fail('AI_NOT_SETUP');

	// 2. Cached suggestions for today, and the daily limit per person.
	const daySnap = await dayRef.get();
	const cached = daySnap.data() as SaranDay | undefined;
	const sameRanah = !body.ranah || cached?.ranah === body.ranah;
	if (cached && !body.refresh && !forced && sameRanah) return json({ ok: true, day: cached });
	if ((cached?.requests ?? 0) >= DAILY_LIMIT && !forced) return fail('AI_LIMIT');

	// 3. Only #belajar todos and their notes are sent to Claude.
	const since = dayKeyIn(REMINDER_TZ, -60);
	const learnSnap = await db.collection(`users/${me.uid}/todos`).where('tag', '==', LEARNING_TAG).get();
	const learning = learnSnap.docs
		.map((d) => d.data())
		.filter((t) => String(t.date) >= since)
		.sort((a, b) => String(a.date).localeCompare(String(b.date)))
		.slice(-80)
		.map((t) => `- ${t.date} ${t.done ? '[selesai]' : '[belum]'} ${t.title}${t.note ? ` — catatan: ${String(t.note).slice(0, 300)}` : ''}`);
	if (!learning.length) return fail('NO_DATA');

	const fbSnap = await db.collection(`users/${me.uid}/saranFeedback`).orderBy('at', 'desc').limit(40).get();
	const feedback = fbSnap.docs.map((d) => {
		const f = d.data();
		const label = f.verdict === 'known' ? 'sudah tahu' : f.verdict === 'nope' ? 'tidak tertarik' : 'dijadikan todo';
		return `- ${f.judul} (${label})`;
	});

	try {
		// 4. Weekly profile (Sonnet), so prompts stay small even after months of history.
		const profileRef = db.doc(`users/${me.uid}/learning/profile`);
		let profile = (await profileRef.get()).data() as LearningProfile | undefined;
		if (!profile || Date.now() - profile.updatedAt > PROFILE_MAX_AGE || body.refresh) {
			const p = await callTool<Omit<LearningProfile, 'updatedAt'>>(
				client,
				MODEL_PROFILE,
				'Kamu membantu merangkum riwayat belajar seseorang. Jawab dalam Bahasa Indonesia. Kelompokkan topik ke ranah yang masuk akal. Topik dengan catatan "bingung" atau "belum paham" diberi status bingung.',
				`Riwayat belajar 60 hari terakhir:\n${learning.join('\n')}\n\nProfil sebelumnya: ${profile ? profile.summary : '(belum ada)'}`,
				PROFILE_TOOL,
				2000
			);
			profile = { summary: p.summary, domains: (p.domains ?? []).slice(0, 6), updatedAt: Date.now() };
			await profileRef.set(profile);
		}

		const ranah = body.ranah || profile.domains[0]?.name || 'Umum';

		// 5. Daily suggestions (Haiku): near, medium, far — all inside one domain.
		const out = await callTool<{ ranah: string; saran: SaranDay['items']; ulang?: SaranDay['ulang'] }>(
			client,
			MODEL_DAILY,
			'Kamu mentor belajar yang ringkas. Jawab dalam Bahasa Indonesia. Berikan tepat tiga saran dalam SATU ranah: "dekat" = lanjutan langsung dari yang terakhir dipelajari, "sedang" = cabang terkait, "jauh" = topik lebih jauh tetapi tetap masuk akal dan satu ranah. Jangan menyarankan topik yang ditandai sudah tahu atau tidak tertarik. Alasan harus menyebut topik lama yang menyambungkan.',
			`Ranah yang dipilih: ${ranah}\n\nProfil belajar:\n${profile.summary}\nTopik per ranah:\n${profile.domains
				.map((d) => `${d.name}: ${d.topics.map((t) => `${t.name} (${t.status})`).join(', ')}`)
				.join('\n')}\n\nRiwayat terbaru:\n${learning.slice(-25).join('\n')}\n\nUmpan balik saran sebelumnya:\n${feedback.join('\n') || '(belum ada)'}`,
			SARAN_TOOL,
			1500
		);

		const day: SaranDay = {
			ranah: out.ranah || ranah,
			items: (out.saran ?? []).slice(0, 3),
			ulang: out.ulang && out.ulang.topik ? out.ulang : null,
			requests: (cached?.requests ?? 0) + 1,
			feedback: {},
			createdAt: Date.now()
		};
		await dayRef.set(day);
		await resetBreaker(status);
		return json({ ok: true, day, profile });
	} catch (e) {
		const code = mapAiError(e);
		const reqId = (e as { requestID?: string }).requestID;
		console.error('[saran]', code, reqId ?? '', (e as Error).message);
		if (code === 'AI_UNPAID' || code === 'AI_NOT_SETUP') await tripBreaker(code);
		return fail(code);
	}
};
