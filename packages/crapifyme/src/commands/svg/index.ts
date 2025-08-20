import { Command } from 'commander';
import path from 'path';
import { Logger, ExitCode, showComplete } from '../../shared';
import { SvgProcessor } from './logic';
import { SvgOptions, SvgStats, SVG_PRESETS } from './types';

export const svgCommand = new Command('svg')
	.description('Optimize SVG files or direct SVG code using SVGO')
	.argument(
		'[target]',
		'SVG file, directory, or direct SVG code to optimize (defaults to current directory)'
	)
	.option(
		'--preset <preset>',
		`Optimization preset (${Object.keys(SVG_PRESETS).join(', ')})`,
		'balanced'
	)
	.option('--config <path>', 'Path to custom SVGO configuration file')
	.option('--plugins <plugins>', 'Comma-separated list of SVGO plugins to enable')
	.option('--precision <number>', 'Floating point precision for coordinates', parseFloat)
	.option('--keep-ids', 'Preserve ID attributes')
	.option('--keep-titles', 'Preserve title and desc elements for accessibility')
	.option('--multipass', 'Run optimization multiple times for better results')
	.option('--glob <pattern>', 'Glob pattern for files (e.g., "**/*.svg")')
	.option('-e, --extensions <ext>', 'File extensions to process (default: svg)', 'svg')
	.option('-x, --exclude <patterns>', 'Comma-separated exclusion patterns')
	.option('--in-place', 'Overwrite original files (default with confirmation)')
	.option('--copy', 'Create optimized copies with .optimized.svg suffix')
	.option('--backup', 'Create .original.svg backup before optimizing')
	.option('--stdout', 'Output optimized SVG to console (single files only)')
	.option('--output-dir <dir>', 'Save optimized files to different directory')
	.option('--parallel', 'Process files in parallel (default: true)', true)
	.option('--max-concurrency <number>', 'Maximum number of concurrent operations', parseInt, 4)
	.option('--watch', 'Watch mode for continuous optimization during development')
	.option('--size-info', 'Show detailed size analysis and compression ratios (default: true)')
	.option('--no-size-info', 'Hide size analysis')
	.option('--report <format>', 'Export report (json, csv)')
	.option('--inline-styles', 'Convert style attributes to inline styles')
	.option('--remove-viewbox', 'Remove viewBox when not needed')
	.option('--sort-attrs', 'Sort attributes alphabetically')
	.option('--remove-xmlns', 'Remove xmlns when not needed for standalone SVGs')
	.option('--minify-styles', 'Minify CSS within SVG')
	.option('--convert-colors', 'Optimize color representations (hex, named, etc.)')
	.option('--validate-input', 'Validate SVG structure before optimization (default: true)', true)
	.option('--validate-output', 'Validate SVG structure after optimization (default: true)', true)
	.option('--skip-validation', 'Skip all validation checks')
	.addHelpText(
		'after',
		`
Examples:
  $ crapifyme svg                                    # Optimize all SVGs in current directory
  $ crapifyme svg logo.svg                          # Optimize single SVG file
  $ crapifyme svg assets/                           # Optimize all SVGs in directory
  $ crapifyme svg '<svg>...</svg>'                  # Optimize SVG code directly (outputs to console)
  $ crapifyme svg --preset=aggressive '<svg>...</svg>' # Direct SVG optimization with preset
  $ crapifyme svg --glob "**/*.svg" --preset=aggressive  # Aggressive optimization with glob
  $ crapifyme svg icon.svg --stdout                 # Output to console
  $ crapifyme svg --copy --preset=minimal assets/   # Create optimized copies with minimal preset
  $ crapifyme svg --backup --multipass icons/       # Create backups and run multiple passes
  $ crapifyme svg --output-dir=optimized/ src/      # Save to different directory
  $ crapifyme svg --keep-ids --keep-titles logo.svg # Preserve IDs and accessibility elements
  $ crapifyme svg --plugins="cleanupAttrs,removeComments" logo.svg  # Custom plugin selection
  $ crapifyme svg --config=svgo.config.js assets/   # Use custom configuration file
  $ crapifyme svg --watch --preset=balanced src/    # Watch mode with balanced optimization
  $ crapifyme svg --report=json --size-info assets/ # Generate detailed JSON report
  $ crapifyme svg --parallel --max-concurrency=8 large-dir/  # High-performance batch processing

Optimization Presets:
  minimal    Light optimization, preserves most attributes and structure
  balanced   Balanced optimization with good compression while maintaining usability (default)
  aggressive Maximum compression with potential loss of some functionality

Output Modes:
  --in-place    Overwrite original files (default, prompts for confirmation)
  --copy        Create .optimized.svg copies alongside originals
  --backup      Create .original.svg backups before optimization
  --stdout      Output to console (single files only)
  --output-dir  Save optimized files to specified directory

Safety Features:
  --dry-run     Preview changes without modifying files (global option)
  --force       Bypass version control requirement and confirmations (global option)
  --backup      Automatic backup creation before optimization
  --validate    Input/output validation to ensure SVG integrity

Performance Options:
  --parallel           Process multiple files simultaneously (default: enabled)
  --max-concurrency    Control number of concurrent operations (default: 4)
  --multipass         Run optimization multiple times for better compression

Advanced Configuration:
  --precision         Floating point precision for coordinates (default: 2)
  --inline-styles     Convert style attributes to inline styles
  --remove-viewbox    Remove viewBox when not needed
  --sort-attrs        Sort attributes alphabetically for consistency
  --remove-xmlns      Remove xmlns declarations for standalone SVGs
  --minify-styles     Minify CSS content within SVGs
  --convert-colors    Optimize color representations (hex, named colors, etc.)

Integration Features:
  --watch             Continuous optimization during development
  --report            Export detailed reports (json, csv formats)
  --config            Load custom SVGO configuration files
  --glob              Advanced file pattern matching

Typical Size Reductions:
  Minimal preset:    10-30% file size reduction
  Balanced preset:   30-60% file size reduction  
  Aggressive preset: 50-80% file size reduction

Uses SVGO v3+
Visit https://crapify.me for documentation and examples.
`
	)
	.action(async (target: string | undefined, options: SvgOptions, command: Command) => {
		await handleSvgOptimization(target, options, command);
	});

