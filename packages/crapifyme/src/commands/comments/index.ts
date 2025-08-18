import { Command } from 'commander';
import { AdvancedCommentRemover } from './advanced-logic';
import {
	Logger,
	findFiles,
	createFilePatterns,
	readFile,
	writeFile,
	detectVersionControl,
	CommentStats,
	ExitCode
} from '../../shared';

export const commentsCommand = new Command('comments')
	.description('Remove code comments while preserving important ones')
	.argument('[paths...]', 'Files or directories to process', ['.'])
	.option(
		'-k, --keep <patterns>',
		'Comma-separated patterns to preserve',
		'todo,fixme,hack,ts-ignore,eslint-disable'
	)
	.option(
		'-e, --extensions <ext>',
		'File extensions to process',
		'js,ts,jsx,tsx,vue,svelte,astro,html,css,scss,less,sass'
	)
	.option('-x, --exclude <patterns>', 'Glob patterns to exclude')
	.option('--no-preserve-framework', 'Disable framework-specific comment preservation')
	.option('--no-preserve-development', 'Disable development keyword preservation')
	.option('--no-preserve-tooling', 'Disable tooling directive preservation')
	.option('--no-preserve-documentation', 'Disable documentation comment preservation')
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
					'This tool removes comments from your code, which is a potentially destructive operation.'
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

			const processor = new AdvancedCommentRemover(
				options.keep.split(',').map((p: string) => p.trim()),
				{
					logger,
					preserveFramework: options.preserveFramework,
					preserveDevelopment: options.preserveDevelopment,
					preserveTooling: options.preserveTooling,
					preserveDocumentation: options.preserveDocumentation,
					useEnhancedTokenizer: true
				}
			);

			const stats: CommentStats = {
				filesProcessed: 0,
				commentsRemoved: 0,
				commentsPreserved: 0,
				errors: []
			};

			for (const file of files) {
				try {
					const content = await readFile(file);
					const result = processor.removeComments(content, file);

					if (result.modified && !globalOptions.dryRun) {
						await writeFile(file, result.content);
					}

					stats.filesProcessed++;
					stats.commentsRemoved += result.removed;
					stats.commentsPreserved += result.preserved;

					if (result.modified) {
						logger.success(`${file}`);
						console.log(`  ┣ Comments removed: ${result.removed}`);
						console.log(`  ┣ Comments preserved: ${result.preserved}`);
						console.log(
							`  ┗ Status: ${globalOptions.dryRun ? 'DRY RUN - would be modified' : 'Modified'}`
						);
					} else if (globalOptions.verbose) {
						logger.info(`${file} - No comments found`);
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

				const filesModified = stats.commentsRemoved > 0 ? 'with changes' : 'no changes needed';
				logger.info(`Files processed: ${stats.filesProcessed} (${filesModified})`);
				logger.info(`Comments removed: ${stats.commentsRemoved}`);
				logger.info(`Comments preserved: ${stats.commentsPreserved}`);

				if (globalOptions.dryRun && stats.commentsRemoved > 0) {
					logger.warn('DRY RUN MODE - No files were actually modified');
					logger.info('Remove --dry-run to apply changes');
				}
			}

			const exitCode =
				stats.errors.length > 0
					? ExitCode.Error
					: stats.commentsRemoved > 0
						? ExitCode.IssuesFound
						: ExitCode.Success;
			process.exit(exitCode);
		} catch (error) {
			logger.error('Fatal error', error as Error);
			process.exit(ExitCode.Error);
		}
	});
