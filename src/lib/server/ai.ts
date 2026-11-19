import Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '#lib/server/admin.js';

export type AiCode = 'AI_UNPAID' | 'AI_NOT_SETUP' | 'AI_BUSY' | 'AI_LIMIT' | 'NO_DATA';

/** Stable error codes from the Anthropic API that mean the bill or spend limit stops requests. */
const BILLING_CODES = new Set([
	'enforced_spend_limit_reached',
	'contract_spend_limit_reached',
	'linked_organization_spend_limit_reached',
	'linked_organization_billing_unavailable',
	'organization_on_hold'
]);

/** Turns any Anthropic error into one code the app understands. Raw errors never reach the browser. */
export function mapAiError(err: unknown): AiCode {
	if (!(err instanceof Anthropic.APIError)) return 'AI_BUSY';
	if (err.type === 'billing_error' || err.status === 402) return 'AI_UNPAID';
	if (err.errorCode && BILLING_CODES.has(err.errorCode)) return 'AI_UNPAID';
	// Older responses describe an empty balance only in the message (kept as a fallback).
	const msg = (err.apiMessage ?? err.message ?? '').toLowerCase();
	if (err.status === 400 && /credit balance|spend limit|billing/.test(msg)) return 'AI_UNPAID';
	if (err.status === 401 || err.status === 403 || err.type === 'authentication_error' || err.type === 'permission_error') {
		return 'AI_NOT_SETUP';
	}
	return 'AI_BUSY';
}

export function aiClient() {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) return null;
	return new Anthropic({ apiKey, maxRetries: 1, timeout: 20_000 });
}

export const MODEL_DAILY = process.env.ANTHROPIC_MODEL_DAILY || 'claude-haiku-5-5';
export const MODEL_PROFILE = process.env.ANTHROPIC_MODEL_PROFILE || 'claude-sonnet-5-5';

/** How long the app stops calling the API after a billing or setup problem. */
const RECHECK_MS = 6 * 3600 * 1000;

export interface AiStatus {
	status: 'ok' | 'unpaid' | 'not_setup';
	since?: number;
	recheckAfter?: number;
}

const statusRef = () => adminDb().doc('system/aiStatus');

export async function readAiStatus(): Promise<AiStatus> {
	const snap = await statusRef().get();
	return (snap.data() as AiStatus | undefined) ?? { status: 'ok' };
}

/** Circuit breaker: true while a recent billing/setup failure says not to call the API yet. */
export function breakerOpen(s: AiStatus) {
	return s.status !== 'ok' && Date.now() < (s.recheckAfter ?? 0);
}

export async function tripBreaker(code: AiCode) {
	const status = code === 'AI_UNPAID' ? 'unpaid' : 'not_setup';
	const now = Date.now();
	await statusRef().set({ status, since: now, recheckAfter: now + RECHECK_MS });
}

export async function resetBreaker(current: AiStatus) {
	if (current.status !== 'ok') await statusRef().set({ status: 'ok', since: Date.now() });
}

export function codeFromStatus(s: AiStatus): AiCode {
	return s.status === 'unpaid' ? 'AI_UNPAID' : 'AI_NOT_SETUP';
}

/** Calls Claude with one forced tool, so the answer always arrives as structured JSON. */
export async function callTool<T>(
	client: Anthropic,
	model: string,
	system: string,
	user: string,
	tool: { name: string; description: string; input_schema: Record<string, unknown> },
	maxTokens = 1500
): Promise<T> {
	const res = await client.messages.create({
		model,
		max_tokens: maxTokens,
		system,
		messages: [{ role: 'user', content: user }],
		tools: [{ ...tool, input_schema: tool.input_schema as Anthropic.Tool.InputSchema }],
		tool_choice: { type: 'tool', name: tool.name }
	});
	const block = res.content.find((b) => b.type === 'tool_use');
	if (!block || block.type !== 'tool_use') throw new Error('Jawaban AI tidak terbaca');
	return block.input as T;
}
