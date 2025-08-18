import {
	ImportStatement,
	ImportSpecifier,
	ImportGroup,
	ImportGroupType,
	ImportStyle,
	ImportTransformOptions,
	PathAlias
} from './types';

export class ImportTransformer {
	private options: Required<ImportTransformOptions>;
	private indentation: string = '  ';

	constructor(options: ImportTransformOptions = {}) {
		this.options = {
			style: options.style || 'mixed',
			sort: options.sort !== false,
			group: options.group !== false,
			removeUnused: options.removeUnused !== false,
			mergeDuplicates: options.mergeDuplicates !== false,
			multilineThreshold: options.multilineThreshold || 3,
			aliases: options.aliases || [],
			preserveComments: options.preserveComments !== false
		};
	}

	transformImports(imports: ImportStatement[], filePath: string, originalContent?: string): string {
		if (originalContent) {
			this.detectIndentation(originalContent);
		}
		let processedImports = [...imports];

		if (this.options.mergeDuplicates) {
			processedImports = this.mergeDuplicateImports(processedImports);
		}

		if (this.options.removeUnused) {
			processedImports = this.removeUnusedImports(processedImports);
		}

		if (this.options.style !== 'mixed') {
			processedImports = this.convertImportPaths(processedImports, filePath);
		}

		if (this.options.group) {
			const groups = this.groupImports(processedImports);
			return this.renderImportGroups(groups);
		}

		if (this.options.sort) {
			processedImports = this.sortImports(processedImports);
		}

		return this.renderImports(processedImports);
	}

	private detectIndentation(content: string): void {
		const multilineMatch = content.match(/import\s*{[^}]*\n(\s+)[^}]/);
		if (multilineMatch && multilineMatch[1]) {
			this.indentation = multilineMatch[1];
			return;
		}

