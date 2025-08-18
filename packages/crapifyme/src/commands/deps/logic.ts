import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
	DepsProcessorOptions,
	DepsAnalysisResult,
	ProjectAnalysis,
	DependencyInfo,
	AnalysisType,
	DependencyType,
	DepsStats
} from './types';
import { PackageAnalyzer } from './package-analyzer';
import { SecurityScanner } from './security-scanner';
import { BundleAnalyzer } from './bundle-analyzer';
import { AlternativesEngine } from './alternatives-db';

const execAsync = promisify(exec);

export class DepsProcessor {
	private cwd: string;
	private options: Required<DepsProcessorOptions>;
	private packageAnalyzer: PackageAnalyzer;
	private securityScanner: SecurityScanner;
	private bundleAnalyzer: BundleAnalyzer;
	private alternativesEngine: AlternativesEngine;

	constructor(options: DepsProcessorOptions = {}, cwd: string = process.cwd()) {
		this.cwd = cwd;
		this.options = {
			packageManager: 'auto',
			includeDevDependencies: true,
			includePeerDependencies: false,
			includeOptionalDependencies: false,
			checkSecurity: true,
			analyzeBundleSize: true,
			suggestAlternatives: true,
			checkUnused: true,
			workspaces: false,
			timeout: 120000,
			cacheTimeout: 3600000,
			verbose: false,
			...options
		};

		this.packageAnalyzer = new PackageAnalyzer(cwd);
		this.securityScanner = new SecurityScanner(cwd, this.options.timeout);
		this.bundleAnalyzer = new BundleAnalyzer(this.options.cacheTimeout);
		this.alternativesEngine = new AlternativesEngine();
	}

	async analyzeProject(
		analysisTypes: AnalysisType[] = [AnalysisType.FULL]
	): Promise<DepsAnalysisResult> {
		const startTime = Date.now();
		const errors: DepsAnalysisResult['errors'] = [];
		const warnings: DepsAnalysisResult['warnings'] = [];

		try {
			if (this.options.verbose) {
				console.log('🔍 Starting dependency analysis...');
			}

			const packageManager = await this.packageAnalyzer.detectPackageManager();
			const packageJson = await this.packageAnalyzer.readPackageJson();

			if (this.options.verbose) {
				console.log(
					`📦 Detected package manager: ${packageManager.type} ${packageManager.version}`
				);
				console.log(`📋 Project: ${packageJson.name} v${packageJson.version}`);
			}

			const projectAnalysis: ProjectAnalysis = {
				projectInfo: {
					name: packageJson.name,
					version: packageJson.version,
					path: this.cwd,
					packageManager
				},
				dependencies: {
					production: [],
					development: [],
					peer: [],
					optional: []
				},
				summary: {
					total: { production: 0, development: 0, peer: 0, optional: 0 },
					outdated: 0,
					vulnerable: 0,
					unused: 0,
					duplicates: 0,
					heavyPackages: 0
				},
				security: {
					vulnerabilities: [],
					auditSummary: { critical: 0, high: 0, moderate: 0, low: 0 }
				},
				bundle: {
					totalSize: { raw: 0, gzip: 0, formatted: { raw: '0B', gzip: '0B' } },
					largestPackages: [],
					treeshakeable: [],
					nonTreeshakeable: [],
					sideEffects: []
				},
				alternatives: new Map(),
				unusedDependencies: [],
				duplicateDependencies: new Map()
			};

			const shouldAnalyze = (type: AnalysisType) =>
				analysisTypes.includes(AnalysisType.FULL) || analysisTypes.includes(type);

			const dependencies = await this.packageAnalyzer.getInstalledDependencies();
			this.categorizeDependencies(dependencies, projectAnalysis);

			if (shouldAnalyze(AnalysisType.SECURITY) && this.options.checkSecurity) {
				if (this.options.verbose) {
					process.stdout.write('🔒 Checking security vulnerabilities');
					const timer = setInterval(() => process.stdout.write('.'), 800);
					setTimeout(() => { clearInterval(timer); process.stdout.write('\n'); }, 2000);
				}
				await this.analyzeSecurity(projectAnalysis, errors);
			}

			if (shouldAnalyze(AnalysisType.SIZE) && this.options.analyzeBundleSize) {
				if (this.options.verbose) console.log('📊 Analyzing bundle sizes...');
				await this.analyzeBundleSize(projectAnalysis, errors);
			}

			if (shouldAnalyze(AnalysisType.ALTERNATIVES) && this.options.suggestAlternatives) {
				if (this.options.verbose) {
					process.stdout.write('⚡ Finding lighter alternatives');
					const timer = setInterval(() => process.stdout.write('.'), 600);
					setTimeout(() => { clearInterval(timer); process.stdout.write('\n'); }, 1500);
				}
				await this.analyzeAlternatives(projectAnalysis, warnings);
			}

			if (shouldAnalyze(AnalysisType.DUPLICATES)) {
				if (this.options.verbose) console.log('🔍 Checking for duplicate dependencies...');
				await this.analyzeDuplicates(projectAnalysis, warnings);
			}

			if (shouldAnalyze(AnalysisType.UNUSED) && this.options.checkUnused) {
				if (this.options.verbose) console.log('🧹 Finding unused dependencies...');
				await this.analyzeUnused(projectAnalysis, warnings);
			}

			this.calculateSummary(projectAnalysis);

			return {
				analysis: projectAnalysis,
				errors,
				warnings,
				processingTime: Date.now() - startTime,
				cacheMisses: 0, // TODO: Implement cache metrics
				cacheHits: 0
			};
		} catch (error) {
			errors.push({
				type: 'general',
				message: `Fatal error during analysis: ${(error as Error).message}`
			});

			throw error;
		}
	}

