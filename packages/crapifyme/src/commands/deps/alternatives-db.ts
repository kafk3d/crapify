import { PackageAlternative, AlternativeDatabase } from './types';
import { BundleAnalyzer } from './bundle-analyzer';

export class AlternativesEngine {
	private bundleAnalyzer: BundleAnalyzer;
	private alternativesDb: AlternativeDatabase;

	constructor() {
		this.bundleAnalyzer = new BundleAnalyzer();
		this.alternativesDb = this.initializeDatabase();
	}

	private initializeDatabase(): AlternativeDatabase {
		return {
			'moment': {
				alternatives: [
					{
						name: 'dayjs',
						description: 'Lightweight alternative to Moment.js with same modern API',
						compatibility: 'minor-changes',
						sizeSavings: { raw: 0, gzip: 0, percentage: 0 }, 
						features: ['Immutable', 'Chainable', 'I18n support', 'Plugin system'],
						migrationComplexity: 2,
						reason: '97% smaller, similar API, actively maintained'
					},
					{
						name: 'date-fns',
						description: 'Modular date utility library with tree-shaking support',
						compatibility: 'major-refactor',
						sizeSavings: { raw: 0, gzip: 0, percentage: 0 },
						features: ['Tree-shakeable', 'TypeScript support', 'Functional programming'],
						migrationComplexity: 3,
						reason: 'Better tree-shaking, modular approach, smaller bundle impact'
					}
				],
				deprecated: false
			},

			'lodash': {
				alternatives: [
					{
						name: 'lodash-es',
						description: 'ES modules version of Lodash with better tree-shaking',
						compatibility: 'drop-in',
						sizeSavings: { raw: 0, gzip: 0, percentage: 0 },
						features: ['Tree-shakeable', 'ES modules', 'Same API'],
						migrationComplexity: 1,
						reason: 'Better tree-shaking, same API, smaller bundle impact'
					},
					{
						name: 'ramda',
						description: 'Functional programming library with automatic currying',
						compatibility: 'major-refactor',
						sizeSavings: { raw: 0, gzip: 0, percentage: 0 },
						features: ['Functional programming', 'Automatic currying', 'Immutable'],
						migrationComplexity: 4,
						reason: 'Functional approach, better for complex data transformations'
					}
				],
				deprecated: false
			},

			'axios': {
				alternatives: [
					{
						name: 'fetch',
						description: 'Native browser fetch API',
						compatibility: 'minor-changes',
						sizeSavings: { raw: 0, gzip: 0, percentage: 100 },
						features: ['Native', 'Promise-based', 'Streaming support'],
						migrationComplexity: 2,
						reason: 'Native API, no bundle size, modern browsers support'
					},
					{
						name: 'ky',
						description: 'Tiny and elegant HTTP client based on fetch',
						compatibility: 'minor-changes',
						sizeSavings: { raw: 0, gzip: 0, percentage: 0 },
						features: ['Fetch-based', 'TypeScript support', 'Retry logic'],
						migrationComplexity: 2,
						reason: 'Much smaller, modern fetch-based, great TypeScript support'
					}
				],
				deprecated: false
			},

			'request': {
				alternatives: [
					{
						name: 'axios',
						description: 'Promise-based HTTP client',
						compatibility: 'minor-changes',
						sizeSavings: { raw: 0, gzip: 0, percentage: 0 },
						features: ['Promise-based', 'Request/response interceptors', 'Browser + Node.js'],
						migrationComplexity: 2,
						reason: 'Promise-based, actively maintained, better API'
					},
					{
						name: 'got',
						description: 'Human-friendly and powerful HTTP request library for Node.js',
						compatibility: 'minor-changes',
						sizeSavings: { raw: 0, gzip: 0, percentage: 0 },
						features: ['HTTP/2 support', 'TypeScript support', 'Retry logic'],
						migrationComplexity: 2,
						reason: 'Modern API, HTTP/2 support, excellent error handling'
					}
				],
				deprecated: true,
				deprecationReason: 'Package is deprecated and no longer maintained'
			},

			'uuid': {
				alternatives: [
					{
						name: 'nanoid',
						description: 'Tiny, secure, URL-safe unique string ID generator',
						compatibility: 'minor-changes',
						sizeSavings: { raw: 0, gzip: 0, percentage: 0 },
						features: ['URL-safe', 'Cryptographically strong', 'Customizable alphabet'],
						migrationComplexity: 1,
						reason: '60% smaller, URL-safe, cryptographically strong'
					},
					{
						name: 'crypto.randomUUID',
						description: 'Native Node.js/browser UUID generation',
						compatibility: 'drop-in',
						sizeSavings: { raw: 0, gzip: 0, percentage: 100 },
						features: ['Native', 'Cryptographically secure'],
						migrationComplexity: 1,
						reason: 'Native API, no bundle size, Node.js 14.17+ and modern browsers'
					}
				],
				deprecated: false
			},

			'classnames': {
				alternatives: [
					{
						name: 'clsx',
						description: 'Tiny utility for constructing className strings conditionally',
						compatibility: 'drop-in',
						sizeSavings: { raw: 0, gzip: 0, percentage: 0 },
						features: ['Smaller bundle', 'Faster performance', 'Same API'],
						migrationComplexity: 1,
						reason: '35% smaller, 2x faster, drop-in replacement'
					}
				],
				deprecated: false
			},

			'immutable': {
				alternatives: [
					{
						name: 'immer',
						description: 'Create immutable state by mutating current state',
						compatibility: 'major-refactor',
						sizeSavings: { raw: 0, gzip: 0, percentage: 0 },
						features: ['Mutable API', 'Structural sharing', 'TypeScript support'],
						migrationComplexity: 3,
						reason: 'Smaller bundle, more intuitive API, better TypeScript support'
					}
				],
				deprecated: false
			},

			'bluebird': {
				alternatives: [
					{
						name: 'native-promises',
						description: 'Native JavaScript Promise implementation',
						compatibility: 'minor-changes',
						sizeSavings: { raw: 0, gzip: 0, percentage: 100 },
						features: ['Native', 'Async/await support', 'Performance optimized'],
						migrationComplexity: 2,
						reason: 'Native implementation, no bundle size, modern JS features'
					}
				],
				deprecated: false
			},

			'left-pad': {
				alternatives: [
					{
						name: 'String.prototype.padStart',
						description: 'Native string padding method',
						compatibility: 'drop-in',
						sizeSavings: { raw: 0, gzip: 0, percentage: 100 },
						features: ['Native', 'ES2017 standard'],
						migrationComplexity: 1,
						reason: 'Native method, no bundle size, widely supported'
					}
				],
				deprecated: false
			},

			'validator': {
				alternatives: [
					{
						name: 'yup',
						description: 'Schema builder for value parsing and validation',
						compatibility: 'major-refactor',
						sizeSavings: { raw: 0, gzip: 0, percentage: 0 },
						features: ['Schema-based', 'TypeScript support', 'Composable'],
						migrationComplexity: 3,
						reason: 'Schema-based approach, better TypeScript integration'
					},
					{
						name: 'zod',
						description: 'TypeScript-first schema validation with static type inference',
						compatibility: 'major-refactor',
						sizeSavings: { raw: 0, gzip: 0, percentage: 0 },
						features: ['TypeScript-first', 'Static type inference', 'Runtime validation'],
						migrationComplexity: 3,
						reason: 'Excellent TypeScript support, type safety, growing community'
					}
				],
				deprecated: false
			}
		};
	}

