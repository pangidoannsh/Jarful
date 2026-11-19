/** Firebase Auth needs an email, so each username maps to an internal address users never see. */
export const USERNAME_DOMAIN = 'jarful.app';

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,24}$/;

export function normalizeUsername(input: string) {
	return input.trim().toLowerCase();
}

export function usernameToEmail(username: string) {
	return `${normalizeUsername(username)}@${USERNAME_DOMAIN}`;
}

export function emailToUsername(email: string | null | undefined) {
	if (!email) return '';
	return email.endsWith(`@${USERNAME_DOMAIN}`) ? email.slice(0, -USERNAME_DOMAIN.length - 1) : email;
}