		const lines = content.split('\n');
		for (const line of lines) {
			const match = line.match(/^(\s+)\S/);
			if (match && match[1]) {
				this.indentation = match[1];
				return;
			}
		}
	}

	private mergeDuplicateImports(imports: ImportStatement[]): ImportStatement[] {
		const sourceMap = new Map<string, ImportStatement[]>();

		for (const importStmt of imports) {
			const key = `${importStmt.source}:${importStmt.importKind}`;
			if (!sourceMap.has(key)) {
				sourceMap.set(key, []);
			}
			sourceMap.get(key)!.push(importStmt);
		}

		const mergedImports: ImportStatement[] = [];

		for (const [, group] of sourceMap) {
			if (group.length === 1) {
				mergedImports.push(group[0]);
			} else {
				mergedImports.push(this.mergeImportGroup(group));
			}
		}

		return mergedImports;
	}

	private mergeImportGroup(imports: ImportStatement[]): ImportStatement {
		const mergedSpecifiers: ImportSpecifier[] = [];
		const seenLocals = new Set<string>();

		for (const importStmt of imports) {
			for (const spec of importStmt.specifiers) {
				const key = `${spec.type}:${spec.local}:${spec.imported || ''}`;
				if (!seenLocals.has(key)) {
					mergedSpecifiers.push(spec);
					seenLocals.add(key);
				}
			}
		}

		return {
			source: imports[0].source,
			specifiers: mergedSpecifiers,
			importKind: imports[0].importKind,
			startPos: Math.min(...imports.map(i => i.startPos)),
			endPos: Math.max(...imports.map(i => i.endPos)),
			leadingComments: imports[0].leadingComments,
			trailingComments: imports[imports.length - 1].trailingComments
		};
	}

	private removeUnusedImports(imports: ImportStatement[]): ImportStatement[] {
		return imports.filter(importStmt => {
			return importStmt.specifiers.length > 0;
		});
	}

	private convertImportPaths(imports: ImportStatement[], filePath: string): ImportStatement[] {
		return imports.map(importStmt => {
			const convertedSource = this.convertPath(importStmt.source, filePath);
			return { ...importStmt, source: convertedSource };
		});
	}

	private convertPath(importPath: string, filePath: string): string {
		if (this.isExternalModule(importPath)) {
			return importPath;
		}

		for (const alias of this.options.aliases) {
			if (alias.regex.test(importPath)) {
				return importPath.replace(alias.regex, alias.replacement);
			}
		}

		if (this.options.style === ImportStyle.ABSOLUTE) {
			return this.toAbsolutePath(importPath, filePath);
		} else if (this.options.style === ImportStyle.RELATIVE) {
			return this.toRelativePath(importPath, filePath);
		}

		return importPath;
	}

	private isExternalModule(path: string): boolean {
		return (
			!path.startsWith('.') &&
			!path.startsWith('/') &&
			!path.startsWith('@/') &&
			!path.startsWith('~/')
		);
	}

	private toAbsolutePath(importPath: string, filePath: string): string {
		if (importPath.startsWith('./')) {
			const dir = filePath.split('/').slice(0, -1).join('/');
			return `@/${dir}/${importPath.slice(2)}`.replace(/\/+/g, '/');
		}
		if (importPath.startsWith('../')) {
			const dir = filePath.split('/').slice(0, -1);
			const parts = importPath.split('/');
			let upCount = 0;
			for (const part of parts) {
				if (part === '..') {
					upCount++;
					dir.pop();
				} else if (part !== '.') {
					dir.push(part);
				}
			}
			return `@/${dir.join('/')}`.replace(/\/+/g, '/');
		}
		return importPath;
	}

	private toRelativePath(importPath: string, filePath: string): string {
		if (importPath.startsWith('@/')) {
			const currentDir = filePath.split('/').slice(0, -1);
			const targetPath = importPath.slice(2).split('/');

			let relativePath = '';
			let commonIndex = 0;

			while (
				commonIndex < Math.min(currentDir.length, targetPath.length) &&
				currentDir[commonIndex] === targetPath[commonIndex]
			) {
				commonIndex++;
			}

			const upLevels = currentDir.length - commonIndex;
			relativePath = '../'.repeat(upLevels);
			relativePath += targetPath.slice(commonIndex).join('/');

			return relativePath || './';
		}
		return importPath;
	}

	private groupImports(imports: ImportStatement[]): ImportGroup[] {
		const groups: Map<ImportGroupType, ImportStatement[]> = new Map([
			[ImportGroupType.EXTERNAL, []],
			[ImportGroupType.INTERNAL, []],
			[ImportGroupType.RELATIVE, []]
		]);

		for (const importStmt of imports) {
			const groupType = this.getImportGroupType(importStmt.source);
			groups.get(groupType)!.push(importStmt);
		}

		const result: ImportGroup[] = [];

		if (groups.get(ImportGroupType.EXTERNAL)!.length > 0) {
			result.push({
				type: ImportGroupType.EXTERNAL,
				imports: this.sortImports(groups.get(ImportGroupType.EXTERNAL)!),
				priority: 1
			});
		}

		if (groups.get(ImportGroupType.INTERNAL)!.length > 0) {
			result.push({
				type: ImportGroupType.INTERNAL,
				imports: this.sortImports(groups.get(ImportGroupType.INTERNAL)!),
				priority: 2
			});
		}

		if (groups.get(ImportGroupType.RELATIVE)!.length > 0) {
			result.push({
				type: ImportGroupType.RELATIVE,
				imports: this.sortImports(groups.get(ImportGroupType.RELATIVE)!),
				priority: 3
			});
		}

		return result;
	}

	private getImportGroupType(source: string): ImportGroupType {
		if (source.startsWith('.')) {
			return ImportGroupType.RELATIVE;
		}
		if (source.startsWith('@/') || source.startsWith('~/')) {
			return ImportGroupType.INTERNAL;
		}
		return ImportGroupType.EXTERNAL;
	}

	private sortImports(imports: ImportStatement[]): ImportStatement[] {
		return imports.slice().sort((a, b) => {
			return a.source.localeCompare(b.source);
		});
	}

	private renderImportGroups(groups: ImportGroup[]): string {
		return groups
			.sort((a, b) => a.priority - b.priority)
			.map(group => this.renderImports(group.imports))
			.filter(group => group.trim().length > 0)
			.join('\n\n');
	}

	private renderImports(imports: ImportStatement[]): string {
		return imports.map(importStmt => this.renderImport(importStmt)).join('\n');
	}

	private renderImport(importStmt: ImportStatement): string {
		const comments = this.renderComments(importStmt);
		const importLine = this.renderImportLine(importStmt);

		return comments ? `${comments}\n${importLine}` : importLine;
	}

	private renderComments(importStmt: ImportStatement): string {
		if (!this.options.preserveComments) return '';

		const comments: string[] = [];

		if (importStmt.leadingComments) {
			comments.push(...importStmt.leadingComments.map(c => `// ${c}`));
		}

		return comments.join('\n');
	}

	private renderImportLine(importStmt: ImportStatement): string {
		const typePrefix = importStmt.importKind === 'type' ? 'type ' : '';

		if (importStmt.specifiers.length === 0) {
			return `import${typePrefix ? ` ${typePrefix}` : ''} '${importStmt.source}';`;
		}

		const defaultSpecs = importStmt.specifiers.filter(s => s.type === 'default');
		const namespaceSpecs = importStmt.specifiers.filter(s => s.type === 'namespace');
		const namedSpecs = importStmt.specifiers.filter(s => s.type === 'named');

		const parts: string[] = [];

		if (defaultSpecs.length > 0) {
			parts.push(defaultSpecs[0].local);
		}

		if (namespaceSpecs.length > 0) {
			parts.push(`* as ${namespaceSpecs[0].local}`);
		}

		if (namedSpecs.length > 0) {
			const namedItems = namedSpecs.map(spec => {
				const typePrefix = spec.importKind === 'type' ? 'type ' : '';
				const name =
					spec.imported === spec.local ? spec.local : `${spec.imported} as ${spec.local}`;
				return `${typePrefix}${name}`;
			});

			const shouldUseMultiline = namedItems.length > this.options.multilineThreshold;

			if (shouldUseMultiline) {
				parts.push(`{\n${this.indentation}${namedItems.join(',\n' + this.indentation)}\n}`);
			} else {
				parts.push(`{ ${namedItems.join(', ')} }`);
			}
		}

		const importList = parts.join(', ');
		return `import ${typePrefix}${importList} from '${importStmt.source}';`;
	}
}