	private categorizeDependencies(
		dependencies: Map<string, DependencyInfo>,
		analysis: ProjectAnalysis
	): void {
		for (const [name, dep] of dependencies) {
			if (dep.isPeer) {
				analysis.dependencies.peer.push(dep);
			} else if (dep.isOptional) {
				analysis.dependencies.optional.push(dep);
			} else if (dep.isDev) {
				analysis.dependencies.development.push(dep);
			} else {
				analysis.dependencies.production.push(dep);
			}
		}

		analysis.summary.total = {
			production: analysis.dependencies.production.length,
			development: analysis.dependencies.development.length,
			peer: analysis.dependencies.peer.length,
			optional: analysis.dependencies.optional.length
		};
	}

	private async analyzeSecurity(
		analysis: ProjectAnalysis,
		errors: DepsAnalysisResult['errors']
	): Promise<void> {
		try {
			const securityResult = await this.securityScanner.scanVulnerabilities(
				analysis.projectInfo.packageManager
			);

			analysis.security.vulnerabilities = securityResult.vulnerabilities;
			analysis.security.auditSummary = securityResult.summary;

			const allDependencies = [
				...analysis.dependencies.production,
				...(this.options.includeDevDependencies ? analysis.dependencies.development : [])
			];

			const deprecationChecks = await this.securityScanner.batchCheckVulnerabilities(
				allDependencies.map(dep => ({ name: dep.name, version: dep.currentVersion }))
			);

			for (const [packageName, vulns] of deprecationChecks) {
				analysis.security.vulnerabilities.push(...vulns);
			}
		} catch (error) {
			errors.push({
				type: 'security',
				message: `Security analysis failed: ${(error as Error).message}`
			});
		}
	}

	private async analyzeBundleSize(
		analysis: ProjectAnalysis,
		errors: DepsAnalysisResult['errors']
	): Promise<void> {
		try {
			const productionDeps = new Map(analysis.dependencies.production.map(dep => [dep.name, dep]));

			const bundleAnalysis = await this.bundleAnalyzer.analyzeBundleSize(productionDeps);
			analysis.bundle = bundleAnalysis;

			for (const dep of analysis.dependencies.production) {
				const largePackage = bundleAnalysis.largestPackages.find(pkg => pkg.name === dep.name);
				if (largePackage) {
					dep.size = {
						raw: largePackage.size.raw,
						gzip: largePackage.size.gzip,
						formatted: {
							raw: this.formatSize(largePackage.size.raw),
							gzip: this.formatSize(largePackage.size.gzip)
						}
					};
				}
			}
		} catch (error) {
			errors.push({
				type: 'size',
				message: `Bundle size analysis failed: ${(error as Error).message}`
			});
		}
	}

