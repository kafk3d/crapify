import https from 'https';
import { promisify } from 'util';
import { BundleAnalysis, DependencyInfo } from './types';

interface BundlephobiaResponse {
	name: string;
	version: string;
	size: number;
	gzip: number;
	description?: string;
	repository?: string;
	dependencyCount: number;
	hasJSNext?: boolean;
	hasJSModule?: boolean;
	hasSideEffects?: boolean;
	isModuleType?: boolean;
	scoped?: boolean;
}

interface PackageSize {
	name: string;
	size: {
		raw: number;
		gzip: number;
		formatted: {
			raw: string;
			gzip: string;
		};
	};
	treeshakeable: boolean;
	sideEffects: boolean;
}

export class BundleAnalyzer {
	private cache = new Map<string, BundlephobiaResponse>();
	private cacheTimeout: number;
	private requestTimeout: number;

	constructor(cacheTimeout: number = 3600000, requestTimeout: number = 10000) {
		this.cacheTimeout = cacheTimeout;
		this.requestTimeout = requestTimeout;
	}

	async analyzeBundleSize(dependencies: Map<string, DependencyInfo>): Promise<BundleAnalysis> {
		const packageSizes = new Map<string, PackageSize>();
		const heavyPackageThreshold = 100 * 1024; 
		
		const packages = Array.from(dependencies.entries())
			.filter(([, dep]) => !dep.isDev) 
			.map(([name, dep]) => ({ name, version: this.parseVersion(dep.currentVersion) }));

		if (packages.length > 0) {
			process.stdout.write(`Analyzing bundle sizes for ${packages.length} packages`);
			const animateTimer = setInterval(() => {
				process.stdout.write('.');
			}, 1000);

			for (let i = 0; i < packages.length; i++) {
				const pkg = packages[i];
				
				try {
					const sizeInfo = await this.getPackageSize(pkg.name, pkg.version);
					packageSizes.set(pkg.name, sizeInfo);
					
					// Minimal delay to be nice to npm registry
					await this.delay(100);
					
				} catch (error) {
					// Npm registry failures are rare, but handle gracefully
					if (i < 3) { // Only warn for first few failures
						console.warn(`\nWarning: Could not get size for ${pkg.name}: ${(error as Error).message}`);
					}
				}
			}

			clearInterval(animateTimer);
			process.stdout.write('\n');
		}

		const totalRawSize = Array.from(packageSizes.values())
			.reduce((sum, pkg) => sum + pkg.size.raw, 0);
		
		const totalGzipSize = Array.from(packageSizes.values())
			.reduce((sum, pkg) => sum + pkg.size.gzip, 0);

		const largestPackages = Array.from(packageSizes.values())
			.sort((a, b) => b.size.raw - a.size.raw)
			.slice(0, 20)
			.map(pkg => ({
				name: pkg.name,
				size: {
					raw: pkg.size.raw,
					gzip: pkg.size.gzip,
					percentage: totalRawSize > 0 ? (pkg.size.raw / totalRawSize) * 100 : 0
				}
			}));

		const treeshakeable = Array.from(packageSizes.values())
			.filter(pkg => pkg.treeshakeable)
			.map(pkg => pkg.name);

		const nonTreeshakeable = Array.from(packageSizes.values())
			.filter(pkg => !pkg.treeshakeable && pkg.size.raw > heavyPackageThreshold)
			.map(pkg => pkg.name);

		const sideEffects = Array.from(packageSizes.values())
			.filter(pkg => pkg.sideEffects)
			.map(pkg => pkg.name);

		return {
			totalSize: {
				raw: totalRawSize,
				gzip: totalGzipSize,
				formatted: {
					raw: this.formatSize(totalRawSize),
					gzip: this.formatSize(totalGzipSize)
				}
			},
			largestPackages,
			treeshakeable,
			nonTreeshakeable,
			sideEffects
		};
	}

	async getPackageSize(packageName: string, version: string = 'latest'): Promise<PackageSize> {
		const cacheKey = `${packageName}@${version}`;
		
		if (this.cache.has(cacheKey)) {
			const cached = this.cache.get(cacheKey)!;
			if (Date.now() - (cached as any).cachedAt < this.cacheTimeout) {
				return this.formatPackageSize(cached);
			}
		}

		const data = await this.fetchFromNpmRegistry(packageName, version);
		(data as any).cachedAt = Date.now();
		this.cache.set(cacheKey, data);
		
		return this.formatPackageSize(data);
	}

