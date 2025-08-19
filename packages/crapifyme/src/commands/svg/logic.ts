import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import { optimize, Config as SvgoConfig } from 'svgo';
import fastGlob from 'fast-glob';
import chalk from 'chalk';
import * as cliProgress from 'cli-progress';
import ora from 'ora';
import isSvg from 'is-svg';
import { filesize } from 'filesize';
import {
	SvgOptions,
	SvgOptimizationResult,
	SvgBatchResult,
	SvgStats,
	SvgValidationResult,
	SvgProcessingConfig,
	createProcessingConfig,
	DEFAULT_SVG_EXTENSIONS,
	isSupportedSvgExtension
} from './types';
import { Logger, detectVersionControl, resolvePath } from '../../shared';

export class SvgProcessor {
	private logger: Logger;
	private progressBar?: cliProgress.SingleBar;
	private spinner?: ora.Ora;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	async processSvgFiles(target: string, options: SvgOptions): Promise<SvgBatchResult> {
		const startTime = Date.now();
		const stats: SvgStats = {
			filesProcessed: 0,
			filesSkipped: 0,
			bytesProcessed: 0,
			bytesOriginal: 0,
			bytesOptimized: 0,
			bytesSaved: 0,
			avgCompressionRatio: 0,
			operationsCompleted: 0,
			processingTime: 0,
			errors: [],
			warnings: []
		};

		const results: SvgOptimizationResult[] = [];
		const skippedFiles: string[] = [];
		const failedFiles: Array<{ file: string; error: string }> = [];

		try {
			// Safety checks
			await this.performSafetyChecks(options);

			// Find files to process
			const files = await this.findSvgFiles(target, options);
			
			if (files.length === 0) {
				this.logger.warn('No SVG files found to process');
				return { results, stats, skippedFiles, failedFiles };
			}

			// Create processing configuration
			const config = createProcessingConfig(options);

			// Setup progress tracking
			if (!options.quiet && files.length > 1) {
				this.setupProgressTracking(files.length, options);
			}

			// Process files
			if (options.parallel && files.length > 1) {
				await this.processFilesParallel(files, config, options, results, skippedFiles, failedFiles, stats);
			} else {
				await this.processFilesSequential(files, config, options, results, skippedFiles, failedFiles, stats);
			}

			// Cleanup progress tracking
			this.cleanupProgressTracking();

			// Calculate final statistics
			this.calculateFinalStats(stats, startTime);

			// Generate reports if requested
			if (options.report) {
				await this.generateReport(results, stats, options);
			}

			return { results, stats, skippedFiles, failedFiles };

		} catch (error) {
			this.cleanupProgressTracking();
			throw error;
		}
	}

	private async performSafetyChecks(options: SvgOptions): Promise<void> {
		// Check version control if not forced
		if (!options.force && !options.dryRun) {
			const vcs = detectVersionControl();
			if (!vcs.detected) {
				throw new Error(
					'No version control system detected. Use --force to proceed without VCS, or initialize git/svn/hg/bzr first.'
				);
			}
		}

		// Validate output directory if specified
		if (options.outputDir) {
			const outputPath = resolvePath(options.outputDir);
			try {
				await fs.access(outputPath);
			} catch {
				// Directory doesn't exist, try to create it
				if (!options.dryRun) {
					await fs.mkdir(outputPath, { recursive: true });
				}
			}
		}

		// Validate configuration file if specified
		if (options.config) {
			const configPath = resolvePath(options.config);
			try {
				await fs.access(configPath);
			} catch {
				throw new Error(`Configuration file not found: ${configPath}`);
			}
		}
	}

