import { json } from '@sveltejs/kit';
import { requireMember } from '#lib/server/admin.js';
import { sendNotifications, type NotifyKind } from '#lib/server/reminder.js';
import type { RequestHandler } from './$types';

/**
 * Sends a reminder right now to the caller's own registered devices, to check that
 * notifications arrive. Body: { kind: 'evening' | 'morning' }.
 */
export const POST: RequestHandler = async ({ request }) => {
	const me = await requireMember(request);
	const body = (await request.json().catch(() => ({}))) as { kind?: NotifyKind };
	const kind: NotifyKind = body.kind === 'morning' ? 'morning' : 'evening';
	const server = {
		messaging: Boolean(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
		cronSecret: Boolean(process.env.CRON_SECRET)
	};
	return json({ ...(await sendNotifications(kind, me.uid, true)), server });
};
