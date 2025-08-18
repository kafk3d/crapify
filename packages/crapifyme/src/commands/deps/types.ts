export interface PackageInfo {
	name: string;
	version: string;
	description?: string;
	homepage?: string;
	repository?: string | { type: string; url: string };
	keywords?: string[];
	license?: string;
}

export interface DependencyInfo {
	name: string;
	currentVersion: string;
	latestVersion?: string;
	wantedVersion?: string;
	isOutdated: boolean;
	isDev: boolean;
	isOptional: boolean;
	isPeer: boolean;
	size?: {
		raw: number;
		gzip: number;
		formatted: {
			raw: string;
			gzip: string;
		};
	};
	vulnerabilities?: SecurityVulnerability[];
	unusedReason?: string;
	duplicateVersions?: string[];
}

export interface SecurityVulnerability {
	id: string;
	packageName: string;
	title: string;
	description: string;
	severity: 'low' | 'moderate' | 'high' | 'critical';
	references: string[];
	vulnerable_versions: string;
	patched_versions?: string;
	recommendation?: string;
}

export interface PackageAlternative {
	name: string;
	description: string;
	compatibility: 'drop-in' | 'minor-changes' | 'major-refactor';
	sizeSavings: {
		raw: number;
		gzip: number;
		percentage: number;
	};
	features: string[];
	migrationComplexity: 1 | 2 | 3 | 4 | 5;
	npmWeeklyDownloads?: number;
	lastUpdated?: string;
	reason?: string;
}

export interface DependencyTreeNode {
	name: string;
	version: string;
	path: string;
	dependencies?: Map<string, DependencyTreeNode>;
	dev: boolean;
	optional: boolean;
	resolved?: string;
	overridden?: boolean;
}

export interface PackageManagerInfo {
	type: 'npm' | 'yarn' | 'pnpm';
	version: string;
	lockFile: string;
	workspaces?: string[];
	auditCommand: string;
}

export interface BundleAnalysis {
	totalSize: {
		raw: number;
		gzip: number;
		formatted: {
			raw: string;
			gzip: string;
		};
	};
	largestPackages: Array<{
		name: string;
		size: {
			raw: number;
			gzip: number;
			percentage: number;
		};
	}>;
	treeshakeable: string[];
	nonTreeshakeable: string[];
	sideEffects: string[];
}

export interface ProjectAnalysis {
	projectInfo: {
		name: string;
		version: string;
		path: string;
		packageManager: PackageManagerInfo;
	};
	dependencies: {
		production: DependencyInfo[];
		development: DependencyInfo[];
		peer: DependencyInfo[];
		optional: DependencyInfo[];
	};
	summary: {
		total: {
			production: number;
			development: number;
			peer: number;
			optional: number;
		};
		outdated: number;
		vulnerable: number;
		unused: number;
		duplicates: number;
		heavyPackages: number; 
	};
	security: {
		vulnerabilities: SecurityVulnerability[];
		auditSummary: {
			critical: number;
			high: number;
			moderate: number;
			low: number;
		};
	};
	bundle: BundleAnalysis;
	alternatives: Map<string, PackageAlternative[]>;
	unusedDependencies: string[];
	duplicateDependencies: Map<string, string[]>;
}

export interface DepsProcessorOptions {
	packageManager?: 'npm' | 'yarn' | 'pnpm' | 'auto';
	includeDevDependencies?: boolean;
	includePeerDependencies?: boolean;
	includeOptionalDependencies?: boolean;
	checkSecurity?: boolean;
	analyzeBundleSize?: boolean;
	suggestAlternatives?: boolean;
	checkUnused?: boolean;
	workspaces?: boolean;
	timeout?: number;
	cacheTimeout?: number;
	verbose?: boolean;
}

export interface DepsAnalysisResult {
	analysis: ProjectAnalysis;
	errors: Array<{
		type: 'security' | 'size' | 'outdated' | 'general';
		message: string;
		package?: string;
	}>;
	warnings: Array<{
		type: 'performance' | 'compatibility' | 'deprecation';
		message: string;
		package?: string;
	}>;
	processingTime: number;
	cacheMisses: number;
	cacheHits: number;
}

export interface DepsStats {
	filesAnalyzed: number;
	dependenciesScanned: number;
	vulnerabilitiesFound: number;
	outdatedPackages: number;
	unusedPackages: number;
	sizeSavingsIdentified: number;
	alternativesSuggested: number;
	errors: Array<{ message: string; type: string }>;
}

export interface AlternativeDatabase {
	[packageName: string]: {
		alternatives: PackageAlternative[];
		deprecated?: boolean;
		deprecationReason?: string;
		migrationGuide?: string;
	};
}

export enum DependencyType {
	PRODUCTION = 'production',
	DEVELOPMENT = 'development',
	PEER = 'peer',
	OPTIONAL = 'optional'
}

export enum AnalysisType {
	SECURITY = 'security',
	SIZE = 'size',
	OUTDATED = 'outdated',
	UNUSED = 'unused',
	DUPLICATES = 'duplicates',
	ALTERNATIVES = 'alternatives',
	FULL = 'full'
}

export enum OutputFormat {
	TABLE = 'table',
	JSON = 'json',
	TREE = 'tree',
	SUMMARY = 'summary'
}