	private async analyzeAlternatives(
		analysis: ProjectAnalysis,
		warnings: DepsAnalysisResult['warnings']
	): Promise<void> {
		try {
			const allDependencies = [
				...analysis.dependencies.production,
				...(this.options.includeDevDependencies ? analysis.dependencies.development : [])
			].map(dep => dep.name);

			analysis.alternatives = await this.alternativesEngine.getAllSuggestions(allDependencies);

			const deprecatedPackages = this.alternativesEngine.getDeprecatedPackages();
			for (const depPackage of deprecatedPackages) {
				const hasPackage = allDependencies.includes(depPackage);
				if (hasPackage) {
					warnings.push({
						type: 'deprecation',
						message: `Package ${depPackage} is deprecated`,
						package: depPackage
					});
				}
			}
		} catch (error) {
			warnings.push({
				type: 'compatibility',
				message: `Alternatives analysis failed: ${(error as Error).message}`
			});
		}
	}

	private async analyzeDuplicates(
		analysis: ProjectAnalysis,
		warnings: DepsAnalysisResult['warnings']
	): Promise<void> {
		try {
			analysis.duplicateDependencies = await this.packageAnalyzer.findDuplicateDependencies();

			for (const [packageName, versions] of analysis.duplicateDependencies) {
				if (versions.length > 1) {
					warnings.push({
						type: 'performance',
						message: `Duplicate versions found: ${versions.join(', ')}`,
						package: packageName
					});
				}
			}
		} catch (error) {
			warnings.push({
				type: 'performance',
				message: `Duplicate analysis failed: ${(error as Error).message}`
			});
		}
	}

	private async analyzeUnused(
		analysis: ProjectAnalysis,
		warnings: DepsAnalysisResult['warnings']
	): Promise<void> {
		try {
			analysis.unusedDependencies = await this.findUnusedDependencies();

			for (const unusedPkg of analysis.unusedDependencies) {
				const dep = [
					...analysis.dependencies.production,
					...analysis.dependencies.development
				].find(d => d.name === unusedPkg);

				if (dep) {
					dep.unusedReason = 'Not imported in source code';
					warnings.push({
						type: 'performance',
						message: 'Package appears to be unused',
						package: unusedPkg
					});
				}
			}
		} catch (error) {
			warnings.push({
				type: 'performance',
				message: `Unused dependencies analysis failed: ${(error as Error).message}`
			});
		}
	}

	private async findUnusedDependencies(): Promise<string[]> {
		try {
			const { stdout } = await execAsync('npx depcheck --json', {
				cwd: this.cwd,
				timeout: this.options.timeout
			});

			const depcheckResult = JSON.parse(stdout);
			return depcheckResult.dependencies || [];
		} catch (error) {
			if (this.options.verbose) {
				console.warn(
					'Note: Install depcheck to analyze unused dependencies: npm install -g depcheck'
				);
			}
			return [];
		}
	}

	private calculateSummary(analysis: ProjectAnalysis): void {
		const allDeps = [
			...analysis.dependencies.production,
			...analysis.dependencies.development,
			...analysis.dependencies.peer,
			...analysis.dependencies.optional
		];

		analysis.summary.outdated = allDeps.filter(dep => dep.isOutdated).length;
		analysis.summary.vulnerable = analysis.security.vulnerabilities.length;
		analysis.summary.unused = analysis.unusedDependencies.length;
		analysis.summary.duplicates = analysis.duplicateDependencies.size;
		analysis.summary.heavyPackages = analysis.bundle.largestPackages.filter(
			pkg => pkg.size.raw > 100 * 1024
		).length;
	}

