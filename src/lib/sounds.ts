import { prefs } from '#lib/stores/prefs.svelte.js';
import { playFanfare } from '#lib/feedback.js';
import type { Weight } from '#lib/types.js';

/**
 * Celebration sounds. Every audio file in src/lib/assets/sounds/ is picked up at build
 * time and offered in Settings; nothing else needs to change when files are added.
 */
const files = import.meta.glob('/src/lib/assets/sounds/*.{mp3,ogg,wav,m4a,aac,webm}', {
	eager: true,
	query: '?url',
	import: 'default'
}) as Record<string, string>;

export interface SoundOption {
	id: string;
	label: string;
	url?: string;
}

function labelFor(file: string) {
	const name = file
		.replace(/\.[^.]+$/, '')
		.replace(/^\d+[-_ .]*/, '')
		.replace(/[-_]+/g, ' ')
		.trim();
	return name ? name[0].toUpperCase() + name.slice(1) : file;
}

export const CUSTOM_SOUNDS: SoundOption[] = Object.entries(files)
	.map(([path, url]) => {
		const file = path.split('/').pop()!;
		return { id: `file:${file}`, label: labelFor(file), url, file };
	})
	.sort((a, b) => a.file.localeCompare(b.file))
	.map(({ id, label, url }) => ({ id, label, url }));

export const SOUND_OPTIONS: SoundOption[] = [
	{ id: 'none', label: 'None (matikan suara perayaan)' },
	{ id: 'builtin', label: 'Fanfare bawaan' },
	...CUSTOM_SOUNDS,
	...(CUSTOM_SOUNDS.length > 1 ? [{ id: 'random', label: 'Acak dari koleksi' }] : [])
];

const cache = new Map<string, HTMLAudioElement>();

function audioFor(url: string) {
	let a = cache.get(url);
	if (!a) {
		a = new Audio(url);
		a.preload = 'auto';
		cache.set(url, a);
	}
	return a;
}

/** Plays one option at the chosen volume. Used for the preview button as well. */
export function playSoundOption(id: string, volume = prefs.celebrationVolume) {
	let option = SOUND_OPTIONS.find((o) => o.id === id);
	if (id === 'random' && CUSTOM_SOUNDS.length) {
		option = CUSTOM_SOUNDS[Math.floor(Math.random() * CUSTOM_SOUNDS.length)];
	}
	if (!option || option.id === 'none') return;
	if (option.id === 'builtin') {
		playFanfare(volume);
		return;
	}
	if (!option.url) return;
	try {
		// A fresh copy lets quick completions overlap instead of cutting each other off.
		const a = audioFor(option.url).cloneNode(true) as HTMLAudioElement;
		a.volume = Math.max(0, Math.min(1, volume));
		void a.play().catch(() => {});
	} catch {
		// Audio unavailable: the tick already played.
	}
}

/** Warms the browser cache so the first celebration is not delayed. */
export function preloadCelebration() {
	const o = SOUND_OPTIONS.find((x) => x.id === prefs.celebration);
	if (o?.url) audioFor(o.url).load();
	if (prefs.celebration === 'random') CUSTOM_SOUNDS.forEach((c) => c.url && audioFor(c.url).load());
}

/**
 * The festive sound right after the "tik". Reminders never get it; with "Tugas besar saja"
 * only heavy todos and the Fokus Utama do.
 */
export function playCelebration(weight: Weight, isFocus = false) {
	if (!prefs.sound || weight === 0 || prefs.celebration === 'none') return;
	if (prefs.celebrationWhen === 'big' && weight < 3 && !isFocus) return;
	// The Fokus Utama already plays the built-in fanfare.
	if (isFocus && prefs.celebration === 'builtin') return;
	setTimeout(() => playSoundOption(prefs.celebration), 160);
}
