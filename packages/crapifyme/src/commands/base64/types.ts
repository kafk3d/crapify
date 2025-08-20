export interface Base64Stats {
	filesProcessed: number;
	bytesProcessed: number;
	operationsCompleted: number;
	errors: Array<{ file?: string; operation?: string; error: string }>;
}

export interface Base64EncodingResult {
	dataUrl: string;
	cssBackgroundImage: string;
	rawBase64: string;
	originalSize: number;
	base64Size: number;
	mimeType: string;
	overhead: number;
}

export interface Base64DecodingResult {
	outputPath: string;
	originalSize: number;
	decodedSize: number;
	mimeType?: string;
	detectedFormat?: string;
}

export interface Base64Options {
	cssOnly?: boolean;
	dataUrlOnly?: boolean;
	raw?: boolean;
	quiet?: boolean;
	sizeInfo?: boolean;
	noSizeInfo?: boolean;
	output?: string;
}

export const SUPPORTED_IMAGE_EXTENSIONS = [
	'png',
	'jpg',
	'jpeg',
	'svg',
	'gif',
	'webp',
	'bmp',
	'ico',
	'tiff',
	'avif'
] as const;

export type SupportedImageExtension = (typeof SUPPORTED_IMAGE_EXTENSIONS)[number];

export function isSupportedImageExtension(ext: string): ext is SupportedImageExtension {
	return SUPPORTED_IMAGE_EXTENSIONS.includes(ext.toLowerCase() as SupportedImageExtension);
}
