import { Command } from 'commander';
import {
	Logger,
	findFiles,
	createFilePatterns,
	readFile,
	writeFile,
	detectVersionControl,
	ExitCode
} from '../../shared';
import { ImportsProcessor } from './logic';
import { ImportsStats, PathAlias } from './types';

export const importsCommand = new Command('imports')
	.description('Optimize and standardize import statements')
	.argument('[paths...]', 'Files or directories to process', ['.'])
	.option('--style <type>', 'Import path style (absolute|relative|mixed)', 'mixed')
	.option('--sort', 'Sort imports alphabetically', true)
	.option('--group', 'Group imports by type (external, internal, relative)', true)
	.option('--remove-unused', 'Remove unused imports via AST analysis', true)
	.option('--merge-duplicates', 'Merge duplicate imports from same source', true)
	.option('--no-sort', 'Disable sorting imports')
	.option('--no-group', 'Disable grouping imports')
	.option('--no-remove-unused', 'Disable removing unused imports')
	.option('--no-merge-duplicates', 'Disable merging duplicate imports')
	.option('--alias <mapping>', 'Path alias configuration (e.g., "@/*:./src/*")')
	.option(
		'--framework <name>',
		'Framework-specific optimizations (nextjs|vite|svelte|vue|react|angular|nuxt)'
	)
	.option('--multiline-threshold <n>', 'Threshold for multiline imports', parseInt, 3)
	.option('-e, --extensions <ext>', 'File extensions to process', 'js,ts,jsx,tsx,vue,svelte')
	.option('-x, --exclude <patterns>', 'Glob patterns to exclude')
	.option('--no-preserve-comments', 'Remove comments from import statements')
	.action(async (paths: string[], options: any, command: Command) => {
		const globalOptions = command.parent?.opts() || {};
		const logger = new Logger(globalOptions.verbose, globalOptions.quiet, globalOptions.json);

		if (!globalOptions.force) {
			const vcsResult = detectVersionControl();
			if (!vcsResult.detected) {
				logger.error(
					'No version control system detected in this project or its parent directories.'
				);
				logger.error(
					'This tool modifies import statements in your code, which is a potentially destructive operation.'
				);
				logger.error('Use --force to proceed without version control.');
				process.exit(ExitCode.Error);
			}

			if (globalOptions.verbose) {
				logger.info(`Version control detected: ${vcsResult.type} at ${vcsResult.path}`);
			}
		}

		try {
			const extensions = options.extensions.split(',').map((e: string) => e.trim());
			const patterns = createFilePatterns(paths, extensions);
			const excludePatterns =
				options.exclude
					?.split(',')
					.map((p: string) => p.trim())
					.filter(Boolean) || [];

			logger.info(`Search patterns: ${patterns.join(', ')}`);
			if (excludePatterns.length > 0) {
				logger.info(`Exclude patterns: ${excludePatterns.join(', ')}`);
			}

			const files = await findFiles(patterns, excludePatterns);

			if (files.length === 0) {
				logger.warn('No files found to process');
				logger.info(`Searched in: ${paths.join(', ')}`);
				logger.info(`Extensions: ${extensions.join(', ')}`);
				process.exit(ExitCode.Success);
			}

			logger.info(`Found ${files.length} file${files.length === 1 ? '' : 's'} to process`);

			if (globalOptions.dryRun) {
				logger.info('DRY RUN - No files will be modified');
			}

			let aliases: PathAlias[] = [];
			if (options.alias) {
				try {
					aliases = ImportsProcessor.parseAliasesFromString(options.alias);
					if (globalOptions.verbose) {
						logger.info(
							`Configured ${aliases.length} path alias${aliases.length === 1 ? '' : 'es'}`
						);
					}
				} catch (error) {
					logger.error(`Invalid alias configuration: ${(error as Error).message}`);
					process.exit(ExitCode.Error);
				}
			}

			const processor = new ImportsProcessor({
				style: options.style,
				sort: options.sort,
				group: options.group,
				removeUnused: options.removeUnused,
				mergeDuplicates: options.mergeDuplicates,
				multilineThreshold: options.multilineThreshold,
				aliases,
				framework: options.framework,
				preserveComments: options.preserveComments,
				verbose: globalOptions.verbose
			});

			const stats: ImportsStats = {
				filesProcessed: 0,
				importsOptimized: 0,
				unusedRemoved: 0,
				duplicatesMerged: 0,
				pathsConverted: 0,
				errors: []
			};

			for (const file of files) {
				try {
					const content = await readFile(file);
					const result = processor.processFile(content, file);

					if (result.modified && !globalOptions.dryRun) {
						await writeFile(file, result.content);
					}

					stats.filesProcessed++;
					stats.importsOptimized += result.optimized;
					stats.unusedRemoved += result.unusedRemoved;
					stats.duplicatesMerged += result.duplicatesMerged;
					stats.pathsConverted += result.pathsConverted;

					if (result.modified) {
						logger.success(`${file}`);
						if (result.unusedRemoved > 0) {
						}
						if (result.duplicatesMerged > 0) {
						}
						if (result.pathsConverted > 0) {
						}
						if (result.optimized > 0) {
						}
					} else if (globalOptions.verbose) {
						logger.info(`${file} - No import optimizations needed`);
					}

					if (result.errors && result.errors.length > 0) {
						for (const error of result.errors) {
							logger.error(`${file}: ${error}`);
						}
					}

					if (result.warnings && result.warnings.length > 0) {
						for (const warning of result.warnings) {
							logger.warn(`${file}: ${warning}`);
						}
					}
				} catch (error) {
					stats.errors.push({ file, error: (error as Error).message });
					logger.error(`Failed to process ${file}`, error as Error);
				}
			}

			if (globalOptions.json) {
				logger.json(stats);
			} else {
				if (stats.errors.length > 0) {
					logger.error(
						`Processing completed with ${stats.errors.length} error${stats.errors.length === 1 ? '' : 's'}`
					);
				} else {
					logger.success('Import optimization completed successfully');
				}

				const filesModified =
					stats.importsOptimized > 0 ? 'with optimizations' : 'no optimizations needed';
				logger.info(`Files processed: ${stats.filesProcessed} (${filesModified})`);

				if (stats.unusedRemoved > 0) {
					logger.info(`Unused imports removed: ${stats.unusedRemoved}`);
				}
				if (stats.duplicatesMerged > 0) {
					logger.info(`Duplicate imports merged: ${stats.duplicatesMerged}`);
				}
				if (stats.pathsConverted > 0) {
					logger.info(`Import paths converted: ${stats.pathsConverted}`);
				}
				logger.info(`Total optimizations: ${stats.importsOptimized}`);

				if (globalOptions.dryRun && stats.importsOptimized > 0) {
					logger.warn('DRY RUN MODE - No files were actually modified');
					logger.info('Remove --dry-run to apply changes');
				}
			}

			const exitCode =
				stats.errors.length > 0
					? ExitCode.Error
					: stats.importsOptimized > 0
						? ExitCode.IssuesFound
						: ExitCode.Success;
			process.exit(exitCode);
		} catch (error) {
			logger.error('Fatal error', error as Error);
			process.exit(ExitCode.Error);
		}
	});
