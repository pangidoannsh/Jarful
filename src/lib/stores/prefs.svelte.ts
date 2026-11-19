export type ThemePref = 'auto' | 'light' | 'dark';

export type CelebrationWhen = 'every' | 'big';

interface Prefs {
	sound: boolean;
	haptic: boolean;
	strike: boolean;
	theme: ThemePref;
	/** 'none', 'builtin', 'random' or 'file:<name>' from src/lib/assets/sounds. */
	celebration: string;
	celebrationVolume: number;
	celebrationWhen: CelebrationWhen;
}

const KEY = 'jarful:prefs';
const defaults: Prefs = {
	sound: true,
	haptic: true,
	strike: false,
	theme: 'auto',
	celebration: 'builtin',
	celebrationVolume: 0.7,
	celebrationWhen: 'every'
};

function load(): Prefs {
	try {
		const raw = localStorage.getItem(KEY);
		return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
	} catch {
		return { ...defaults };
	}
}

class PrefsStore {
	sound = $state(defaults.sound);
	haptic = $state(defaults.haptic);
	strike = $state(defaults.strike);
	theme = $state<ThemePref>(defaults.theme);
	celebration = $state(defaults.celebration);
	celebrationVolume = $state(defaults.celebrationVolume);
	celebrationWhen = $state<CelebrationWhen>(defaults.celebrationWhen);
	/** Bumps every minute so "auto" theme follows the clock. */
	#tick = $state(0);

	dark = $derived.by(() => {
		void this.#tick;
		if (this.theme === 'dark') return true;
		if (this.theme === 'light') return false;
		const h = new Date().getHours();
		return h >= 18 || h < 6;
	});

	init() {
		const p = load();
		this.sound = p.sound;
		this.haptic = p.haptic;
		this.strike = p.strike;
		this.theme = p.theme;
		this.celebration = p.celebration;
		this.celebrationVolume = p.celebrationVolume;
		this.celebrationWhen = p.celebrationWhen;
		setInterval(() => this.#tick++, 60_000);
	}

	save() {
		try {
			const p: Prefs = {
				sound: this.sound,
				haptic: this.haptic,
				strike: this.strike,
				theme: this.theme,
				celebration: this.celebration,
				celebrationVolume: this.celebrationVolume,
				celebrationWhen: this.celebrationWhen
			};
			localStorage.setItem(KEY, JSON.stringify(p));
		} catch {
			// Storage can be unavailable (private mode); preferences then last for this visit only.
		}
	}
}

export const prefs = new PrefsStore();
