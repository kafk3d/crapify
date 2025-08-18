import { ASTAnalyzer } from './ast-analyzer';
import { FrameworkDetector } from './framework-detector';
import { ImportTransformer } from './import-transformer';
import { PathResolver } from './path-resolver';
import {
	ImportsProcessorOptions,
	ImportTransformResult,
	ImportTransformOptions,
	PathAlias
} from './types';

export class ImportsProcessor {
	private astAnalyzer: ASTAnalyzer;
	private transformer: ImportTransformer;
	private pathResolver: PathResolver;
	private frameworkDetector: FrameworkDetector;
	private options: Required<ImportsProcessorOptions>;

	constructor(options: ImportsProcessorOptions = {}) {
		this.options = {
			style: options.style || 'mixed',
			sort: options.sort !== false,
			group: options.group !== false,
			removeUnused: options.removeUnused !== false,
			mergeDuplicates: options.mergeDuplicates !== false,
			multilineThreshold: options.multilineThreshold || 3,
			aliases: options.aliases || [],
			preserveComments: options.preserveComments !== false,
			framework: options.framework || '',
			extensions: options.extensions || ['js', 'jsx', 'ts', 'tsx', 'vue', 'svelte'],
			verbose: options.verbose || false
		};

		this.astAnalyzer = new ASTAnalyzer();
		this.pathResolver = new PathResolver();
		this.frameworkDetector = new FrameworkDetector();

		this.initializeFramework();
		this.initializeAliases();

		this.transformer = new ImportTransformer(this.getTransformOptions());
	}

	processFile(content: string, filePath: string): ImportTransformResult {
		try {
			const originalImportCount = this.countImports(content);

			if (originalImportCount === 0) {
				return {
					content,
					modified: false,
					optimized: 0,
					unusedRemoved: 0,
					duplicatesMerged: 0,
					pathsConverted: 0
				};
			}

			const analysisResult = this.astAnalyzer.analyzeFile(content, filePath);

			let processedImports = [...analysisResult.imports];
			let unusedRemoved = 0;
			let duplicatesMerged = 0;
			let pathsConverted = 0;

			if (this.options.removeUnused) {
				const beforeCount = processedImports.length;
				processedImports = this.removeUnusedImports(
					processedImports,
					analysisResult.usedIdentifiers
				);
				unusedRemoved = beforeCount - processedImports.length;
			}

			if (this.options.mergeDuplicates) {
				const beforeCount = processedImports.length;
				processedImports = this.mergeDuplicateImports(processedImports);
				duplicatesMerged = beforeCount - processedImports.length;
			}

			if (this.options.style !== 'mixed') {
				pathsConverted = this.convertImportPaths(processedImports, filePath);
			}

			const hasContentChanges = unusedRemoved > 0 || duplicatesMerged > 0 || pathsConverted > 0;
			const hasStructureChanges = this.options.sort || this.options.group;

			if (!hasContentChanges && !hasStructureChanges) {
				return {
					content,
					modified: false,
					optimized: 0,
					unusedRemoved: 0,
					duplicatesMerged: 0,
					pathsConverted: 0
				};
			}

			let newContent = content;

			if (hasContentChanges) {
				const transformedImports = this.transformer.transformImports(
					processedImports,
					filePath,
					content
				);
				newContent = this.replaceImportsInContent(
					content,
					transformedImports,
					analysisResult.imports
				);
			} else if (hasStructureChanges) {
				newContent = this.reorderImportsInContent(
					content,
					processedImports,
					analysisResult.imports
				);
			}

			return {
				content: newContent,
				modified: content !== newContent,
				optimized: Math.max(unusedRemoved, duplicatesMerged, pathsConverted),
				unusedRemoved,
				duplicatesMerged,
				pathsConverted
			};
		} catch (error) {
			return {
				content,
				modified: false,
				optimized: 0,
				unusedRemoved: 0,
				duplicatesMerged: 0,
				pathsConverted: 0,
				errors: [(error as Error).message]
			};
		}
	}

	private initializeFramework(): void {
		let frameworkConfig = null;

		if (this.options.framework) {
			frameworkConfig = this.frameworkDetector.getFrameworkByName(this.options.framework);
		} else {
			frameworkConfig = this.frameworkDetector.detectFramework();
		}

		if (frameworkConfig) {
			if (this.options.verbose) {
			}

			this.pathResolver.addAliases(frameworkConfig.aliases);
		}
	}

	private initializeAliases(): void {
		if (this.options.aliases && this.options.aliases.length > 0) {
			this.pathResolver.addAliases(this.options.aliases);
		}
	}

	private getTransformOptions(): ImportTransformOptions {
		return {
			style: this.options.style,
			sort: this.options.sort,
			group: this.options.group,
			removeUnused: this.options.removeUnused,
			mergeDuplicates: this.options.mergeDuplicates,
			multilineThreshold: this.options.multilineThreshold,
			aliases: this.options.aliases,
			preserveComments: this.options.preserveComments
		};
	}

	private countImports(content: string): number {
		const importRegex = /^import\s+.*?from\s+['"][^'"]+['"];?$/gm;
		const matches = content.match(importRegex);
		return matches ? matches.length : 0;
	}

