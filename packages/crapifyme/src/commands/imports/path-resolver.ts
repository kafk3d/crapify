import fs from 'fs';
import path from 'path';
import { PathAlias } from './types';

export class PathResolver {
	private aliases: PathAlias[] = [];
	private projectRoot: string;
	private tsConfigPaths: Record<string, string[]> = {};
	
	constructor(projectRoot: string = process.cwd()) {
		this.projectRoot = projectRoot;
		this.loadTsConfigPaths();
	}

	addAlias(pattern: string, replacement: string): void {
		const alias: PathAlias = {
			pattern,
			replacement,
			regex: this.createAliasRegex(pattern)
		};
		this.aliases.push(alias);
	}

	addAliases(aliases: Array<{ pattern: string; replacement: string }>): void {
		for (const alias of aliases) {
			this.addAlias(alias.pattern, alias.replacement);
		}
	}

	parseAliasString(aliasString: string): void {
		const pairs = aliasString.split(',');
		for (const pair of pairs) {
			const [pattern, replacement] = pair.split(':').map(s => s.trim());
			if (pattern && replacement) {
				this.addAlias(pattern, replacement);
			}
		}
	}

	resolveImportPath(importPath: string, currentFile: string): string {
		if (this.isExternalModule(importPath)) {
			return importPath;
		}

		for (const alias of this.aliases) {
			if (alias.regex.test(importPath)) {
				return importPath.replace(alias.regex, alias.replacement);
			}
		}

		for (const [aliasPattern, paths] of Object.entries(this.tsConfigPaths)) {
			const match = this.matchTsConfigPath(importPath, aliasPattern);
			if (match && paths.length > 0) {
				const resolvedPath = this.resolveTsConfigPath(match, paths[0]);
				if (resolvedPath) {
					return resolvedPath;
				}
			}
		}

		return this.resolveRelativePath(importPath, currentFile);
	}

	convertToAbsolute(importPath: string, currentFile: string): string {
		if (this.isExternalModule(importPath)) {
			return importPath;
		}

		if (importPath.startsWith('./') || importPath.startsWith('../')) {
			const currentDir = path.dirname(currentFile);
			const absolutePath = path.resolve(currentDir, importPath);
			const relativePath = path.relative(this.projectRoot, absolutePath);
			return `@/${relativePath}`.replace(/\\/g, '/');
		}

		return importPath;
	}

	convertToRelative(importPath: string, currentFile: string): string {
		if (this.isExternalModule(importPath)) {
			return importPath;
		}

		if (importPath.startsWith('@/') || importPath.startsWith('~/')) {
			const targetPath = importPath.replace(/^[@~]\//, '');
			const currentDir = path.dirname(currentFile);
			const targetAbsolute = path.resolve(this.projectRoot, targetPath);
			const relativePath = path.relative(currentDir, targetAbsolute);
			
			if (relativePath.startsWith('.')) {
				return relativePath.replace(/\\/g, '/');
			} else {
				return `./${relativePath}`.replace(/\\/g, '/');
			}
		}

		return importPath;
	}

	normalizeImportPath(importPath: string): string {
		return importPath
			.replace(/\\/g, '/')
			.replace(/\/+/g, '/')
			.replace(/\/$/, '');
	}

	getFileExtensions(): string[] {
		return ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'];
	}

	resolveModulePath(importPath: string, currentFile: string): string | null {
		const basePath = this.resolveImportPath(importPath, currentFile);
		
		if (this.isExternalModule(basePath)) {
			return basePath;
		}

		const possiblePaths = this.generatePossiblePaths(basePath, currentFile);
		
		for (const possiblePath of possiblePaths) {
			if (fs.existsSync(possiblePath)) {
				return possiblePath;
			}
		}

		return null;
	}

	private createAliasRegex(pattern: string): RegExp {
		const escapedPattern = pattern
			.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
			.replace(/\\\*/g, '(.*)');
		return new RegExp(`^${escapedPattern}`);
	}

	private loadTsConfigPaths(): void {
		const tsConfigPath = path.join(this.projectRoot, 'tsconfig.json');
		
		if (fs.existsSync(tsConfigPath)) {
			try {
				const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf-8'));
				const compilerOptions = tsConfig.compilerOptions;
				
				if (compilerOptions?.paths) {
					this.tsConfigPaths = compilerOptions.paths;
				}

				if (compilerOptions?.baseUrl) {
					const baseUrl = path.resolve(this.projectRoot, compilerOptions.baseUrl);
					this.addAlias('*', baseUrl + '/*');
				}
			} catch (error) {
				console.warn(`Warning: Could not parse tsconfig.json: ${(error as Error).message}`);
			}
		}
	}

	private matchTsConfigPath(importPath: string, pattern: string): string | null {
		if (pattern === '*') {
			return importPath;
		}

		if (pattern.endsWith('/*')) {
			const prefix = pattern.slice(0, -2);
			if (importPath.startsWith(prefix)) {
				return importPath.slice(prefix.length);
			}
		}

		if (pattern === importPath) {
			return '';
		}

		return null;
	}

	private resolveTsConfigPath(match: string, pathPattern: string): string | null {
		if (pathPattern.endsWith('/*')) {
			const basePath = pathPattern.slice(0, -2);
			return path.join(basePath, match).replace(/\\/g, '/');
		}

		return pathPattern.replace(/\\/g, '/');
	}

	private isExternalModule(importPath: string): boolean {
		return !importPath.startsWith('.') && 
			   !importPath.startsWith('/') && 
			   !importPath.startsWith('@/') && 
			   !importPath.startsWith('~/');
	}

	private resolveRelativePath(importPath: string, currentFile: string): string {
		if (importPath.startsWith('./') || importPath.startsWith('../')) {
			const currentDir = path.dirname(currentFile);
			const resolved = path.resolve(currentDir, importPath);
			return path.relative(this.projectRoot, resolved).replace(/\\/g, '/');
		}
		
		return importPath;
	}

	private generatePossiblePaths(basePath: string, currentFile: string): string[] {
		const paths: string[] = [];
		const currentDir = path.dirname(currentFile);
		
		let resolvedBase: string;
		if (path.isAbsolute(basePath)) {
			resolvedBase = basePath;
		} else {
			resolvedBase = path.resolve(currentDir, basePath);
		}

		paths.push(resolvedBase);

		for (const ext of this.getFileExtensions()) {
			paths.push(resolvedBase + ext);
		}

		const indexPath = path.join(resolvedBase, 'index');
		for (const ext of this.getFileExtensions()) {
			paths.push(indexPath + ext);
		}

		return paths;
	}

	static parseCliAliases(aliasString: string): PathAlias[] {
		const aliases: PathAlias[] = [];
		const pairs = aliasString.split(',');
		
		for (const pair of pairs) {
			const [pattern, replacement] = pair.split(':').map(s => s.trim());
			if (pattern && replacement) {
				aliases.push({
					pattern,
					replacement,
					regex: new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '(.*)')}`)
				});
			}
		}
		
		return aliases;
	}
}