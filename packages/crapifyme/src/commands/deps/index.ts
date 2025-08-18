import { Command } from 'commander';
import { Logger, detectVersionControl, ExitCode } from '../../shared';
import { DepsProcessor } from './logic';
import { DepsStats, AnalysisType, OutputFormat } from './types';

export const depsCommand = new Command('deps')
	.description('Analyze and optimize project dependencies')
	.argument('[path]', 'Project directory to analyze', '.')
	.option('--security-only', 'Only perform security vulnerability analysis', false)
	.option('--size-only', 'Only perform bundle size analysis', false)
	.option('--outdated-only', 'Only check for outdated dependencies', false)
	.option('--unused-only', 'Only check for unused dependencies', false)
	.option('--duplicates-only', 'Only check for duplicate dependencies', false)
	.option('--include-gzip', 'Include gzipped size information', true)
	.option('--no-include-gzip', 'Exclude gzipped size information')
	.option('--include-dev', 'Include development dependencies in analysis', true)
	.option('--no-include-dev', 'Exclude development dependencies from analysis')
	.option('--include-peer', 'Include peer dependencies in analysis', false)
	.option('--include-optional', 'Include optional dependencies in analysis', false)
	.option('--pm <manager>', 'Package manager to use (npm|yarn|pnpm|auto)', 'auto')
	.option('--workspaces', 'Analyze workspaces if available', false)
	.option('--timeout <ms>', 'Request timeout in milliseconds', parseInt, 120000)
	.option('--output <format>', 'Output format (table|json|tree|summary)', 'table')
	.option('--no-security', 'Skip security vulnerability checks')
	.option('--no-bundle-size', 'Skip bundle size analysis')
	.action(async (projectPath: string, options: any, command: Command) => {
		const globalOptions = command.parent?.opts() || {};
		const logger = new Logger(globalOptions.verbose, globalOptions.quiet, globalOptions.json);

		if (!globalOptions.force) {
			const vcsResult = detectVersionControl();
			if (!vcsResult.detected) {
				logger.error(
					'No version control system detected in this project or its parent directories.'
				);
				logger.error(
					'This tool analyzes your dependencies, which may involve network requests and package information.'
				);
				logger.error('Use --force to proceed without version control.');
				process.exit(ExitCode.Error);
			}

			if (globalOptions.verbose) {
				logger.info(`Version control detected: ${vcsResult.type} at ${vcsResult.path}`);
			}
		}

		try {
			const analysisTypes = determineAnalysisTypes(options);

			if (!globalOptions.quiet) {
				process.stdout.write('Starting deps analysis');
				const animateTimer = setInterval(() => {
					process.stdout.write('.');
				}, 500);

				setTimeout(() => {
					clearInterval(animateTimer);
					process.stdout.write('\n');
				}, 1000);
			}

			if (globalOptions.verbose) {
				logger.info(`Analysis types: ${analysisTypes.join(', ')}`);
			}

			if (globalOptions.dryRun) {
				logger.info('DRY RUN - Analysis will be performed but no modifications will be made');
			}

			const processor = new DepsProcessor(
				{
					packageManager: options.pm === 'auto' ? undefined : options.pm,
					includeDevDependencies: options.includeDev,
					includePeerDependencies: options.includePeer,
					includeOptionalDependencies: options.includeOptional,
					checkSecurity: options.security,
					analyzeBundleSize: options.bundleSize,
					checkUnused: analysisTypes.includes(AnalysisType.UNUSED),
					workspaces: options.workspaces,
					timeout: options.timeout,
					verbose: globalOptions.verbose
				},
				projectPath
			);

			const result = await processor.analyzeProject(analysisTypes);

			const stats: DepsStats = {
				filesAnalyzed: 1,
				dependenciesScanned:
					result.analysis.summary.total.production + result.analysis.summary.total.development,
				vulnerabilitiesFound: result.analysis.security.vulnerabilities.length,
				outdatedPackages: result.analysis.summary.outdated,
				unusedPackages: result.analysis.unusedDependencies.length,
				sizeSavingsIdentified: 0,
				errors: result.errors.map(e => ({ message: e.message, type: e.type }))
			};

			if (globalOptions.json) {
				if (options.output === 'summary') {
					logger.json(stats);
				} else {
					logger.json({
						analysis: {
							...result.analysis,
							duplicateDependencies: Object.fromEntries(result.analysis.duplicateDependencies)
						},
						stats,
						errors: result.errors,
						warnings: result.warnings,
						processingTime: result.processingTime
					});
				}
			} else {
				await displayResults(result, options.output as OutputFormat, logger, stats);
			}

			if (result.errors.length > 0) {
				logger.error(
					`Analysis completed with ${result.errors.length} error${result.errors.length === 1 ? '' : 's'}`
				);
				result.errors.forEach(error => logger.error(`${error.type}: ${error.message}`));
			}

			if (result.warnings.length > 0 && globalOptions.verbose) {
				logger.warn(
					`${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'} found:`
				);
				result.warnings.forEach(warning => logger.warn(`${warning.type}: ${warning.message}`));
			}

			if (globalOptions.verbose) {
				logger.info(`Analysis completed in ${result.processingTime}ms`);
			}

			const hasIssues =
				stats.vulnerabilitiesFound > 0 || stats.outdatedPackages > 0 || stats.unusedPackages > 0;
			const exitCode =
				result.errors.length > 0
					? ExitCode.Error
					: hasIssues
						? ExitCode.IssuesFound
						: ExitCode.Success;

			process.exit(exitCode);
		} catch (error) {
			const errorMessage = (error as Error).message;

			if (errorMessage.includes('No package.json found')) {
				logger.error('No package.json found in current directory or any parent directory');
				logger.info("Make sure you're running this command from within a Node.js project");
			} else if (errorMessage.includes('No supported package manager detected')) {
				logger.error(
					'No package manager lock file found (package-lock.json, yarn.lock, pnpm-lock.yaml)'
				);
				logger.info(
					'Run `npm install`, `yarn install`, or `pnpm install` to generate lock files first'
				);
			} else {
				logger.error('Fatal error during dependency analysis', error as Error);
			}

			process.exit(ExitCode.Error);
		}
	});

