import { error, json } from '@sveltejs/kit';
import { sendReminders } from '#lib/server/reminder.js';
import type { RequestHandler } from './$types';

// Called by Vercel Cron every evening (see vercel.json). Vercel sends
// "Authorization: Bearer <CRON_SECRET>" when the CRON_SECRET variable is set.
export const GET: RequestHandler = async ({ request }) => {
	const secret = process.env.CRON_SECRET;
	if (!secret) error(500, 'CRON_SECRET belum diisi');
	if (request.headers.get('authorization') !== `Bearer ${secret}`) error(401, 'Unauthorized');
	return json(await sendReminders());
};
