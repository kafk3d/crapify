export interface SvgStats {
	filesProcessed: number;
	filesSkipped: number;
	bytesProcessed: number;
	bytesOriginal: number;
	bytesOptimized: number;
	bytesSaved: number;
	avgCompressionRatio: number;
	operationsCompleted: number;
	processingTime: number;
	errors: Array<{ file: string; operation?: string; error: string }>;
	warnings: Array<{ file: string; warning: string }>;
}

export interface SvgOptimizationResult {
	inputPath: string;
	outputPath: string;
	originalSize: number;
	optimizedSize: number;
	compressionRatio: number;
	bytesSaved: number;
	pluginsApplied: string[];
	processingTime: number;
	originalContent: string;
	optimizedContent: string;
	errors?: string[];
	warnings?: string[];
}

export interface SvgBatchResult {
	results: SvgOptimizationResult[];
	stats: SvgStats;
	skippedFiles: string[];
	failedFiles: Array<{ file: string; error: string }>;
}

export interface SvgOptions {
	// Output modes
	inPlace?: boolean;
	copy?: boolean;
	backup?: boolean;
	stdout?: boolean;
	outputDir?: string;

	// Optimization presets
	preset?: 'minimal' | 'balanced' | 'aggressive';
	config?: string;
	
	// SVGO configuration
	plugins?: string[] | string;
	precision?: number;
	keepIds?: boolean;
	keepTitles?: boolean;
	multipass?: boolean;
	
	// File processing
	glob?: string;
	recursive?: boolean;
	extensions?: string[] | string;
	exclude?: string[] | string;
	
	// Safety and performance
	dryRun?: boolean;
	force?: boolean;
	parallel?: boolean;
	maxConcurrency?: number;
	watch?: boolean;
	
	// Reporting
	verbose?: boolean;
	quiet?: boolean;
	json?: boolean;
	report?: string;
	sizeInfo?: boolean;
	
	// Advanced options
	inlineStyles?: boolean;
	removeViewbox?: boolean;
	sortAttrs?: boolean;
	removeXmlns?: boolean;
	minifyStyles?: boolean;
	convertColors?: boolean;
	
	// Validation
	validateInput?: boolean;
	validateOutput?: boolean;
	skipValidation?: boolean;
}

export interface SvgPreset {
	name: string;
	description: string;
	plugins: any[];
	multipass?: boolean;
	precision?: number;
	options?: Record<string, any>;
}

export interface SvgValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
	fileSize: number;
	hasViewBox: boolean;
	hasTitle: boolean;
	hasDesc: boolean;
	elementCount: number;
}

export interface SvgProcessingConfig {
	preset: SvgPreset;
	customPlugins: any[];
	precision: number;
	multipass: boolean;
	keepIds: boolean;
	keepTitles: boolean;
	validateInput: boolean;
	validateOutput: boolean;
}

export const DEFAULT_SVG_EXTENSIONS = ['svg'] as const;
export type SupportedSvgExtension = typeof DEFAULT_SVG_EXTENSIONS[number];

export const SVG_PRESETS: Record<string, SvgPreset> = {
	minimal: {
		name: 'minimal',
		description: 'Light optimization, preserves most attributes and structure',
		plugins: [
			'preset-default'
		]
	},
	balanced: {
		name: 'balanced',
		description: 'Balanced optimization with good compression while maintaining usability',
		plugins: [
			'preset-default'
		],
		multipass: true,
		precision: 2
	},
	aggressive: {
		name: 'aggressive',
		description: 'Maximum compression with potential loss of some functionality',
		plugins: [
			'preset-default'
		],
		multipass: true,
		precision: 1
	}
};

export function isSupportedSvgExtension(ext: string): ext is SupportedSvgExtension {
	return DEFAULT_SVG_EXTENSIONS.includes(ext.toLowerCase() as SupportedSvgExtension);
}

export function getSvgPreset(name: string): SvgPreset {
	const preset = SVG_PRESETS[name];
	if (!preset) {
		throw new Error(`Unknown preset: ${name}. Available presets: ${Object.keys(SVG_PRESETS).join(', ')}`);
	}
	return preset;
}

export function createProcessingConfig(options: SvgOptions): SvgProcessingConfig {
	const preset = getSvgPreset(options.preset || 'balanced');
	
	return {
		preset,
		customPlugins: options.plugins ? 
			(Array.isArray(options.plugins) ? 
				options.plugins.map((p: string) => ({ name: p })) : 
				[{ name: options.plugins }]
			) : [],
		precision: options.precision ?? preset.precision ?? 2,
		multipass: options.multipass ?? preset.multipass ?? false,
		keepIds: options.keepIds ?? false,
		keepTitles: options.keepTitles ?? false,
		validateInput: options.validateInput ?? true,
		validateOutput: options.validateOutput ?? true
	};
}