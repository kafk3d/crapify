import { Command } from 'commander';
import {
	Logger,
	findFiles,
	createFilePatterns,
	readFile,
	writeFile,
	detectVersionControl,
	ExitCode,
	showComplete
} from '../../shared';
import { CharacterDetector } from './logic';
import { CharStats, ScriptType, IssueSeverity, CharacterDetectorOptions } from './types';

export const charsCommand = new Command('chars')
	.description('Detect and fix non-Latin characters that may cause encoding issues')
	.argument('[paths...]', 'Files or directories to process', ['.'])
	.option(
		'-e, --extensions <ext>',
		'File extensions to process',
		'js,ts,jsx,tsx,vue,svelte,astro,html,css,scss,less,sass,py,java,c,cpp,cs,php,rb,go,rs'
	)
	.option('-x, --exclude <patterns>', 'Glob patterns to exclude')
	.option('--fix', 'Automatically fix detected issues with ASCII replacements')
	.option('--strict', 'Enable strict mode (flag all non-ASCII characters)')
	.option('--interactive', 'Prompt for each replacement (requires --fix)')
	.option('--show-context <number>', 'Number of characters to show around each issue', '40')
	.option('--ignore-strings', 'Ignore characters inside string literals')
	.option('--ignore-comments', 'Ignore characters inside comments')
	.option('--severity <level>', 'Minimum severity level to report (low,medium,high,critical)', 'low')
	.action(async (paths: string[], options: any, command: Command) => {
		const globalOptions = command.parent?.opts() || {};
		const logger = new Logger(globalOptions.verbose, globalOptions.quiet, globalOptions.json);

		if (!globalOptions.force) {
			const vcsResult = detectVersionControl();
			if (!vcsResult.detected && options.fix) {
				logger.error(
					'No version control system detected in this project or its parent directories.'
				);
				logger.error(
					'This tool can modify your code files, which is a potentially destructive operation.'
				);
				logger.error('Use --force to proceed without version control.');
				process.exit(ExitCode.Error);
			}

			if (globalOptions.verbose && vcsResult.detected) {
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

			if (globalOptions.dryRun || !options.fix) {
				logger.info(options.fix ? 'DRY RUN - No files will be modified' : 'DETECTION MODE - No files will be modified');
			}

			const detectorOptions: CharacterDetectorOptions = {
				strict: options.strict,
				interactive: options.interactive,
				showContext: parseInt(options.showContext) || 40,
				ignoreStrings: options.ignoreStrings,
				ignoreComments: options.ignoreComments
			};

			const detector = new CharacterDetector(logger, detectorOptions);
			const minSeverity = parseSeverity(options.severity);

			const stats: CharStats = {
				filesProcessed: 0,
				itemsRemoved: 0,
				itemsPreserved: 0,
				charactersFound: 0,
				charactersFixed: 0,
				scriptTypes: {} as Record<ScriptType, number>,
				errors: []
			};

			for (const scriptType of Object.values(ScriptType)) {
				stats.scriptTypes[scriptType] = 0;
			}

			for (const file of files) {
				try {
					const content = await readFile(file);
					const result = options.fix && !globalOptions.dryRun 
						? detector.fixCharacters(content, file)
						: detector.detectCharacters(content, file);

					const filteredIssues = result.issues.filter(issue => 
						getSeverityLevel(issue.severity) >= getSeverityLevel(minSeverity)
					);

					if (result.modified && !globalOptions.dryRun) {
						await writeFile(file, result.content);
					}

					stats.filesProcessed++;
					stats.charactersFound += filteredIssues.length;
					stats.charactersFixed += result.fixed;

					const scriptStats = detector.getScriptTypeStats(filteredIssues);
					for (const [scriptType, count] of Object.entries(scriptStats)) {
						stats.scriptTypes[scriptType as ScriptType] += count;
					}

					if (filteredIssues.length > 0) {
						logger.success(`${file}`);
						
						if (globalOptions.verbose || !globalOptions.json) {
							for (const issue of filteredIssues.slice(0, 10)) { // Show first 10 issues
								const prefix = issue.severity === IssueSeverity.CRITICAL ? '⚠️ ' : 
											   issue.severity === IssueSeverity.HIGH ? '🔴 ' :
											   issue.severity === IssueSeverity.MEDIUM ? '🟡 ' : '🔵 ';
								
								console.log(`  ${prefix}Line ${issue.line}:${issue.column} - ${issue.character} (U+${issue.codePoint.toString(16).toUpperCase().padStart(4, '0')}) [${issue.script}]`);
								if (issue.replacement) {
									console.log(`    ↳ Suggests: "${issue.replacement}"`);
								}
								console.log(`    Context: ${issue.context}`);
							}
							
							if (filteredIssues.length > 10) {
								console.log(`  ... and ${filteredIssues.length - 10} more issues`);
							}
						}

						console.log(`  ┣ Characters found: ${filteredIssues.length}`);
						if (options.fix) {
							console.log(`  ┣ Characters fixed: ${result.fixed}`);
						}
						console.log(
							`  ┗ Status: ${globalOptions.dryRun ? 'DRY RUN - would be modified' : result.modified ? 'Modified' : 'Detected only'}`
						);
					} else if (globalOptions.verbose) {
						logger.info(`${file} - No issues found`);
					}
				} catch (error) {
					stats.errors.push({ file, error: (error as Error).message });
					logger.error(`Failed to process ${file}`, error as Error);
				}
			}

			if (globalOptions.json) {
				logger.json(stats);
			} else {
				showComplete();

				if (stats.errors.length > 0) {
					logger.error(
						`Processing completed with ${stats.errors.length} error${stats.errors.length === 1 ? '' : 's'}`
					);
				} else {
					logger.success('Processing completed successfully');
				}

				logger.info(`Files processed: ${stats.filesProcessed}`);
				logger.info(`Characters found: ${stats.charactersFound}`);
				if (options.fix) {
					logger.info(`Characters fixed: ${stats.charactersFixed}`);
				}

				if (stats.charactersFound > 0) {
					console.log('\nScript distribution:');
					for (const [scriptType, count] of Object.entries(stats.scriptTypes)) {
						if (count > 0) {
							console.log(`  ${scriptType}: ${count}`);
						}
					}
				}

				if (globalOptions.dryRun && options.fix && stats.charactersFound > 0) {
					logger.warn('DRY RUN MODE - No files were actually modified');
					logger.info('Remove --dry-run to apply changes');
				} else if (!options.fix && stats.charactersFound > 0) {
					logger.info('Add --fix flag to automatically replace characters');
				}
			}

			const exitCode =
				stats.errors.length > 0
					? ExitCode.Error
					: stats.charactersFound > 0
						? ExitCode.IssuesFound
						: ExitCode.Success;
			process.exit(exitCode);
		} catch (error) {
			logger.error('Fatal error', error as Error);
			process.exit(ExitCode.Error);
		}
	});

function parseSeverity(severity: string): IssueSeverity {
	switch (severity.toLowerCase()) {
		case 'low': return IssueSeverity.LOW;
		case 'medium': return IssueSeverity.MEDIUM;
		case 'high': return IssueSeverity.HIGH;
		case 'critical': return IssueSeverity.CRITICAL;
		default: return IssueSeverity.LOW;
	}
}

function getSeverityLevel(severity: IssueSeverity): number {
	switch (severity) {
		case IssueSeverity.LOW: return 1;
		case IssueSeverity.MEDIUM: return 2;
		case IssueSeverity.HIGH: return 3;
		case IssueSeverity.CRITICAL: return 4;
		default: return 1;
	}
}