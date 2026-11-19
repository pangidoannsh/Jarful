import { json } from '@sveltejs/kit';
import { requireMember } from '#lib/server/admin.js';
import { sendReminders } from '#lib/server/reminder.js';
import type { RequestHandler } from './$types';

/** Sends the reminder right now to the caller's own devices, to check notifications work. */
export const POST: RequestHandler = async ({ request }) => {
	const me = await requireMember(request);
	return json(await sendReminders(me.uid));
};