	async getSuggestions(packageName: string, currentVersion: string = 'latest'): Promise<PackageAlternative[]> {
		const packageData = this.alternativesDb[packageName];
		
		if (!packageData) {
			return [];
		}

		const currentSize = await this.getSafePackageSize(packageName, currentVersion);
		const suggestions = [...packageData.alternatives];

		for (const suggestion of suggestions) {
			try {
				const alternativeSize = suggestion.name === 'fetch' || suggestion.name === 'crypto.randomUUID' || suggestion.name === 'native-promises' || suggestion.name === 'String.prototype.padStart'
					? { raw: 0, gzip: 0 }
					: await this.getSafePackageSize(suggestion.name);

				suggestion.sizeSavings = {
					raw: currentSize.raw - alternativeSize.raw,
					gzip: currentSize.gzip - alternativeSize.gzip,
					percentage: currentSize.raw > 0 ? ((currentSize.raw - alternativeSize.raw) / currentSize.raw) * 100 : 0
				};

			} catch (error) {
				console.warn(`Warning: Could not calculate size savings for ${suggestion.name}: ${(error as Error).message}`);
			}
		}

		return suggestions.sort((a, b) => b.sizeSavings.percentage - a.sizeSavings.percentage);
	}

	async getAllSuggestions(packages: string[]): Promise<Map<string, PackageAlternative[]>> {
		const suggestions = new Map<string, PackageAlternative[]>();
		
		for (const packageName of packages) {
			if (this.alternativesDb[packageName]) {
				const packageSuggestions = await this.getSuggestions(packageName);
				if (packageSuggestions.length > 0) {
					suggestions.set(packageName, packageSuggestions);
				}
			}
		}
		
		return suggestions;
	}

