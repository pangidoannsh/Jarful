import { error, json } from '@sveltejs/kit';
import { sendNotifications } from '#lib/server/reminder.js';
import type { RequestHandler } from './$types';

// Called by Vercel Cron every morning at about 06:00 WIB (see vercel.json).
export const GET: RequestHandler = async ({ request }) => {
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		console.error('[cron morning] CRON_SECRET belum diisi di Environment Variables');
		error(500, 'CRON_SECRET belum diisi');
	}
	if (request.headers.get('authorization') !== `Bearer ${secret}`) {
		console.error('[cron morning] ditolak: header Authorization tidak cocok dengan CRON_SECRET');
		error(401, 'Unauthorized');
	}
	const result = await sendNotifications('morning');
	// Shows in Vercel → Logs, so a run that sent nothing explains itself.
	console.log('[cron morning]', JSON.stringify(result));
	return json(result);
};