	private async findSvgFiles(target: string, options: SvgOptions): Promise<string[]> {
		const targetPath = resolvePath(target);
		let patterns: string[] = [];

		// Handle different target types
		try {
			const stat = await fs.stat(targetPath);
			
			if (stat.isFile()) {
				// Single file
				if (!isSupportedSvgExtension(path.extname(targetPath).slice(1))) {
					throw new Error(`Unsupported file type: ${path.extname(targetPath)}`);
				}
				return [targetPath];
			} else if (stat.isDirectory()) {
				// Directory - create glob patterns
				const extensions = options.extensions ? 
					(typeof options.extensions === 'string' ? options.extensions.split(',') : options.extensions) : 
					[...DEFAULT_SVG_EXTENSIONS];
				if (options.glob) {
					patterns.push(path.join(targetPath, options.glob));
				} else {
					patterns.push(path.join(targetPath, `**/*.{${extensions.join(',')}}`));
				}
			}
		} catch {
			// Path doesn't exist, treat as glob pattern
			patterns.push(targetPath);
		}

		// Find files using fast-glob
		const files = await fastGlob(patterns, {
			ignore: [
				'**/node_modules/**',
				'**/.git/**',
				'**/*.min.svg',
				'**/*.optimized.svg',
				'**/*.original.svg',
				...(options.exclude || [])
			],
			absolute: true,
			onlyFiles: true
		});

		return files.filter((file: string) => isSupportedSvgExtension(path.extname(file).slice(1)));
	}

	private setupProgressTracking(totalFiles: number, options: SvgOptions): void {
		if (options.verbose) {
			// Use progress bar for verbose mode
			this.progressBar = new cliProgress.SingleBar({
				format: chalk.cyan('Optimizing SVGs') + ' [{bar}] {percentage}% | {value}/{total} files | ETA: {eta}s',
				barCompleteChar: '█',
				barIncompleteChar: '░',
				hideCursor: true
			}, cliProgress.Presets.shades_classic);
			this.progressBar.start(totalFiles, 0);
		} else {
			// Use spinner for normal mode
			this.spinner = ora({
				text: `Optimizing ${totalFiles} SVG files...`,
				color: 'cyan'
			}).start();
		}
	}

	private updateProgress(completed: number, total: number): void {
		if (this.progressBar) {
			this.progressBar.update(completed);
		} else if (this.spinner) {
			this.spinner.text = `Optimizing SVG files... ${completed}/${total}`;
		}
	}

	private cleanupProgressTracking(): void {
		if (this.progressBar) {
			this.progressBar.stop();
			this.progressBar = undefined;
		}
		if (this.spinner) {
			this.spinner.stop();
			this.spinner = undefined;
		}
	}

	private async processFilesSequential(
		files: string[],
		config: SvgProcessingConfig,
		options: SvgOptions,
		results: SvgOptimizationResult[],
		skippedFiles: string[],
		failedFiles: Array<{ file: string; error: string }>,
		stats: SvgStats
	): Promise<void> {
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			try {
				const result = await this.processSingleFile(file, config, options);
				if (result) {
					results.push(result);
					this.updateStats(stats, result);
				} else {
					skippedFiles.push(file);
					stats.filesSkipped++;
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				failedFiles.push({ file, error: errorMessage });
				stats.errors.push({ file, error: errorMessage });
			}
			
			this.updateProgress(i + 1, files.length);
		}
	}

	private async processFilesParallel(
		files: string[],
		config: SvgProcessingConfig,
		options: SvgOptions,
		results: SvgOptimizationResult[],
		skippedFiles: string[],
		failedFiles: Array<{ file: string; error: string }>,
		stats: SvgStats
	): Promise<void> {
		const concurrency = Math.min(options.maxConcurrency || 4, files.length);
		const chunks = this.chunkArray(files, Math.ceil(files.length / concurrency));
		
		let completed = 0;
		
		const processChunk = async (chunk: string[]) => {
			for (const file of chunk) {
				try {
					const result = await this.processSingleFile(file, config, options);
					if (result) {
						results.push(result);
						this.updateStats(stats, result);
					} else {
						skippedFiles.push(file);
						stats.filesSkipped++;
					}
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					failedFiles.push({ file, error: errorMessage });
					stats.errors.push({ file, error: errorMessage });
				}
				
				completed++;
				this.updateProgress(completed, files.length);
			}
		};

		await Promise.all(chunks.map(processChunk));
	}

