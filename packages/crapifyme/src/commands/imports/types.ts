export interface ImportStatement {
	source: string;
	specifiers: ImportSpecifier[];
	importKind: 'value' | 'type' | 'typeof';
	startPos: number;
	endPos: number;
	leadingComments?: string[];
	trailingComments?: string[];
}

export interface ImportSpecifier {
	type: 'default' | 'namespace' | 'named';
	imported?: string;
	local: string;
	importKind?: 'value' | 'type' | 'typeof';
}

export interface ImportGroup {
	type: 'external' | 'internal' | 'relative';
	imports: ImportStatement[];
	priority: number;
}

export interface PathAlias {
	pattern: string;
	replacement: string;
	regex: RegExp;
}

export interface ImportAnalysisResult {
	imports: ImportStatement[];
	unusedImports: ImportStatement[];
	duplicateGroups: ImportStatement[][];
	usedIdentifiers: Set<string>;
	scopeChain: string[][];
}

export interface ImportTransformOptions {
	style?: 'absolute' | 'relative' | 'mixed';
	sort?: boolean;
	group?: boolean;
	removeUnused?: boolean;
	mergeDuplicates?: boolean;
	multilineThreshold?: number;
	aliases?: PathAlias[];
	preserveComments?: boolean;
}

export interface FrameworkConfig {
	name: string;
	aliases: PathAlias[];
	importExtensions: string[];
	specialPatterns: RegExp[];
}

export interface ImportsStats {
	filesProcessed: number;
	importsOptimized: number;
	unusedRemoved: number;
	duplicatesMerged: number;
	pathsConverted: number;
	errors: Array<{ file: string; error: string }>;
}

export interface ImportsProcessorOptions extends ImportTransformOptions {
	framework?: string;
	extensions?: string[];
	verbose?: boolean;
}

export interface ImportTransformResult {
	content: string;
	modified: boolean;
	optimized: number;
	unusedRemoved: number;
	duplicatesMerged: number;
	pathsConverted: number;
	errors?: string[];
	warnings?: string[];
}

export enum ImportGroupType {
	EXTERNAL = 'external',
	INTERNAL = 'internal',
	RELATIVE = 'relative'
}

export enum ImportStyle {
	ABSOLUTE = 'absolute',
	RELATIVE = 'relative',
	MIXED = 'mixed'
}