	private removeUnusedImports(imports: any[], usedIdentifiers: Set<string>): any[] {
		return imports
			.filter(importStmt => {
				return importStmt.specifiers.some((spec: any) => {
					return usedIdentifiers.has(spec.local);
				});
			})
			.map(importStmt => {
				const usedSpecifiers = importStmt.specifiers.filter((spec: any) => {
					return usedIdentifiers.has(spec.local);
				});

				return {
					...importStmt,
					specifiers: usedSpecifiers
				};
			});
	}

	private mergeDuplicateImports(imports: any[]): any[] {
		const sourceMap = new Map<string, any[]>();

		for (const importStmt of imports) {
			const key = `${importStmt.source}:${importStmt.importKind}`;
			if (!sourceMap.has(key)) {
				sourceMap.set(key, []);
			}
			sourceMap.get(key)!.push(importStmt);
		}

		const mergedImports: any[] = [];

		for (const [, group] of sourceMap) {
			if (group.length === 1) {
				mergedImports.push(group[0]);
			} else {
				mergedImports.push(this.astAnalyzer.mergeImports(group));
			}
		}

		return mergedImports;
	}

	private convertImportPaths(imports: any[], filePath: string): number {
		let converted = 0;

		for (const importStmt of imports) {
			const originalSource = importStmt.source;

			if (this.options.style === 'absolute') {
				importStmt.source = this.pathResolver.convertToAbsolute(originalSource, filePath);
			} else if (this.options.style === 'relative') {
				importStmt.source = this.pathResolver.convertToRelative(originalSource, filePath);
			}

			if (originalSource !== importStmt.source) {
				converted++;
			}
		}

		return converted;
	}

	private reorderImportsInContent(
		content: string,
		processedImports: any[],
		originalImports: any[]
	): string {
		if (originalImports.length === 0) return content;

		const sourceToString = new Map<string, string>();
		originalImports.forEach(imp => {
			const importString = content.substring(imp.startPos, imp.endPos);
			sourceToString.set(imp.source, importString);
		});

		let orderedImports = [...originalImports];

		if (this.options.group && this.options.sort) {
			orderedImports = this.groupImportsForReorder(orderedImports, true);
		} else if (this.options.group) {
			orderedImports = this.groupImportsForReorder(orderedImports, false);
		} else if (this.options.sort) {
			orderedImports = this.sortImportsForReorder(orderedImports);
		}

		const reorderedStrings = orderedImports
			.map(imp => sourceToString.get(imp.source) || '')
			.filter(Boolean);

		return this.replaceImportBlock(content, originalImports, reorderedStrings.join('\n'));
	}

	private replaceImportsInContent(
		content: string,
		transformedImports: string,
		originalImports: any[]
	): string {
		if (originalImports.length === 0) {
			return content;
		}

		const sortedImports = [...originalImports]
			.filter(imp => imp.startPos !== undefined && imp.endPos !== undefined)
			.sort((a, b) => b.startPos - a.startPos);

		if (sortedImports.length === 0) {
			return content;
		}

		let result = content;

		for (const importStmt of sortedImports) {
			const before = result.substring(0, importStmt.startPos);
			const after = result.substring(importStmt.endPos);
			result = before + after;
		}

		const firstImportPos = Math.min(...originalImports.map(i => i.startPos));
		const beforeFirst = result.substring(0, firstImportPos);
		const afterFirst = result.substring(firstImportPos);

		return beforeFirst + transformedImports + afterFirst;
	}

	private groupImportsForReorder(imports: any[], shouldSort: boolean = false): any[] {
		const groups: { external: any[]; internal: any[]; relative: any[] } = {
			external: [],
			internal: [],
			relative: []
		};

		for (const imp of imports) {
			if (imp.source.startsWith('.')) {
				groups.relative.push(imp);
			} else if (imp.source.startsWith('@/') || imp.source.startsWith('~/')) {
				groups.internal.push(imp);
			} else {
				groups.external.push(imp);
			}
		}

		if (shouldSort) {
			groups.external.sort((a, b) => a.source.localeCompare(b.source));
			groups.internal.sort((a, b) => a.source.localeCompare(b.source));
			groups.relative.sort((a, b) => a.source.localeCompare(b.source));
		}

		return [...groups.external, ...groups.internal, ...groups.relative];
	}

	private sortImportsForReorder(imports: any[]): any[] {
		return [...imports].sort((a, b) => a.source.localeCompare(b.source));
	}

	private replaceImportBlock(
		content: string,
		originalImports: any[],
		newImportsBlock: string
	): string {
		if (originalImports.length === 0) return content;

		const firstImport = originalImports.reduce((min, imp) =>
			imp.startPos < min.startPos ? imp : min
		);
		const lastImport = originalImports.reduce((max, imp) => (imp.endPos > max.endPos ? imp : max));

		const before = content.substring(0, firstImport.startPos);
		const after = content.substring(lastImport.endPos);

		return before + newImportsBlock + after;
	}

	static parseAliasesFromString(aliasString: string): PathAlias[] {
		return PathResolver.parseCliAliases(aliasString);
	}
}
