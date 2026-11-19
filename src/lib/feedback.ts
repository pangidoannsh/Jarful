import { prefs } from '#lib/stores/prefs.svelte.js';

let ctx: AudioContext | null = null;

function audio() {
	if (!prefs.sound || typeof window === 'undefined') return null;
	try {
		ctx ??= new AudioContext();
		if (ctx.state === 'suspended') void ctx.resume();
		return ctx;
	} catch {
		return null;
	}
}

function tone(freq: number, start: number, dur: number, gain = 0.12, type: OscillatorType = 'triangle') {
	const a = audio();
	if (!a) return;
	const t = a.currentTime + start;
	const osc = a.createOscillator();
	const g = a.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, t);
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	osc.connect(g).connect(a.destination);
	osc.start(t);
	osc.stop(t + dur + 0.02);
}

/**
 * Short "tik"; each combo step raises the pitch by a whole tone.
 * Heavier todos sound deeper and add a soft thump.
 */
export function playComplete(combo: number, weight = 1) {
	const step = Math.min(combo - 1, 10);
	const f = (660 / (weight === 3 ? 1.5 : weight === 2 ? 1.25 : 1)) * Math.pow(2, (step * 2) / 12);
	tone(f, 0, 0.14);
	tone(f * 2, 0.01, 0.08, 0.04, 'sine');
	if (weight >= 2) tone(weight === 3 ? 110 : 150, 0, 0.22, 0.14, 'sine');
	if (weight === 3) tone(f * 1.5, 0.08, 0.18, 0.06);
}

/** A soft, quiet tick for reminders. */
export function playSoft() {
	tone(990, 0, 0.07, 0.05, 'sine');
}

export function playLand() {
	tone(220, 0, 0.09, 0.08, 'sine');
}

export function playGolden() {
	[0, 4, 7, 12].forEach((s, i) => tone(880 * Math.pow(2, s / 12), i * 0.06, 0.25, 0.08, 'sine'));
}

export function playFanfare(volume = 1) {
	[0, 4, 7, 12, 16].forEach((s, i) => tone(523 * Math.pow(2, s / 12), i * 0.09, 0.4, 0.09 * volume + 0.0002));
}

export function haptic(pattern: number | number[] = 10) {
	if (!prefs.haptic) return;
	try {
		navigator.vibrate?.(pattern);
	} catch {
		// Not supported on this device.
	}
}

const COMBO_WINDOW_MS = 10 * 60 * 1000;
let lastAt = 0;
let combo = 0;

/** Completions within 10 minutes of each other build a combo. */
export function nextCombo() {
	const now = Date.now();
	combo = now - lastAt <= COMBO_WINDOW_MS ? combo + 1 : 1;
	lastAt = now;
	return combo;
}

/** About one in six completions is a lucky gold marble. */
export function rollGolden() {
	return Math.random() < 1 / 6;
}

const PRAISE = [
	'Mantap, terus gaskeun!',
	'Kelereng emas! Hari ini kamu on fire.',
	'Langka! Satu kelereng emas untukmu.',
	'Keren, momentum lagi bagus nih.',
	'Beruntung banget, simpan energinya!'
];

export function praise() {
	return PRAISE[Math.floor(Math.random() * PRAISE.length)];
}

export function prefersReducedMotion() {
	return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export async function confettiBurst(origin?: { x: number; y: number }, big = false, amount = 1) {
	if (prefersReducedMotion()) return;
	const confetti = (await import('canvas-confetti')).default;
	const colors = ['#e8673a', '#f0a24a', '#e9c14d', '#d4513a', '#c76aa8'];
	if (big) {
		const end = Date.now() + 1200;
		const frame = () => {
			confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors });
			confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors });
			if (Date.now() < end) requestAnimationFrame(frame);
		};
		frame();
		return;
	}
	confetti({
		particleCount: Math.round(70 * amount),
		spread: 75,
		startVelocity: 32,
		scalar: 0.9,
		origin: origin ?? { x: 0.5, y: 0.4 },
		colors
	});
}
