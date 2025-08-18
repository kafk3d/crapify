import fs from 'fs';
import path from 'path';
import { FrameworkConfig, PathAlias } from './types';

export class FrameworkDetector {
	private projectRoot: string;
	private packageJsonCache?: any;

	constructor(projectRoot: string = process.cwd()) {
		this.projectRoot = projectRoot;
	}

	detectFramework(): FrameworkConfig | null {
		const frameworks = [
			this.detectNextJs(),
			this.detectVite(),
			this.detectSvelte(),
			this.detectVue(),
			this.detectReact(),
			this.detectAngular(),
			this.detectNuxt()
		];

		return frameworks.find(f => f !== null) || null;
	}

	getFrameworkByName(name: string): FrameworkConfig | null {
		const normalizedName = name.toLowerCase();

		switch (normalizedName) {
			case 'nextjs':
			case 'next':
				return this.createNextJsConfig();
			case 'vite':
				return this.createViteConfig();
			case 'svelte':
			case 'sveltekit':
				return this.createSvelteConfig();
			case 'vue':
			case 'vuejs':
				return this.createVueConfig();
			case 'react':
				return this.createReactConfig();
			case 'angular':
				return this.createAngularConfig();
			case 'nuxt':
				return this.createNuxtConfig();
			default:
				return null;
		}
	}

	private detectNextJs(): FrameworkConfig | null {
		const indicators = ['next.config.js', 'next.config.ts', 'next.config.mjs'];

		if (this.hasAnyFile(indicators) || this.hasDependency('next')) {
			return this.createNextJsConfig();
		}

		return null;
	}

	private detectVite(): FrameworkConfig | null {
		const indicators = ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'];

		if (this.hasAnyFile(indicators) || this.hasDependency('vite')) {
			return this.createViteConfig();
		}

		return null;
	}

	private detectSvelte(): FrameworkConfig | null {
		const indicators = ['svelte.config.js', 'svelte.config.ts'];

		if (
			this.hasAnyFile(indicators) ||
			this.hasDependency('svelte') ||
			this.hasDependency('@sveltejs/kit')
		) {
			return this.createSvelteConfig();
		}

		return null;
	}

	private detectVue(): FrameworkConfig | null {
		const indicators = ['vue.config.js', 'vue.config.ts'];

		if (
			this.hasAnyFile(indicators) ||
			this.hasDependency('vue') ||
			this.hasDependency('@vue/cli-service')
		) {
			return this.createVueConfig();
		}

		return null;
	}

	private detectReact(): FrameworkConfig | null {
		if (this.hasDependency('react') || this.hasDependency('create-react-app')) {
			return this.createReactConfig();
		}

		return null;
	}

	private detectAngular(): FrameworkConfig | null {
		const indicators = ['angular.json', 'angular-cli.json'];

		if (this.hasAnyFile(indicators) || this.hasDependency('@angular/core')) {
			return this.createAngularConfig();
		}

		return null;
	}

	private detectNuxt(): FrameworkConfig | null {
		const indicators = ['nuxt.config.js', 'nuxt.config.ts'];

		if (this.hasAnyFile(indicators) || this.hasDependency('nuxt')) {
			return this.createNuxtConfig();
		}

		return null;
	}

