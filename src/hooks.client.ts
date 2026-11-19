import type { HandleClientError } from '@sveltejs/kit/hooks';

/** Shows the real cause on the error page instead of a bare "Internal Error". */
export const handleError: HandleClientError = (input) => {
	if (input.kind !== 'unknown') return;
	const err = input.error;
	console.error('[jarful]', err);
	const message = err instanceof Error ? err.message : String(err);
	return { message: message || 'Internal Error' };
};