async function handleSvgOptimization(
	target: string | undefined,
	options: SvgOptions,
	command: Command
): Promise<void> {
	const globalOptions = command.parent?.opts() || {};
	const logger = new Logger(globalOptions.verbose, globalOptions.quiet, globalOptions.json);

	try {
		const mergedOptions: SvgOptions = {
			...options,
			dryRun: globalOptions.dryRun || options.dryRun,
			force: globalOptions.force || options.force,
			verbose: globalOptions.verbose || options.verbose,
			quiet: globalOptions.quiet || options.quiet,
			json: globalOptions.json || options.json
		};

		if (options.skipValidation) {
			mergedOptions.validateInput = false;
			mergedOptions.validateOutput = false;
		}

		if (mergedOptions.preset && !SVG_PRESETS[mergedOptions.preset]) {
			throw new Error(
				`Invalid preset "${mergedOptions.preset}". Available presets: ${Object.keys(SVG_PRESETS).join(', ')}`
			);
		}

		if (mergedOptions.plugins && typeof mergedOptions.plugins === 'string') {
			mergedOptions.plugins = (mergedOptions.plugins as string)
				.split(',')
				.map((p: string) => p.trim());
		}

		if (mergedOptions.exclude && typeof mergedOptions.exclude === 'string') {
			mergedOptions.exclude = (mergedOptions.exclude as string)
				.split(',')
				.map((p: string) => p.trim());
		}

		const processor = new SvgProcessor(logger);

		const isSvgCode =
			target && (target.trim().startsWith('<svg') || target.trim().startsWith('<?xml'));

		if (isSvgCode) {
			if (mergedOptions.verbose) {
				logger.info(`Processing direct SVG code`);
				logger.info(`Preset: ${mergedOptions.preset || 'balanced'}`);
			}

			mergedOptions.stdout = true;
			mergedOptions.force = true;

			const result = await processor.processSvgCode(target, mergedOptions);

			if (mergedOptions.json) {
				logger.json(result);
			} else {
				console.log(result.optimizedContent);
				logger.success(``);
				if (!mergedOptions.quiet && mergedOptions.sizeInfo !== false) {
					const compressionPercent = ((result.bytesSaved / result.originalSize) * 100).toFixed(1);
					console.error(`Original size: ${formatBytes(result.originalSize)}`);
					console.error(`Optimized size: ${formatBytes(result.optimizedSize)}`);
					console.error(`Bytes saved: ${formatBytes(result.bytesSaved)} (${compressionPercent}%)`);
				}
			}

			process.exit(ExitCode.Success);
		} else {
			const targetPath = target || process.cwd();

			if (mergedOptions.verbose) {
				logger.info(`Starting SVG optimization`);
				logger.info(`Target: ${targetPath}`);
				logger.info(`Preset: ${mergedOptions.preset || 'balanced'}`);
				if (mergedOptions.dryRun) {
					logger.info('Dry run mode - no files will be modified');
				}
			}

			const result = await processor.processSvgFiles(targetPath, mergedOptions);

			if (mergedOptions.json) {
				logger.json(result);
			} else {
				await displayResults(result, mergedOptions, logger);
			}

			const exitCode =
				result.stats.errors.length > 0
					? ExitCode.Error
					: result.failedFiles.length > 0
						? ExitCode.IssuesFound
						: ExitCode.Success;

			process.exit(exitCode);
		}
	} catch (error) {
		logger.error('SVG optimization failed', error as Error);
		process.exit(ExitCode.Error);
	}
}

