export const DEFAULT_IGNORE_PATTERNS = [
	'**/node_modules/**',

	'**/dist/**',
	'**/build/**',
	'**/bundle/**',
	'**/out/**',

	'**/static/**',
	'**/public/build/**',

	'**.min.js',
	'**.min.css',

	'**/.next/**',
	'**/.nuxt/**',
	'**/.svelte-kit/**',
	'**/target/**',

	'**/.cache/**',
	'**/tmp/**',
	'**/temp/**',

	'**/coverage/**',
	'**/.nyc_output/**',

	'**/.git/**',
	'**/.svn/**',
	'**/.hg/**'
] as const;

export function getIgnorePatterns(userPatterns: string[] = []): string[] {
	return [...DEFAULT_IGNORE_PATTERNS, ...userPatterns];
}
