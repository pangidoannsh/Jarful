import { error, json } from '@sveltejs/kit';
import { sendNotifications } from '#lib/server/reminder.js';
import type { RequestHandler } from './$types';

// Called by Vercel Cron every morning at about 06:00 WIB (see vercel.json).
export const GET: RequestHandler = async ({ request }) => {
	const secret = process.env.CRON_SECRET;
	if (!secret) error(500, 'CRON_SECRET belum diisi');
	if (request.headers.get('authorization') !== `Bearer ${secret}`) error(401, 'Unauthorized');
	return json(await sendNotifications('morning'));
};