	private async fetchFromNpmRegistry(packageName: string, version: string): Promise<BundlephobiaResponse> {
		const cleanVersion = version.replace(/^[\^~]/, '').split(' ')[0]; // Handle complex version ranges
		const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
		
		return new Promise((resolve, reject) => {
			const req = https.get(url, { timeout: this.requestTimeout }, (res) => {
				if (res.statusCode !== 200) {
					reject(new Error(`Package not found: ${res.statusCode}`));
					return;
				}

				let data = '';
				res.on('data', chunk => data += chunk);
				res.on('end', () => {
					try {
						const packageData = JSON.parse(data);
						
						// Get the specific version or latest
						let versionData;
						if (cleanVersion === 'latest' || !cleanVersion) {
							const latestVersion = packageData['dist-tags']?.latest;
							versionData = packageData.versions?.[latestVersion];
						} else {
							versionData = packageData.versions?.[cleanVersion] || 
										 packageData.versions?.[packageData['dist-tags']?.latest];
						}
						
						if (!versionData) {
							reject(new Error('Version not found'));
							return;
						}

						// Estimate actual bundle size (not unpacked source size)
						const bundleSize = this.estimateBundleSize(versionData, packageName);
						
						// Estimate gzipped size (typically 25-35% of bundled size)
						const estimatedGzipSize = Math.floor(bundleSize * 0.3);

						// Check for ES module support
						const hasESM = !!(versionData.module || 
										versionData.exports || 
										versionData.type === 'module');
						
						// Check for side effects
						const hasSideEffects = versionData.sideEffects !== false;

						resolve({
							name: packageName,
							version: versionData.version,
							size: bundleSize,
							gzip: estimatedGzipSize,
							description: versionData.description,
							dependencyCount: Object.keys(versionData.dependencies || {}).length,
							hasJSNext: hasESM,
							hasJSModule: hasESM,
							hasSideEffects,
							isModuleType: versionData.type === 'module'
						});

					} catch (error) {
						reject(new Error('Failed to parse npm registry response'));
					}
				});
			});

			req.on('timeout', () => {
				req.destroy();
				reject(new Error('Request timeout'));
			});

			req.on('error', (error) => {
				reject(new Error(`Network error: ${error.message}`));
			});
		});
	}

	private formatPackageSize(data: BundlephobiaResponse): PackageSize {
		return {
			name: data.name,
			size: {
				raw: data.size,
				gzip: data.gzip,
				formatted: {
					raw: this.formatSize(data.size),
					gzip: this.formatSize(data.gzip)
				}
			},
			treeshakeable: data.hasJSNext || data.hasJSModule || data.isModuleType || false,
			sideEffects: data.hasSideEffects || false
		};
	}

	async estimateProjectBundleSize(dependencies: Map<string, DependencyInfo>): Promise<{
		estimated: { raw: number; gzip: number };
		breakdown: Array<{ name: string; size: { raw: number; gzip: number }; percentage: number }>;
	}> {
		const analysis = await this.analyzeBundleSize(dependencies);
		
		const breakdown = analysis.largestPackages.map(pkg => ({
			name: pkg.name,
			size: {
				raw: pkg.size.raw,
				gzip: pkg.size.gzip
			},
			percentage: pkg.size.percentage
		}));

		return {
			estimated: {
				raw: analysis.totalSize.raw,
				gzip: analysis.totalSize.gzip
			},
			breakdown
		};
	}

	async comparePackageSizes(packages: string[]): Promise<Array<{
		name: string;
		size: { raw: number; gzip: number };
		formatted: { raw: string; gzip: string };
		treeshakeable: boolean;
		sideEffects: boolean;
	}>> {
		const results = [];
		
		for (const pkg of packages) {
			try {
				const sizeInfo = await this.getPackageSize(pkg);
				results.push({
					name: pkg,
					size: sizeInfo.size,
					formatted: sizeInfo.size.formatted,
					treeshakeable: sizeInfo.treeshakeable,
					sideEffects: sizeInfo.sideEffects
				});
				
				await this.delay(300);
				
			} catch (error) {
				console.warn(`Warning: Failed to get size for ${pkg}: ${(error as Error).message}`);
			}
		}
		
		return results.sort((a, b) => b.size.raw - a.size.raw);
	}

	getSizeDifference(currentSize: number, newSize: number): {
		absolute: number;
		percentage: number;
		formatted: string;
	} {
		const absolute = newSize - currentSize;
		const percentage = currentSize > 0 ? (absolute / currentSize) * 100 : 0;
		
		const sign = absolute > 0 ? '+' : '';
		const formattedAbsolute = this.formatSize(Math.abs(absolute));
		const formattedPercentage = percentage.toFixed(1);
		
		return {
			absolute,
			percentage,
			formatted: `${sign}${formattedAbsolute} (${sign}${formattedPercentage}%)`
		};
	}

