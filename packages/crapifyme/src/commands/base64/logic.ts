import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import { lookup as mimeTypeLookup } from 'mime-types';
import { Logger } from '../../shared';
import {
	Base64EncodingResult,
	Base64DecodingResult,
	Base64Options,
	isSupportedImageExtension
} from './types';

export class Base64Processor {
	constructor(private logger: Logger) {}

	async encodeFile(filePath: string, options: Base64Options): Promise<Base64EncodingResult> {
		const absolutePath = path.resolve(filePath);
		
		// Check if file exists
		if (!fssync.existsSync(absolutePath)) {
			throw new Error(`File not found: ${filePath}`);
		}

		// Check file extension
		const ext = path.extname(absolutePath).slice(1).toLowerCase();
		if (!isSupportedImageExtension(ext)) {
			throw new Error(`Unsupported file format: .${ext}. Supported formats: png, jpg, jpeg, svg, gif, webp, bmp, ico, tiff, avif`);
		}

		// Read file
		const fileBuffer = await fs.readFile(absolutePath);
		const originalSize = fileBuffer.length;

		// Detect MIME type
		const mimeType = mimeTypeLookup(absolutePath) || `image/${ext === 'svg' ? 'svg+xml' : ext}`;

		// Encode to base64
		const rawBase64 = fileBuffer.toString('base64');
		const base64Size = rawBase64.length;

		// Create formats
		const dataUrl = `data:${mimeType};base64,${rawBase64}`;
		const cssBackgroundImage = `background-image: url("${dataUrl}");`;

		// Calculate overhead
		const overhead = ((base64Size - originalSize) / originalSize) * 100;

		return {
			dataUrl,
			cssBackgroundImage,
			rawBase64,
			originalSize,
			base64Size,
			mimeType,
			overhead
		};
	}

	async decodeBase64(input: string, outputPath?: string): Promise<Base64DecodingResult> {
		let base64Data: string;
		let mimeType: string | undefined;
		let detectedFormat: string | undefined;

		// Parse input - check if it's a data URL
		if (input.startsWith('data:')) {
			const match = input.match(/^data:([^;]+);base64,(.+)$/);
			if (!match) {
				throw new Error('Invalid data URL format');
			}
			mimeType = match[1];
			base64Data = match[2];
			
			// Extract format from MIME type
			if (mimeType.startsWith('image/')) {
				detectedFormat = mimeType.split('/')[1];
				if (detectedFormat === 'svg+xml') detectedFormat = 'svg';
			}
		} else {
			// Assume raw base64
			base64Data = input;
		}

		// Validate base64
		if (!this.isValidBase64(base64Data)) {
			throw new Error('Invalid base64 string');
		}

		// Decode
		const buffer = Buffer.from(base64Data, 'base64');
		const decodedSize = buffer.length;

		// Determine output path
		let finalOutputPath: string;
		if (outputPath) {
			finalOutputPath = path.resolve(outputPath);
		} else {
			// Generate filename
			const timestamp = Date.now();
			const extension = detectedFormat || 'bin';
			finalOutputPath = path.resolve(`decoded_${timestamp}.${extension}`);
		}

		// Ensure output directory exists
		const outputDir = path.dirname(finalOutputPath);
		await fs.mkdir(outputDir, { recursive: true });

		// Write file
		await fs.writeFile(finalOutputPath, buffer);

		return {
			outputPath: finalOutputPath,
			originalSize: base64Data.length,
			decodedSize,
			mimeType,
			detectedFormat
		};
	}

	private isValidBase64(str: string): boolean {
		try {
			return Buffer.from(str, 'base64').toString('base64') === str;
		} catch {
			return false;
		}
	}

	formatSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	}

	validateFilePath(filePath: string): void {
		const absolutePath = path.resolve(filePath);
		
		if (!fssync.existsSync(absolutePath)) {
			throw new Error(`File not found: ${filePath}`);
		}

		const stats = fssync.statSync(absolutePath);
		if (!stats.isFile()) {
			throw new Error(`Path is not a file: ${filePath}`);
		}

		// Check file size (limit to 100MB as per spec)
		const maxSize = 100 * 1024 * 1024; // 100MB
		if (stats.size > maxSize) {
			throw new Error(`File too large (${this.formatSize(stats.size)}). Maximum size is ${this.formatSize(maxSize)}.`);
		}
	}
}