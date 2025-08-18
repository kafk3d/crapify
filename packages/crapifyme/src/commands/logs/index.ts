import { Command } from 'commander';
import {
	Logger,
	findFiles,
	createFilePatterns,
	readFile,
	writeFile,
	detectVersionControl,
	FileStats,
	ExitCode
} from '../../shared';
import { LogsProcessor } from './logic';

export const logsCommand = new Command('logs')
	.description('Remove console.log statements while preserving important ones')
	.argument('[paths...]', 'Files or directories to process', ['.'])
	.option('-k, --keep <patterns>', 'Comma-separated patterns to preserve')
	.option('-e, --extensions <ext>', 'File extensions to process', 'js,ts,jsx,tsx,vue,svelte,astro')
	.option('-x, --exclude <patterns>', 'Glob patterns to exclude')
	.option('--no-preserve-debug', 'Remove console.debug statements')
	.option('--no-preserve-error', 'Remove console.error statements')
	.option('--no-preserve-warn', 'Remove console.warn statements')
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
					'This tool removes console.log statements from your code, which is a potentially destructive operation.'
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

			const processor = new LogsProcessor({
				keep: options.keep?.split(',').map((p: string) => p.trim()) || [],
				preserveDebug: options.preserveDebug,
				preserveError: options.preserveError,
				preserveWarn: options.preserveWarn
			});

			const stats: FileStats = {
				filesProcessed: 0,
				itemsRemoved: 0,
				itemsPreserved: 0,
				errors: []
			};

			for (const file of files) {
				try {
					const content = await readFile(file);
					const result = processor.processFile(content);

					if (result.modified && !globalOptions.dryRun) {
						await writeFile(file, result.content);
					}

					stats.filesProcessed++;
					stats.itemsRemoved += result.removed;
					stats.itemsPreserved += result.preserved;

					if (result.modified) {
						logger.success(`${file}`);
						console.log(`  ┣ Console logs removed: ${result.removed}`);
						console.log(`  ┣ Console logs preserved: ${result.preserved}`);
						console.log(
							`  ┗ Status: ${globalOptions.dryRun ? 'DRY RUN - would be modified' : 'Modified'}`
						);
					} else if (globalOptions.verbose) {
						logger.info(`${file} - No console.log statements found`);
					}
				} catch (error) {
					stats.errors.push({ file, error: (error as Error).message });
					logger.error(`Failed to process ${file}`, error as Error);
				}
			}

			if (globalOptions.json) {
				logger.json(stats);
			} else {
				console.log('');
				console.log('█▀▀ █▀█ █▀▄▀█ █▀█ █   █▀▀ ▀█▀ █▀▀');
				console.log('█▄▄ █▄█ █░▀░█ █▀▀ █▄▄ ██▄ ░█░ ██▄');
				console.log('');

				if (stats.errors.length > 0) {
					logger.error(
						`Processing completed with ${stats.errors.length} error${stats.errors.length === 1 ? '' : 's'}`
					);
				} else {
					logger.success('Processing completed successfully');
				}

				const filesModified = stats.itemsRemoved > 0 ? 'with changes' : 'no changes needed';
				logger.info(`Files processed: ${stats.filesProcessed} (${filesModified})`);
				logger.info(`Console logs removed: ${stats.itemsRemoved}`);
				logger.info(`Console logs preserved: ${stats.itemsPreserved}`);

				if (globalOptions.dryRun && stats.itemsRemoved > 0) {
					logger.warn('DRY RUN MODE - No files were actually modified');
					logger.info('Remove --dry-run to apply changes');
				}
			}

			const exitCode =
				stats.errors.length > 0
					? ExitCode.Error
					: stats.itemsRemoved > 0
						? ExitCode.IssuesFound
						: ExitCode.Success;
			process.exit(exitCode);
		} catch (error) {
			logger.error('Fatal error', error as Error);
			process.exit(ExitCode.Error);
		}
	});