	identifyHeavyPackages(dependencies: Map<string, DependencyInfo>, threshold: number = 100 * 1024): Promise<string[]> {
		return this.analyzeBundleSize(dependencies).then(analysis => 
			analysis.largestPackages
				.filter(pkg => pkg.size.raw > threshold)
				.map(pkg => pkg.name)
		);
	}

	generateSizeReport(analysis: BundleAnalysis): string {
		const lines = [
			'📊 BUNDLE SIZE ANALYSIS',
			'─'.repeat(50),
			`Total Bundle Size: ${analysis.totalSize.formatted.raw} (${analysis.totalSize.formatted.gzip} gzipped)`,
			'',
			'🔝 LARGEST PACKAGES:',
		];

		analysis.largestPackages.slice(0, 10).forEach((pkg, index) => {
			lines.push(
				`${(index + 1).toString().padStart(2)}. ${pkg.name.padEnd(25)} ${pkg.size.raw.toString().padStart(8)} bytes (${pkg.size.percentage.toFixed(1)}%)`
			);
		});

		if (analysis.treeshakeable.length > 0) {
			lines.push('', '🌳 TREE-SHAKEABLE:', analysis.treeshakeable.slice(0, 5).join(', '));
		}

		if (analysis.nonTreeshakeable.length > 0) {
			lines.push('', '⚠️  NON-TREE-SHAKEABLE:', analysis.nonTreeshakeable.slice(0, 5).join(', '));
		}

		if (analysis.sideEffects.length > 0) {
			lines.push('', '⚡ HAS SIDE EFFECTS:', analysis.sideEffects.slice(0, 5).join(', '));
		}

		return lines.join('\n');
	}

	private parseVersion(version: string): string {
		return version.replace(/^[\^~>=<]/, '').split(' ')[0];
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

	private estimateBundleSize(versionData: any, packageName: string): number {
		// Get the unpacked size as baseline
		const unpackedSize = versionData.dist?.unpackedSize || 0;
		
		// Package-specific size adjustments based on known patterns
		const sizeMultipliers: Record<string, number> = {
			// Large UI frameworks
			'react': 0.015,
			'vue': 0.02, 
			'angular': 0.01,
			'svelte': 0.05,
			
			// Large utility libraries
			'lodash': 0.04,
			'moment': 0.02,
			'dayjs': 0.08,
			'date-fns': 0.06,
			
			// Graphics/Canvas libraries
			'pixi.js': 0.03,
			'three': 0.02,
			'@rive-app/canvas': 0.04,
			
			// Map libraries
			'leaflet': 0.05,
			'mapbox-gl': 0.02,
			
			// Icon libraries
			'@lucide/svelte': 0.15,
			'@heroicons/react': 0.2,
			
			// Small utilities
			'msgpackr': 0.1,
			'@thumbmarkjs/thumbmarkjs': 0.3,
			
			// Language tools
			'@inlang/paraglide-js': 0.2,
			'@inlang/paraglide-sveltekit': 0.15
		};
		
		// Default multiplier for unknown packages
		let multiplier = 0.08; // 8% of unpacked size is typical for bundled JS
		
		// Check for exact matches first
		if (sizeMultipliers[packageName]) {
			multiplier = sizeMultipliers[packageName];
		} else {
			// Pattern-based matching
			if (packageName.includes('types/')) {
				return 0; // TypeScript definitions don't contribute to bundle
			} else if (packageName.includes('icon') || packageName.includes('lucide')) {
				multiplier = 0.15; // Icon packages are typically smaller when tree-shaken
			} else if (packageName.includes('babel') || packageName.includes('eslint')) {
				return 0; // Build tools don't contribute to bundle
			} else if (packageName.includes('util') || packageName.includes('helper')) {
				multiplier = 0.12; // Utility packages are usually smaller
			} else if (packageName.startsWith('@types/')) {
				return 0; // TypeScript definitions
			}
		}
		
		// Minimum reasonable size for any package
		const estimatedSize = Math.max(unpackedSize * multiplier, 1024); // At least 1KB
		
		// Cap maximum size to prevent outliers
		return Math.min(estimatedSize, 2 * 1024 * 1024); // Max 2MB per package
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	clearCache(): void {
		this.cache.clear();
	}

	getCacheStats(): { size: number; entries: string[] } {
		return {
			size: this.cache.size,
			entries: Array.from(this.cache.keys())
		};
	}
}