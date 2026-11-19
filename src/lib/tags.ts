/** Categories come from #tags. Each tag keeps one marble colour, so the jar shows where the day went. */
const PRESET: Record<string, number> = {
	kerja: 5,
	belajar: 4,
	sehat: 6,
	olahraga: 6,
	rumah: 2,
	keluarga: 3,
	ibadah: 7,
	keuangan: 8
};

export const DEFAULT_TAGS = ['kerja', 'belajar', 'sehat', 'rumah'];

export function tagColor(tag: string) {
	const t = tag.toLowerCase();
	if (PRESET[t]) return PRESET[t];
	let h = 0;
	for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
	return (Math.abs(h) % 8) + 1;
}

const RECENT_KEY = 'jarful:tags';

export function recentTags(): string[] {
	try {
		const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
		return [...new Set([...list, ...DEFAULT_TAGS])].slice(0, 12);
	} catch {
		return DEFAULT_TAGS;
	}
}

export function rememberTag(tag: string) {
	try {
		const list = recentTags().filter((t) => t !== tag);
		localStorage.setItem(RECENT_KEY, JSON.stringify([tag, ...list].slice(0, 12)));
	} catch {
		// Storage unavailable: suggestions fall back to the defaults.
	}
}