async function displayResults(result: any, options: SvgOptions, logger: Logger): Promise<void> {
	const { stats } = result;

	if (!options.quiet) {
		logger.success(
			`Processed ${stats.filesProcessed} SVG file${stats.filesProcessed === 1 ? '' : 's'}`
		);

		if (stats.filesSkipped > 0) {
			logger.info(`Skipped ${stats.filesSkipped} file${stats.filesSkipped === 1 ? '' : 's'}`);
		}

		if (options.sizeInfo !== false) {
			const compressionPercent = ((stats.bytesSaved / stats.bytesOriginal) * 100).toFixed(1);
			console.log(`  ┣ Original size: ${formatBytes(stats.bytesOriginal)}`);
			console.log(`  ┣ Optimized size: ${formatBytes(stats.bytesOptimized)}`);
			console.log(`  ┣ Bytes saved: ${formatBytes(stats.bytesSaved)}`);
			console.log(`  ┣ Compression: ${compressionPercent}%`);
			console.log(`  ┣ Avg ratio: ${stats.avgCompressionRatio.toFixed(2)}:1`);
			console.log(`  ┗ Processing time: ${stats.processingTime.toFixed(2)}ms`);
			console.log('');
		}

		if (stats.errors.length > 0) {
			logger.warn(
				`${stats.errors.length} error${stats.errors.length === 1 ? '' : 's'} encountered:`
			);
			stats.errors.forEach((error: any) => {
				console.log(`  ┣ ${error.file}: ${error.error}`);
			});
		}

		if (stats.warnings.length > 0 && options.verbose) {
			logger.info(`${stats.warnings.length} warning${stats.warnings.length === 1 ? '' : 's'}:`);
			stats.warnings.forEach((warning: any) => {
				console.log(`  ┣ ${warning.file}: ${warning.warning}`);
			});
		}

		if (stats.filesProcessed > 0) {
			showComplete();
		}
	}
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
