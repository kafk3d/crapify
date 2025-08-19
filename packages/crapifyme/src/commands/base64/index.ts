import { Command } from 'commander';
import path from 'path';
import {
	Logger,
	ExitCode,
	showComplete
} from '../../shared';
import { Base64Processor } from './logic';
import { Base64Stats, Base64Options } from './types';

export const base64Command = new Command('base64')
	.description('Encode images to base64 format or decode base64 strings to files')
	.argument('[file]', 'Image file to encode (shorthand for encode command)')
	.option('--css-only', 'Output only CSS background-image format')
	.option('--data-url-only', 'Output only data URL format')
	.option('--raw', 'Output raw base64 string without data URL wrapper')
	.option('--size-info', 'Show detailed size analysis')
	.addHelpText('after', `
Examples:
  $ crapifyme base64 image.png                    # Encode image to base64 (default)
  $ crapifyme base64 encode image.jpg             # Explicit encode
  $ crapifyme base64 decode <base64> -o out.png   # Decode base64 to file
  $ crapifyme base64 image.svg --css-only         # Output only CSS format
  $ crapifyme base64 icon.ico --data-url-only     # Output only data URL format
  $ crapifyme base64 photo.jpg --raw              # Output raw base64 only
  $ crapifyme base64 image.png --size-info        # Include detailed size analysis

Supported formats: png, jpg, jpeg, svg, gif, webp, bmp, ico, tiff, avif
`)
	.action(async (file: string | undefined, options: Base64Options, command: Command) => {
		if (file) {
			await handleEncode(file, options, command);
		} else {
			command.help();
		}
	});

// Encode subcommand
base64Command
	.command('encode')
	.description('Encode image file to base64 format')
	.argument('<file>', 'Image file to encode')
	.option('--css-only', 'Output only CSS background-image format')
	.option('--data-url-only', 'Output only data URL format')
	.option('--raw', 'Output raw base64 string without data URL wrapper')
	.option('--size-info', 'Show detailed size analysis')
	.action(async (file: string, options: any, command: Command) => {
		await handleEncode(file, options, command);
	});

// Decode subcommand
base64Command
	.command('decode')
	.description('Decode base64 string to file')
	.argument('<base64-string>', 'Base64 string or data URL to decode')
	.option('-o, --output <path>', 'Output file path (auto-generated if not specified)')
	.action(async (base64String: string, options: any, command: Command) => {
		await handleDecode(base64String, options, command);
	});

async function handleEncode(filePath: string, options: Base64Options, command: Command): Promise<void> {
	const globalOptions = command.parent?.parent?.opts() || {};
	const logger = new Logger(globalOptions.verbose, globalOptions.quiet, globalOptions.json);

	try {
		const processor = new Base64Processor(logger);
		
		// Validate file
		processor.validateFilePath(filePath);
		
		if (globalOptions.verbose) {
			logger.info(`Encoding: ${filePath}`);
		}

		const result = await processor.encodeFile(filePath, options);
		
		const stats: Base64Stats = {
			filesProcessed: 1,
			bytesProcessed: result.originalSize,
			operationsCompleted: 1,
			errors: []
		};

		if (globalOptions.json) {
			logger.json({
				...result,
				stats
			});
		} else {
			if (!options.quiet && !globalOptions.quiet) {
				showComplete();
				logger.success(`Encoded: ${path.basename(filePath)}`);
				
				if (options.sizeInfo || globalOptions.verbose) {
					console.log(`  ┣ Original size: ${processor.formatSize(result.originalSize)}`);
					console.log(`  ┣ Base64 size: ${processor.formatSize(result.base64Size)}`);
					console.log(`  ┣ Overhead: ${result.overhead.toFixed(1)}%`);
					console.log(`  ┗ MIME type: ${result.mimeType}`);
					console.log('');
				}
			}

			// Output formats based on options
			if (options.raw) {
				console.log(result.rawBase64);
			} else if (options.cssOnly) {
				console.log(result.cssBackgroundImage);
			} else if (options.dataUrlOnly) {
				console.log(result.dataUrl);
			} else {
				// Default: show both formats
				console.log('Data URL:');
				console.log(result.dataUrl);
				console.log('');
				console.log('CSS Background Image:');
				console.log(result.cssBackgroundImage);
			}
		}

		process.exit(ExitCode.Success);
	} catch (error) {
		logger.error('Encoding failed', error as Error);
		process.exit(ExitCode.Error);
	}
}

async function handleDecode(base64String: string, options: { output?: string }, command: Command): Promise<void> {
	const globalOptions = command.parent?.parent?.opts() || {};
	const logger = new Logger(globalOptions.verbose, globalOptions.quiet, globalOptions.json);

	try {
		const processor = new Base64Processor(logger);
		
		if (globalOptions.verbose) {
			logger.info('Decoding base64 string');
		}

		const result = await processor.decodeBase64(base64String, options.output);
		
		const stats: Base64Stats = {
			filesProcessed: 1,
			bytesProcessed: result.originalSize,
			operationsCompleted: 1,
			errors: []
		};

		if (globalOptions.json) {
			logger.json({
				...result,
				stats
			});
		} else {
			if (!globalOptions.quiet) {
				showComplete();
				logger.success(`Decoded to: ${result.outputPath}`);
				
				if (globalOptions.verbose) {
					console.log(`  ┣ Base64 size: ${processor.formatSize(result.originalSize)}`);
					console.log(`  ┣ Decoded size: ${processor.formatSize(result.decodedSize)}`);
					if (result.mimeType) {
						console.log(`  ┣ MIME type: ${result.mimeType}`);
					}
					if (result.detectedFormat) {
						console.log(`  ┗ Format: ${result.detectedFormat}`);
					}
				}
			} else {
				// In quiet mode, just output the file path
				console.log(result.outputPath);
			}
		}

		process.exit(ExitCode.Success);
	} catch (error) {
		logger.error('Decoding failed', error as Error);
		process.exit(ExitCode.Error);
	}
}