function determineAnalysisTypes(options: any): AnalysisType[] {
	const types: AnalysisType[] = [];

	if (options.securityOnly) return [AnalysisType.SECURITY];
	if (options.sizeOnly) return [AnalysisType.SIZE];
	if (options.outdatedOnly) return [AnalysisType.OUTDATED];
	if (options.unusedOnly) return [AnalysisType.UNUSED];
	if (options.duplicatesOnly) return [AnalysisType.DUPLICATES];

	return [AnalysisType.FULL];
}

async function displayResults(
	result: any,
	format: OutputFormat,
	logger: Logger,
	stats: DepsStats
): Promise<void> {
	switch (format) {
		case OutputFormat.SUMMARY:
			displaySummary(result.analysis, logger, stats);
			break;
		case OutputFormat.TREE:
			displayTree(result.analysis, logger);
			break;
		case OutputFormat.JSON:
			break;
		case OutputFormat.TABLE:
		default:
			const processor = new DepsProcessor();
			const report = await processor.generateReport(result.analysis);
			console.log(report);
			break;
	}
}

function displaySummary(analysis: any, logger: Logger, stats: DepsStats): void {
	logger.info(`📦 Dependencies Scanned: ${stats.dependenciesScanned}`);

	if (stats.vulnerabilitiesFound > 0) {
		logger.warn(`🚨 Security Issues: ${stats.vulnerabilitiesFound}`);
	}

	if (stats.outdatedPackages > 0) {
		logger.warn(`🔄 Outdated Packages: ${stats.outdatedPackages}`);
	}

	if (stats.unusedPackages > 0) {
		logger.warn(`📋 Unused Packages: ${stats.unusedPackages}`);
	}


	if (analysis.bundle?.totalSize) {
		logger.info(
			`📊 Total Bundle Size: ${analysis.bundle.totalSize.formatted.raw} (${analysis.bundle.totalSize.formatted.gzip} gzipped)`
		);
	}


	if (
		stats.vulnerabilitiesFound === 0 &&
		stats.outdatedPackages === 0 &&
		stats.unusedPackages === 0
	) {
		logger.success('✅ No issues found! Your dependencies look good.');
	}
}

function displayTree(analysis: any, logger: Logger): void {
	const { production, development } = analysis.dependencies;

	if (production.length > 0) {
		production.slice(0, 20).forEach((dep: any, index: number) => {
			const isLast = index === Math.min(production.length - 1, 19);
			const prefix = isLast ? '└── ' : '├── ';
			const version = dep.currentVersion;
			const outdated = dep.isOutdated ? ' (outdated)' : '';
			const size = dep.size ? ` [${dep.size.formatted.gzip}]` : '';
		});

		if (production.length > 20) {
		}
	}

	if (development.length > 0) {
		development.slice(0, 10).forEach((dep: any, index: number) => {
			const isLast = index === Math.min(development.length - 1, 9);
			const prefix = isLast ? '└── ' : '├── ';
			const version = dep.currentVersion;
			const outdated = dep.isOutdated ? ' (outdated)' : '';
		});

		if (development.length > 10) {
		}
	}
}
