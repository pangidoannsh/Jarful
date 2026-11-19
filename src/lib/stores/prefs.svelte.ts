export type ThemePref = 'auto' | 'light' | 'dark';

interface Prefs {
	sound: boolean;
	haptic: boolean;
	strike: boolean;
	theme: ThemePref;
}

const KEY = 'jarful:prefs';
const defaults: Prefs = { sound: true, haptic: true, strike: false, theme: 'auto' };

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
		setInterval(() => this.#tick++, 60_000);
	}

	save() {
		try {
			const p: Prefs = {
				sound: this.sound,
				haptic: this.haptic,
				strike: this.strike,
				theme: this.theme
			};
			localStorage.setItem(KEY, JSON.stringify(p));
		} catch {
			// Storage can be unavailable (private mode); preferences then last for this visit only.
		}
	}
}

export const prefs = new PrefsStore();