	private createNextJsConfig(): FrameworkConfig {
		const aliases: PathAlias[] = [
			{
				pattern: '@/*',
				replacement: './src/*',
				regex: /^@\/(.*)/
			},
			{
				pattern: '~/*',
				replacement: './*',
				regex: /^~\/(.*)/
			}
		];

		const nextConfigPath = this.findNextConfig();
		if (nextConfigPath) {
			const customAliases = this.parseNextConfig(nextConfigPath);
			aliases.push(...customAliases);
		}

		return {
			name: 'Next.js',
			aliases,
			importExtensions: ['.js', '.jsx', '.ts', '.tsx'],
			specialPatterns: [/^next\//, /^react/, /^@next\//]
		};
	}

	private createViteConfig(): FrameworkConfig {
		const aliases: PathAlias[] = [
			{
				pattern: '@/*',
				replacement: './src/*',
				regex: /^@\/(.*)/
			},
			{
				pattern: '~/*',
				replacement: './*',
				regex: /^~\/(.*)/
			}
		];

		return {
			name: 'Vite',
			aliases,
			importExtensions: ['.js', '.jsx', '.ts', '.tsx', '.vue'],
			specialPatterns: [/^vite/, /^\?/, /^virtual:/]
		};
	}

	private createSvelteConfig(): FrameworkConfig {
		return {
			name: 'Svelte',
			aliases: [
				{
					pattern: '$lib/*',
					replacement: './src/lib/*',
					regex: /^\$lib\/(.*)/
				},
				{
					pattern: '$app/*',
					replacement: '@sveltejs/kit/app/*',
					regex: /^\$app\/(.*)/
				}
			],
			importExtensions: ['.js', '.ts', '.svelte'],
			specialPatterns: [/^svelte/, /^\$lib/, /^\$app/, /^\$env/]
		};
	}

	private createVueConfig(): FrameworkConfig {
		return {
			name: 'Vue',
			aliases: [
				{
					pattern: '@/*',
					replacement: './src/*',
					regex: /^@\/(.*)/
				}
			],
			importExtensions: ['.js', '.ts', '.vue'],
			specialPatterns: [/^vue/, /^@vue\//]
		};
	}

	private createReactConfig(): FrameworkConfig {
		return {
			name: 'React',
			aliases: [
				{
					pattern: '@/*',
					replacement: './src/*',
					regex: /^@\/(.*)/
				}
			],
			importExtensions: ['.js', '.jsx', '.ts', '.tsx'],
			specialPatterns: [/^react/, /^@react\//]
		};
	}

	private createAngularConfig(): FrameworkConfig {
		return {
			name: 'Angular',
			aliases: [
				{
					pattern: '@/*',
					replacement: './src/*',
					regex: /^@\/(.*)/
				},
				{
					pattern: '@environments/*',
					replacement: './src/environments/*',
					regex: /^@environments\/(.*)/
				}
			],
			importExtensions: ['.js', '.ts'],
			specialPatterns: [/^@angular\//, /^rxjs/]
		};
	}

	private createNuxtConfig(): FrameworkConfig {
		return {
			name: 'Nuxt',
			aliases: [
				{
					pattern: '~/*',
					replacement: './*',
					regex: /^~\/(.*)/
				},
				{
					pattern: '@/*',
					replacement: './*',
					regex: /^@\/(.*)/
				},
				{
					pattern: '~~/*',
					replacement: './*',
					regex: /^~~\/(.*)/
				},
				{
					pattern: '@@/*',
					replacement: './*',
					regex: /^@@\/(.*)/
				}
			],
			importExtensions: ['.js', '.ts', '.vue'],
			specialPatterns: [/^nuxt/, /^@nuxt\//, /^vue/]
		};
	}

	private hasAnyFile(filenames: string[]): boolean {
		return filenames.some(filename => fs.existsSync(path.join(this.projectRoot, filename)));
	}

	private hasDependency(packageName: string): boolean {
		const packageJson = this.getPackageJson();
		if (!packageJson) return false;

		return !!(
			packageJson.dependencies?.[packageName] ||
			packageJson.devDependencies?.[packageName] ||
			packageJson.peerDependencies?.[packageName]
		);
	}

	private getPackageJson(): any {
		if (this.packageJsonCache) {
			return this.packageJsonCache;
		}

		const packageJsonPath = path.join(this.projectRoot, 'package.json');

		if (fs.existsSync(packageJsonPath)) {
			try {
				this.packageJsonCache = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
				return this.packageJsonCache;
			} catch (error) {
				console.warn(`Warning: Could not parse package.json: ${(error as Error).message}`);
			}
		}

		return null;
	}

	private findNextConfig(): string | null {
		const possibleConfigs = ['next.config.js', 'next.config.ts', 'next.config.mjs'];

		for (const config of possibleConfigs) {
			const configPath = path.join(this.projectRoot, config);
			if (fs.existsSync(configPath)) {
				return configPath;
			}
		}

		return null;
	}

	private parseNextConfig(configPath: string): PathAlias[] {
		const aliases: PathAlias[] = [];

		try {
			const configContent = fs.readFileSync(configPath, 'utf-8');

			const aliasMatches = configContent.match(/resolve:\s*{[\s\S]*?alias:\s*{([\s\S]*?)}/);
			if (aliasMatches && aliasMatches[1]) {
				const aliasContent = aliasMatches[1];
				const aliasLines = aliasContent.split(',');

				for (const line of aliasLines) {
					const match = line.match(/['"`]([^'"`]+)['"`]\s*:\s*['"`]([^'"`]+)['"`]/);
					if (match) {
						aliases.push({
							pattern: match[1],
							replacement: match[2],
							regex: new RegExp(
								`^${match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '(.*)')}`
							)
						});
					}
				}
			}
		} catch (error) {
			console.warn(`Warning: Could not parse Next.js config: ${(error as Error).message}`);
		}

		return aliases;
	}
}
