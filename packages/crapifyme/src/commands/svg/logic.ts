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
			await this.performSafetyChecks(options);

			const files = await this.findSvgFiles(target, options);

			if (files.length === 0) {
				this.logger.warn('No SVG files found to process');
				return { results, stats, skippedFiles, failedFiles };
			}

			const config = createProcessingConfig(options);

			if (!options.quiet && files.length > 1) {
				this.setupProgressTracking(files.length, options);
			}

			if (options.parallel && files.length > 1) {
				await this.processFilesParallel(
					files,
					config,
					options,
					results,
					skippedFiles,
					failedFiles,
					stats
				);
			} else {
				await this.processFilesSequential(
					files,
					config,
					options,
					results,
					skippedFiles,
					failedFiles,
					stats
				);
			}

			this.cleanupProgressTracking();

			this.calculateFinalStats(stats, startTime);

			if (options.report) {
				await this.generateReport(results, stats, options);
			}

			return { results, stats, skippedFiles, failedFiles };
		} catch (error) {
			this.cleanupProgressTracking();
			throw error;
		}
	}

	async processSvgCode(svgContent: string, options: SvgOptions): Promise<SvgOptimizationResult> {
		const startTime = Date.now();

		try {
			const originalSize = Buffer.byteLength(svgContent, 'utf8');

			const config = createProcessingConfig(options);

			if (config.validateInput) {
				const validation = this.validateSvg(svgContent, 'direct-input');
				if (!validation.isValid) {
					throw new Error(`Invalid SVG: ${validation.errors.join(', ')}`);
				}
			}

			const svgoConfig = this.createSvgoConfig(config, options);

			const result = optimize(svgContent, svgoConfig);

			if ('error' in result) {
				throw new Error(`SVGO optimization failed: ${result.error}`);
			}

			const optimizedContent = result.data;
			const optimizedSize = Buffer.byteLength(optimizedContent, 'utf8');

			if (config.validateOutput) {
				const validation = this.validateSvg(optimizedContent, 'direct-output');
				if (!validation.isValid) {
					throw new Error(`Output validation failed: ${validation.errors.join(', ')}`);
				}
			}

			const bytesSaved = originalSize - optimizedSize;
			const compressionRatio = originalSize / optimizedSize;
			const processingTime = Date.now() - startTime;

			return {
				inputPath: 'direct-input',
				outputPath: 'stdout',
				originalSize,
				optimizedSize,
				compressionRatio,
				bytesSaved,
				pluginsApplied: this.getAppliedPlugins(svgoConfig),
				processingTime,
				originalContent: svgContent,
				optimizedContent
			};
		} catch (error) {
			throw new Error(
				`Failed to process SVG code: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	private async performSafetyChecks(options: SvgOptions): Promise<void> {
		if (!options.force && !options.dryRun) {
			const vcs = detectVersionControl();
			if (!vcs.detected) {
				throw new Error(
					'No version control system detected. Use --force to proceed without VCS, or initialize git/svn/hg/bzr first.'
				);
			}
		}

		if (options.outputDir) {
			const outputPath = resolvePath(options.outputDir);
			try {
				await fs.access(outputPath);
			} catch {
				if (!options.dryRun) {
					await fs.mkdir(outputPath, { recursive: true });
				}
			}
		}

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

		try {
			const stat = await fs.stat(targetPath);

			if (stat.isFile()) {
				if (!isSupportedSvgExtension(path.extname(targetPath).slice(1))) {
					throw new Error(`Unsupported file type: ${path.extname(targetPath)}`);
				}
				return [targetPath];
			} else if (stat.isDirectory()) {
				const extensions = options.extensions
					? typeof options.extensions === 'string'
						? options.extensions.split(',')
						: options.extensions
					: [...DEFAULT_SVG_EXTENSIONS];
				if (options.glob) {
					patterns.push(path.join(targetPath, options.glob));
				} else {
					if (extensions.length === 1) {
						patterns.push(path.join(targetPath, `**/*.${extensions[0]}`));
					} else {
						patterns.push(path.join(targetPath, `**/*.{${extensions.join(',')}}`));
					}
				}
			}
		} catch {
			patterns.push(targetPath);
		}

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
			this.progressBar = new cliProgress.SingleBar(
				{
					format:
						chalk.cyan('Optimizing SVGs') +
						' [{bar}] {percentage}% | {value}/{total} files | ETA: {eta}s',
					barCompleteChar: '█',
					barIncompleteChar: '░',
					hideCursor: true
				},
				cliProgress.Presets.shades_classic
			);
			this.progressBar.start(totalFiles, 0);
		} else {
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
			const originalContent = await fs.readFile(filePath, 'utf8');
			const originalSize = Buffer.byteLength(originalContent, 'utf8');

			if (config.validateInput) {
				const validation = this.validateSvg(originalContent, filePath);
				if (!validation.isValid) {
					throw new Error(`Invalid SVG: ${validation.errors.join(', ')}`);
				}
			}

			if (this.isAlreadyOptimized(originalContent, options)) {
				return null;
			}

			const svgoConfig = this.createSvgoConfig(config, options);

			const result = optimize(originalContent, svgoConfig);

			if ('error' in result) {
				throw new Error(`SVGO optimization failed: ${result.error}`);
			}

			const optimizedContent = result.data;
			const optimizedSize = Buffer.byteLength(optimizedContent, 'utf8');

			if (config.validateOutput) {
				const validation = this.validateSvg(optimizedContent, filePath);
				if (!validation.isValid) {
					throw new Error(`Output validation failed: ${validation.errors.join(', ')}`);
				}
			}

			const bytesSaved = originalSize - optimizedSize;
			const compressionRatio = originalSize / optimizedSize;

			const outputPath = this.getOutputPath(filePath, options);

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
			throw new Error(
				`Failed to process ${path.basename(filePath)}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	private validateSvg(content: string, filePath: string): SvgValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (!isSvg(content)) {
			errors.push('Not a valid SVG file');
		}

		if (!content.includes('<svg')) {
			errors.push('Missing SVG root element');
		}

		const fileSize = Buffer.byteLength(content, 'utf8');
		if (fileSize === 0) {
			errors.push('Empty file');
		} else if (fileSize > 10 * 1024 * 1024) {
			warnings.push('Large file size (>10MB)');
		}

		const hasViewBox = content.includes('viewBox');
		if (!hasViewBox) {
			warnings.push('Missing viewBox attribute');
		}

		const hasTitle = content.includes('<title');
		const hasDesc = content.includes('<desc');

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

		const presetDefaultConfig: any = {
			name: 'preset-default',
			params: {
				overrides: {}
			}
		};

		if (config.keepIds) {
			presetDefaultConfig.params.overrides.cleanupIds = false;
		}

		if (config.keepTitles) {
			presetDefaultConfig.params.overrides.removeTitle = false;
			presetDefaultConfig.params.overrides.removeDesc = false;
		}

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

		return inputPath;
	}

	private async handleOutput(
		inputPath: string,
		outputPath: string,
		originalContent: string,
		optimizedContent: string,
		options: SvgOptions
	): Promise<void> {
		if (options.backup && outputPath === inputPath) {
			const backupPath = inputPath.replace(/\.svg$/, '.original.svg');
			await fs.writeFile(backupPath, originalContent);
		}

		if (options.stdout && !options.outputDir) {
			console.log(optimizedContent);
			return;
		}

		await fs.writeFile(outputPath, optimizedContent);
	}

	private getAppliedPlugins(config: SvgoConfig): string[] {
		if (!config.plugins) return [];
		return config.plugins
			.map(plugin => (typeof plugin === 'string' ? plugin : plugin.name))
			.filter(Boolean);
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
		stats.avgCompressionRatio =
			stats.filesProcessed > 0 ? stats.bytesOriginal / stats.bytesOptimized : 0;
	}

	private chunkArray<T>(array: T[], chunkSize: number): T[][] {
		const chunks: T[][] = [];
		for (let i = 0; i < array.length; i += chunkSize) {
			chunks.push(array.slice(i, i + chunkSize));
		}
		return chunks;
	}

	private async generateReport(
		results: SvgOptimizationResult[],
		stats: SvgStats,
		options: SvgOptions
	): Promise<void> {
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