	async generateReport(analysis: ProjectAnalysis): Promise<string> {
		const lines = [
			'',
			'📦 DEPENDENCY ANALYSIS',
			'┌─────────────────────────────────────────────┐',
			`│ Project: ${analysis.projectInfo.name.padEnd(33)} │`,
			`│ Dependencies: ${analysis.summary.total.production.toString().padStart(2)} production, ${analysis.summary.total.development.toString().padStart(2)} dev         │`,
			`│ Total Bundle Size: ${analysis.bundle.totalSize.formatted.raw.padEnd(6)} (${analysis.bundle.totalSize.formatted.gzip.padEnd(6)} gzipped)    │`,
			`│ Package Manager: ${analysis.projectInfo.packageManager.type} v${analysis.projectInfo.packageManager.version.padEnd(14)} │`,
			'└─────────────────────────────────────────────┘',
			''
		];

		if (analysis.security.vulnerabilities.length > 0) {
			lines.push('🚨 SECURITY ISSUES');
			lines.push('┌─────────────────────┬──────────┬────────────────┐');
			lines.push('│ Package             │ Severity │ Recommendation │');
			lines.push('├─────────────────────┼──────────┼────────────────┤');

			const displayVulns = analysis.security.vulnerabilities.slice(0, 5);
			for (const vuln of displayVulns) {
				// Try to extract package name from title, description, or use id
				let pkgName = 'unknown';
				
				// Try title first word
				if (vuln.title) {
					const titleParts = vuln.title.toLowerCase().split(' ');
					// Look for common package name patterns
					for (const part of titleParts) {
						if (part.match(/^[a-z][a-z0-9-_.]*[a-z0-9]$/)) {
							pkgName = part;
							break;
						}
					}
				}
				
				// If still unknown, try to extract from description
				if (pkgName === 'unknown' && vuln.description) {
					const match = vuln.description.match(/package[\s:]+([a-z][a-z0-9-_.]*)/i);
					if (match) {
						pkgName = match[1];
					}
				}

				const severity = vuln.severity.toUpperCase();
				const recommendation = (vuln.recommendation || 'Review package').substring(0, 14);

				lines.push(
					`│ ${pkgName.substring(0, 19).padEnd(19)} │ ${severity.padEnd(8)} │ ${recommendation.padEnd(14)} │`
				);
			}
			lines.push('└─────────────────────┴──────────┴────────────────┘');
			lines.push('');
		}

		if (analysis.alternatives.size > 0) {
			lines.push('⚡ SIZE OPTIMIZATION');
			lines.push('┌──────────────┬─────────┬─────────────┬─────────────┐');
			lines.push('│ Current      │ Size    │ Alternative │ Savings     │');
			lines.push('├──────────────┼─────────┼─────────────┼─────────────┤');

			let count = 0;
			for (const [current, alternatives] of analysis.alternatives) {
				if (count >= 5) break;
				const alt = alternatives[0];
				const currentDep = analysis.dependencies.production.find(d => d.name === current);
				const currentSize = currentDep?.size?.formatted.gzip || 'Unknown';
				const savings =
					alt.sizeSavings.gzip > 0 ? `-${this.formatSize(alt.sizeSavings.gzip)}` : 'N/A';

				lines.push(
					`│ ${current.substring(0, 12).padEnd(12)} │ ${currentSize.padEnd(7)} │ ${alt.name.substring(0, 11).padEnd(11)} │ ${savings.padEnd(11)} │`
				);
				count++;
			}
			lines.push('└──────────────┴─────────┴─────────────┴─────────────┘');
			lines.push('');
		}

		const statusLines = [];
		if (analysis.summary.outdated > 0) {
			statusLines.push(`🔄 OUTDATED (${analysis.summary.outdated})`);
		}
		if (analysis.summary.unused > 0) {
			statusLines.push(`📋 UNUSED (${analysis.summary.unused})`);
		}
		if (analysis.summary.duplicates > 0) {
			statusLines.push(`🔀 DUPLICATES (${analysis.summary.duplicates})`);
		}

		if (statusLines.length > 0) {
			lines.push(statusLines.join('        '));
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
}