	private async getSafePackageSize(packageName: string, version: string = 'latest'): Promise<{ raw: number; gzip: number }> {
		try {
			const sizeInfo = await this.bundleAnalyzer.getPackageSize(packageName, version);
			return {
				raw: sizeInfo.size.raw,
				gzip: sizeInfo.size.gzip
			};
		} catch (error) {
			console.warn(`Warning: Could not get size for ${packageName}: ${(error as Error).message}`);
			return { raw: 0, gzip: 0 };
		}
	}

	getDeprecatedPackages(): string[] {
		return Object.entries(this.alternativesDb)
			.filter(([, data]) => data.deprecated)
			.map(([name]) => name);
	}

	hasAlternatives(packageName: string): boolean {
		return packageName in this.alternativesDb;
	}

	getPackageInfo(packageName: string): { deprecated: boolean; reason?: string; migrationGuide?: string } | null {
		const data = this.alternativesDb[packageName];
		if (!data) return null;
		
		return {
			deprecated: data.deprecated || false,
			reason: data.deprecationReason,
			migrationGuide: data.migrationGuide
		};
	}

	formatSuggestion(packageName: string, alternative: PackageAlternative): string {
		const compatibilityIcon = {
			'drop-in': '✅',
			'minor-changes': '🟡',
			'major-refactor': '🟠'
		}[alternative.compatibility];

		const complexityStars = '★'.repeat(alternative.migrationComplexity) + '☆'.repeat(5 - alternative.migrationComplexity);
		
		const savings = alternative.sizeSavings.percentage > 0 
			? `(-${alternative.sizeSavings.percentage.toFixed(1)}%, -${this.formatSize(alternative.sizeSavings.gzip)} gzipped)`
			: '';

		return [
			`${compatibilityIcon} ${alternative.name} ${savings}`,
			`   ${alternative.description}`,
			`   Migration: ${complexityStars} (${alternative.migrationComplexity}/5)`,
			`   Reason: ${alternative.reason}`
		].join('\n');
	}

	generateAlternativesReport(suggestions: Map<string, PackageAlternative[]>): string {
		if (suggestions.size === 0) {
			return 'No alternative suggestions available for your dependencies.';
		}

		const lines = [
			'⚡ LIGHTER ALTERNATIVES',
			'─'.repeat(60)
		];

		let totalSavings = { raw: 0, gzip: 0 };

		for (const [packageName, alternatives] of suggestions) {
			lines.push(`\n📦 ${packageName}:`);
			
			for (const alt of alternatives.slice(0, 2)) { 
				lines.push(this.formatSuggestion(packageName, alt));
				
				if (alt.sizeSavings.gzip > 0) {
					totalSavings.raw += alt.sizeSavings.raw;
					totalSavings.gzip += alt.sizeSavings.gzip;
				}
			}
		}

		if (totalSavings.gzip > 0) {
			lines.push('', '💾 POTENTIAL SAVINGS:');
			lines.push(`Total: ${this.formatSize(totalSavings.raw)} (${this.formatSize(totalSavings.gzip)} gzipped)`);
		}

		return lines.join('\n');
	}

	private formatSize(bytes: number): string {
		if (bytes === 0) return '0B';
		
		const units = ['B', 'KB', 'MB', 'GB'];
		let size = bytes;
		let unitIndex = 0;

		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}

		return `${size.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
	}

	addCustomAlternative(packageName: string, alternative: PackageAlternative): void {
		if (!this.alternativesDb[packageName]) {
			this.alternativesDb[packageName] = {
				alternatives: [],
				deprecated: false
			};
		}
		
		this.alternativesDb[packageName].alternatives.push(alternative);
	}

	getAlternativeCount(): number {
		return Object.keys(this.alternativesDb).length;
	}
}