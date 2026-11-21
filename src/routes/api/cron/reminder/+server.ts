import { error, json } from '@sveltejs/kit';
import { sendReminders } from '#lib/server/reminder.js';
import type { RequestHandler } from './$types';

// Called by Vercel Cron every evening (see vercel.json). Vercel sends
// "Authorization: Bearer <CRON_SECRET>" when the CRON_SECRET variable is set.
export const GET: RequestHandler = async ({ request }) => {
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		console.error('[cron evening] CRON_SECRET belum diisi di Environment Variables');
		error(500, 'CRON_SECRET belum diisi');
	}
	if (request.headers.get('authorization') !== `Bearer ${secret}`) {
		console.error('[cron evening] ditolak: header Authorization tidak cocok dengan CRON_SECRET');
		error(401, 'Unauthorized');
	}
	const result = await sendReminders();
	// Shows in Vercel → Logs, so a run that sent nothing explains itself.
	console.log('[cron evening]', JSON.stringify(result));
	return json(result);
};
