import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import {
	ImportDeclaration,
	ExportDeclaration,
	ImportSpecifier as BabelImportSpecifier,
	ImportDefaultSpecifier,
	ImportNamespaceSpecifier,
	Identifier,
	Node
} from '@babel/types';
import { ImportStatement, ImportSpecifier, ImportAnalysisResult } from './types';

export class ASTAnalyzer {
	private usedIdentifiers = new Set<string>();
	private importStatements: ImportStatement[] = [];
	private scopeChain: string[][] = [];

	analyzeFile(content: string, filePath: string): ImportAnalysisResult {
		this.reset();

		try {
			const ast = this.parseCode(content, filePath);
			this.extractImports(ast, content);
			this.analyzeUsage(ast);

			return {
				imports: this.importStatements,
				unusedImports: this.findUnusedImports(),
				duplicateGroups: this.findDuplicateImports(),
				usedIdentifiers: this.usedIdentifiers,
				scopeChain: this.scopeChain
			};
		} catch (error) {
			throw new Error(`AST analysis failed for ${filePath}: ${(error as Error).message}`);
		}
	}

	private reset(): void {
		this.usedIdentifiers.clear();
		this.importStatements = [];
		this.scopeChain = [];
	}

	private parseCode(content: string, filePath: string) {
		const isTypeScript = /\.tsx?$/.test(filePath);
		const isJSX = /\.(jsx|tsx)$/.test(filePath);

		const plugins: any[] = ['objectRestSpread', 'functionBind', 'decorators-legacy'];

		if (isTypeScript) {
			plugins.push('typescript');
		}

		if (isJSX) {
			plugins.push('jsx');
		}

		return parse(content, {
			sourceType: 'module',
			allowImportExportEverywhere: true,
			allowReturnOutsideFunction: true,
			plugins,
			errorRecovery: true
		});
	}

	private extractImports(ast: Node, content: string): void {
		const lines = content.split('\n');

		traverse(ast, {
			ImportDeclaration: (path: NodePath<ImportDeclaration>) => {
				const node = path.node;
				const startLine = (node.loc?.start.line || 1) - 1;
				const endLine = (node.loc?.end.line || 1) - 1;

				const leadingComments = node.leadingComments?.map(c => c.value.trim()) || [];
				const trailingComments = node.trailingComments?.map(c => c.value.trim()) || [];

				const importKind = node.importKind;
				const importStatement: ImportStatement = {
					source: node.source.value,
					specifiers: this.extractSpecifiers(node.specifiers),
					importKind: importKind === 'type' || importKind === 'typeof' ? importKind : 'value',
					startPos: node.start || 0,
					endPos: node.end || 0,
					leadingComments,
					trailingComments
				};

				this.importStatements.push(importStatement);
			}
		});
	}

	private extractSpecifiers(
		specifiers: (BabelImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier)[]
	): ImportSpecifier[] {
		return specifiers.map(spec => {
			if (spec.type === 'ImportDefaultSpecifier') {
				return {
					type: 'default' as const,
					local: spec.local.name
				};
			} else if (spec.type === 'ImportNamespaceSpecifier') {
				return {
					type: 'namespace' as const,
					local: spec.local.name
				};
			} else if (spec.type === 'ImportSpecifier') {
				const importKind = spec.importKind;
				return {
					type: 'named' as const,
					imported: 'name' in spec.imported ? spec.imported.name : spec.imported.value,
					local: spec.local.name,
					importKind: importKind === 'typeof' || importKind === 'type' ? importKind : 'value'
				};
			}

			throw new Error(`Unknown import specifier type: ${(spec as any).type}`);
		});
	}

	private analyzeUsage(ast: Node): void {
		const scopeStack: string[][] = [[]];

		traverse(ast, {
			enter: path => {
				if (path.isFunction() || path.isBlockStatement() || path.isProgram()) {
					scopeStack.push([]);
				}
			},
			exit: path => {
				if (path.isFunction() || path.isBlockStatement() || path.isProgram()) {
					this.scopeChain.push(scopeStack.pop() || []);
				}
			},
			Identifier: (path: NodePath<Identifier>) => {
				if (path.isReferencedIdentifier()) {
					this.usedIdentifiers.add(path.node.name);
					const currentScope = scopeStack[scopeStack.length - 1];
					if (currentScope && !currentScope.includes(path.node.name)) {
						currentScope.push(path.node.name);
					}
				}
			},
			VariableDeclarator: path => {
				if (path.node.id.type === 'Identifier') {
					const currentScope = scopeStack[scopeStack.length - 1];
					if (currentScope) {
						currentScope.push(path.node.id.name);
					}
				}
			}
		});
	}

	private findUnusedImports(): ImportStatement[] {
		return this.importStatements.filter(importStmt => {
			return importStmt.specifiers.some(spec => {
				return !this.usedIdentifiers.has(spec.local);
			});
		});
	}

	private findDuplicateImports(): ImportStatement[][] {
		const sourceGroups = new Map<string, ImportStatement[]>();

		for (const importStmt of this.importStatements) {
			const source = importStmt.source;
			if (!sourceGroups.has(source)) {
				sourceGroups.set(source, []);
			}
			sourceGroups.get(source)!.push(importStmt);
		}

		return Array.from(sourceGroups.values()).filter(group => group.length > 1);
	}

	canMergeImports(imports: ImportStatement[]): boolean {
		if (imports.length <= 1) return false;

		const firstImport = imports[0];
		return imports.every(
			imp => imp.importKind === firstImport.importKind && imp.source === firstImport.source
		);
	}

	mergeImports(imports: ImportStatement[]): ImportStatement {
		if (!this.canMergeImports(imports)) {
			throw new Error('Cannot merge incompatible imports');
		}

		const mergedSpecifiers: ImportSpecifier[] = [];
		const seenLocals = new Set<string>();

		for (const importStmt of imports) {
			for (const spec of importStmt.specifiers) {
				if (!seenLocals.has(spec.local)) {
					mergedSpecifiers.push(spec);
					seenLocals.add(spec.local);
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
}