	private async processSingleFile(
		filePath: string,
		config: SvgProcessingConfig,
		options: SvgOptions
	): Promise<SvgOptimizationResult | null> {
		const startTime = Date.now();
		
		try {
			// Read original file
			const originalContent = await fs.readFile(filePath, 'utf8');
			const originalSize = Buffer.byteLength(originalContent, 'utf8');

			// Validate input if required
			if (config.validateInput) {
				const validation = this.validateSvg(originalContent, filePath);
				if (!validation.isValid) {
					throw new Error(`Invalid SVG: ${validation.errors.join(', ')}`);
				}
			}

			// Skip if already optimized (basic heuristic)
			if (this.isAlreadyOptimized(originalContent, options)) {
				return null;
			}

			// Create SVGO configuration
			const svgoConfig = this.createSvgoConfig(config, options);

			// Optimize SVG
			const result = optimize(originalContent, svgoConfig);
			
			if ('error' in result) {
				throw new Error(`SVGO optimization failed: ${result.error}`);
			}

			const optimizedContent = result.data;
			const optimizedSize = Buffer.byteLength(optimizedContent, 'utf8');

			// Validate output if required
			if (config.validateOutput) {
				const validation = this.validateSvg(optimizedContent, filePath);
				if (!validation.isValid) {
					throw new Error(`Output validation failed: ${validation.errors.join(', ')}`);
				}
			}

			// Calculate metrics
			const bytesSaved = originalSize - optimizedSize;
			const compressionRatio = originalSize / optimizedSize;

			// Determine output path
			const outputPath = this.getOutputPath(filePath, options);

			// Handle output modes
			if (!options.dryRun) {
				await this.handleOutput(filePath, outputPath, originalContent, optimizedContent, options);
			}

			const processingTime = Date.now() - startTime;

			return {
				inputPath: filePath,
				outputPath,
				originalSize,
				optimizedSize,
				compressionRatio,
				bytesSaved,
				pluginsApplied: this.getAppliedPlugins(svgoConfig),
				processingTime,
				originalContent,
				optimizedContent
			};

		} catch (error) {
			throw new Error(`Failed to process ${path.basename(filePath)}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private validateSvg(content: string, filePath: string): SvgValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Basic SVG validation
		if (!isSvg(content)) {
			errors.push('Not a valid SVG file');
		}

		// Check for SVG root element
		if (!content.includes('<svg')) {
			errors.push('Missing SVG root element');
		}

		// Check file size
		const fileSize = Buffer.byteLength(content, 'utf8');
		if (fileSize === 0) {
			errors.push('Empty file');
		} else if (fileSize > 10 * 1024 * 1024) { // 10MB
			warnings.push('Large file size (>10MB)');
		}

		// Check for viewBox
		const hasViewBox = content.includes('viewBox');
		if (!hasViewBox) {
			warnings.push('Missing viewBox attribute');
		}

		// Check for accessibility elements
		const hasTitle = content.includes('<title');
		const hasDesc = content.includes('<desc');

		// Count elements (rough estimate)
		const elementCount = (content.match(/<[^\/][^>]*>/g) || []).length;

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
			fileSize,
			hasViewBox,
			hasTitle,
			hasDesc,
			elementCount
		};
	}

	private isAlreadyOptimized(content: string, options: SvgOptions): boolean {
		if (options.force) {
			return false;
		}

		// Basic heuristics for already optimized SVGs
		const indicators = [
			'<!-- Generated by SVGO -->',
			'<!-- Optimized by SVGO -->',
			'data-svgo',
			'.min.svg',
			'.optimized.svg'
		];

		return indicators.some(indicator => content.includes(indicator));
	}

	private createSvgoConfig(config: SvgProcessingConfig, options: SvgOptions): SvgoConfig {
		const plugins: any[] = [];

		// Use preset-default as the base for all presets
		const presetDefaultConfig: any = {
			name: 'preset-default',
			params: {
				overrides: {}
			}
		};

		// Configure based on preset and options
		if (config.keepIds) {
			presetDefaultConfig.params.overrides.cleanupIds = false;
		}

		if (config.keepTitles) {
			presetDefaultConfig.params.overrides.removeTitle = false;
			presetDefaultConfig.params.overrides.removeDesc = false;
		}

		// Advanced options
		if (options.removeViewbox) {
			presetDefaultConfig.params.overrides.removeViewBox = true;
		}

		if (options.sortAttrs) {
			presetDefaultConfig.params.overrides.sortAttrs = true;
		}

		if (options.removeXmlns) {
			presetDefaultConfig.params.overrides.removeXMLNS = true;
		}

		if (options.convertColors) {
			presetDefaultConfig.params.overrides.convertColors = true;
		}

		plugins.push(presetDefaultConfig);

		// Apply custom plugins
		if (config.customPlugins.length > 0) {
			plugins.push(...config.customPlugins);
		}

		const svgoConfig: SvgoConfig = {
			plugins,
			multipass: config.multipass,
			floatPrecision: config.precision
		};

		return svgoConfig;
	}

	private getOutputPath(inputPath: string, options: SvgOptions): string {
		const dir = path.dirname(inputPath);
		const name = path.basename(inputPath, path.extname(inputPath));
		const ext = path.extname(inputPath);

		if (options.outputDir) {
			return path.join(resolvePath(options.outputDir), path.basename(inputPath));
		}

		if (options.copy) {
			return path.join(dir, `${name}.optimized${ext}`);
		}

		// Default: in-place
		return inputPath;
	}

	private async handleOutput(
		inputPath: string,
		outputPath: string,
		originalContent: string,
		optimizedContent: string,
		options: SvgOptions
	): Promise<void> {
		// Handle backup
		if (options.backup && outputPath === inputPath) {
			const backupPath = inputPath.replace(/\.svg$/, '.original.svg');
			await fs.writeFile(backupPath, originalContent);
		}

		// Handle stdout
		if (options.stdout && !options.outputDir) {
			console.log(optimizedContent);
			return;
		}

		// Write optimized content
		await fs.writeFile(outputPath, optimizedContent);
	}

	private getAppliedPlugins(config: SvgoConfig): string[] {
		if (!config.plugins) return [];
		return config.plugins.map(plugin => 
			typeof plugin === 'string' ? plugin : plugin.name
		).filter(Boolean);
	}

	private updateStats(stats: SvgStats, result: SvgOptimizationResult): void {
		stats.filesProcessed++;
		stats.bytesProcessed += result.originalSize;
		stats.bytesOriginal += result.originalSize;
		stats.bytesOptimized += result.optimizedSize;
		stats.bytesSaved += result.bytesSaved;
		stats.operationsCompleted++;
	}

	private calculateFinalStats(stats: SvgStats, startTime: number): void {
		stats.processingTime = Date.now() - startTime;
		stats.avgCompressionRatio = stats.filesProcessed > 0 ? stats.bytesOriginal / stats.bytesOptimized : 0;
	}

	private chunkArray<T>(array: T[], chunkSize: number): T[][] {
		const chunks: T[][] = [];
		for (let i = 0; i < array.length; i += chunkSize) {
			chunks.push(array.slice(i, i + chunkSize));
		}
		return chunks;
	}

	private async generateReport(results: SvgOptimizationResult[], stats: SvgStats, options: SvgOptions): Promise<void> {
		if (!options.report) return;

		const reportData = {
			summary: stats,
			files: results.map(result => ({
				file: path.basename(result.inputPath),
				originalSize: result.originalSize,
				optimizedSize: result.optimizedSize,
				bytesSaved: result.bytesSaved,
				compressionRatio: result.compressionRatio,
				processingTime: result.processingTime,
				plugins: result.pluginsApplied
			}))
		};

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const reportPath = `svg-optimization-report-${timestamp}.${options.report}`;

		if (options.report === 'json') {
			await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
		} else if (options.report === 'csv') {
			const csv = this.convertToCsv(reportData.files);
			await fs.writeFile(reportPath, csv);
		}

		this.logger.info(`Report saved to: ${reportPath}`);
	}

	private convertToCsv(data: any[]): string {
		if (data.length === 0) return '';
		
		const headers = Object.keys(data[0]);
		const rows = data.map(row => headers.map(header => row[header]).join(','));
		
		return [headers.join(','), ...rows].join('\n');
	}
}