import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
	PackageInfo,
	DependencyInfo,
	PackageManagerInfo,
	DependencyTreeNode,
	DependencyType
} from './types';

const execAsync = promisify(exec);

export class PackageAnalyzer {
	private cwd: string;
	private packageManager: PackageManagerInfo | null = null;

	constructor(cwd: string = process.cwd()) {
		this.cwd = cwd;
	}

	private async findProjectRoot(): Promise<string | null> {
		let currentDir = path.resolve(this.cwd);
		const root = path.parse(currentDir).root;
		
		const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'pnpm-lock.yml'];

		while (currentDir !== root) {
			try {
				// Check if package.json exists
				await fs.access(path.join(currentDir, 'package.json'));
				
				// Check if at least one lock file exists
				for (const lockFile of lockFiles) {
					try {
						await fs.access(path.join(currentDir, lockFile));
						return currentDir; // Found both package.json and a lock file
					} catch {
						continue;
					}
				}
				
				// package.json exists but no lock files, continue searching up
			} catch {
				// No package.json, continue searching up
			}
			currentDir = path.dirname(currentDir);
		}

		// Check root directory too
		try {
			await fs.access(path.join(root, 'package.json'));
			for (const lockFile of lockFiles) {
				try {
					await fs.access(path.join(root, lockFile));
					return root;
				} catch {
					continue;
				}
			}
		} catch {
			// No package.json in root
		}
		
		return null;
	}

	async detectPackageManager(): Promise<PackageManagerInfo> {
		if (this.packageManager) return this.packageManager;

		const projectRoot = await this.findProjectRoot();
		if (!projectRoot) {
			throw new Error('No package.json found in current directory or any parent directory');
		}

		// Update cwd to the actual project root
		this.cwd = projectRoot;

		const lockFiles = [
			{ file: 'package-lock.json', type: 'npm' as const, auditCmd: 'npm audit' },
			{ file: 'yarn.lock', type: 'yarn' as const, auditCmd: 'yarn audit' },
			{ file: 'pnpm-lock.yaml', type: 'pnpm' as const, auditCmd: 'pnpm audit' },
			{ file: 'pnpm-lock.yml', type: 'pnpm' as const, auditCmd: 'pnpm audit' }
		];

		for (const { file, type, auditCmd } of lockFiles) {
			try {
				await fs.access(path.join(this.cwd, file));
				const version = await this.getPackageManagerVersion(type);
				
				this.packageManager = {
					type,
					version,
					lockFile: file,
					auditCommand: auditCmd
				};

				if (type === 'npm' || type === 'yarn') {
					this.packageManager.workspaces = await this.detectWorkspaces();
				}

				return this.packageManager;
			} catch {
				continue;
			}
		}

		throw new Error('No supported package manager detected (npm, yarn, pnpm)');
	}

	private async getPackageManagerVersion(pm: 'npm' | 'yarn' | 'pnpm'): Promise<string> {
		try {
			const { stdout } = await execAsync(`${pm} --version`, { 
				cwd: this.cwd,
				maxBuffer: 1024 * 1024 // 1MB buffer (small command)
			});
			return stdout.trim();
		} catch {
			return 'unknown';
		}
	}

	private async detectWorkspaces(): Promise<string[] | undefined> {
		try {
			const pkgJson = await this.readPackageJson();
			if (pkgJson.workspaces) {
				return Array.isArray(pkgJson.workspaces) 
					? pkgJson.workspaces 
					: pkgJson.workspaces.packages || [];
			}
		} catch {
			
		}
		return undefined;
	}

	async readPackageJson(filePath?: string): Promise<PackageInfo & { [key: string]: any }> {
		const packagePath = filePath || path.join(this.cwd, 'package.json');
		
		try {
			const content = await fs.readFile(packagePath, 'utf-8');
			const packageJson = JSON.parse(content);
			
			return {
				name: packageJson.name || 'unnamed-project',
				version: packageJson.version || '0.0.0',
				description: packageJson.description,
				homepage: packageJson.homepage,
				repository: packageJson.repository,
				keywords: packageJson.keywords,
				license: packageJson.license,
				...packageJson
			};
		} catch (error) {
			throw new Error(`Failed to read package.json: ${(error as Error).message}`);
		}
	}

	async getInstalledDependencies(): Promise<Map<string, DependencyInfo>> {
		const pm = await this.detectPackageManager();
		const dependencies = new Map<string, DependencyInfo>();

		try {
			const pkgJson = await this.readPackageJson();
			const depTypes = [
				{ deps: pkgJson.dependencies || {}, type: DependencyType.PRODUCTION },
				{ deps: pkgJson.devDependencies || {}, type: DependencyType.DEVELOPMENT },
				{ deps: pkgJson.peerDependencies || {}, type: DependencyType.PEER },
				{ deps: pkgJson.optionalDependencies || {}, type: DependencyType.OPTIONAL }
			];

			for (const { deps, type } of depTypes) {
				for (const [name, version] of Object.entries(deps)) {
					const depInfo: DependencyInfo = {
						name,
						currentVersion: version as string,
						isOutdated: false,
						isDev: type === DependencyType.DEVELOPMENT,
						isOptional: type === DependencyType.OPTIONAL,
						isPeer: type === DependencyType.PEER
					};

					dependencies.set(name, depInfo);
				}
			}

			const outdatedInfo = await this.checkOutdatedDependencies();
			
			for (const [name, info] of outdatedInfo) {
				if (dependencies.has(name)) {
					const dep = dependencies.get(name)!;
					dep.latestVersion = info.latestVersion;
					dep.wantedVersion = info.wantedVersion;
					dep.isOutdated = info.isOutdated;
				}
			}

		} catch (error) {
			throw new Error(`Failed to analyze dependencies: ${(error as Error).message}`);
		}

		return dependencies;
	}

	async checkOutdatedDependencies(): Promise<Map<string, DependencyInfo>> {
		const pm = await this.detectPackageManager();
		const outdated = new Map<string, DependencyInfo>();

		try {
			let command: string;
			let parser: (output: string) => Map<string, DependencyInfo>;

			switch (pm.type) {
				case 'npm':
					command = 'npm outdated --json';
					parser = this.parseNpmOutdated.bind(this);
					break;
				case 'yarn':
					command = 'yarn outdated --json';
					parser = this.parseYarnOutdated.bind(this);
					break;
				case 'pnpm':
					command = 'pnpm outdated --format json';
					parser = this.parsePnpmOutdated.bind(this);
					break;
				default:
					throw new Error(`Unsupported package manager: ${pm.type}`);
			}

			const { stdout } = await execAsync(command, { 
				cwd: this.cwd,
				timeout: 30000,
				maxBuffer: 10 * 1024 * 1024 // 10MB buffer
			});

			if (stdout.trim()) {
				return parser(stdout);
			}

		} catch (error) {
			if ((error as any).code !== 1) {
				console.warn(`Warning: Failed to check outdated dependencies: ${(error as Error).message}`);
			}
		}

		return outdated;
	}

	private parseNpmOutdated(output: string): Map<string, DependencyInfo> {
		const outdated = new Map<string, DependencyInfo>();
		
		try {
			const data = JSON.parse(output);
			
			for (const [name, info] of Object.entries(data as any)) {
				const pkgInfo = info as any;
				outdated.set(name, {
					name,
					currentVersion: pkgInfo.current,
					latestVersion: pkgInfo.latest,
					wantedVersion: pkgInfo.wanted,
					isOutdated: true,
					isDev: false, 
					isOptional: false,
					isPeer: false
				});
			}
		} catch (error) {
			console.warn(`Warning: Failed to parse npm outdated output: ${(error as Error).message}`);
		}
		
		return outdated;
	}

	private parseYarnOutdated(output: string): Map<string, DependencyInfo> {
		const outdated = new Map<string, DependencyInfo>();
		
		try {
			const lines = output.split('\n').filter(line => line.trim());
			
			for (const line of lines) {
				const data = JSON.parse(line);
				if (data.type === 'table' && data.data?.body) {
					for (const row of data.data.body) {
						const [name, current, wanted, latest] = row;
						if (name && current !== latest) {
							outdated.set(name, {
								name,
								currentVersion: current,
								latestVersion: latest,
								wantedVersion: wanted,
								isOutdated: true,
								isDev: false,
								isOptional: false,
								isPeer: false
							});
						}
					}
				}
			}
		} catch (error) {
			console.warn(`Warning: Failed to parse yarn outdated output: ${(error as Error).message}`);
		}
		
		return outdated;
	}

	private parsePnpmOutdated(output: string): Map<string, DependencyInfo> {
		const outdated = new Map<string, DependencyInfo>();
		
		try {
			const data = JSON.parse(output);
			
			if (Array.isArray(data)) {
				for (const pkg of data) {
					if (pkg.current !== pkg.latest) {
						outdated.set(pkg.packageName, {
							name: pkg.packageName,
							currentVersion: pkg.current,
							latestVersion: pkg.latest,
							wantedVersion: pkg.wanted,
							isOutdated: true,
							isDev: pkg.dependencyType === 'devDependencies',
							isOptional: pkg.dependencyType === 'optionalDependencies',
							isPeer: pkg.dependencyType === 'peerDependencies'
						});
					}
				}
			}
		} catch (error) {
			console.warn(`Warning: Failed to parse pnpm outdated output: ${(error as Error).message}`);
		}
		
		return outdated;
	}

	async getDependencyTree(): Promise<DependencyTreeNode | null> {
		const pm = await this.detectPackageManager();
		
		try {
			let command: string;
			let parser: (output: string) => DependencyTreeNode;

			switch (pm.type) {
				case 'npm':
					command = 'npm ls --json --all';
					parser = this.parseNpmTree.bind(this);
					break;
				case 'yarn':
					command = 'yarn list --json';
					parser = this.parseYarnTree.bind(this);
					break;
				case 'pnpm':
					command = 'pnpm ls --json --recursive';
					parser = this.parsePnpmTree.bind(this);
					break;
				default:
					throw new Error(`Unsupported package manager: ${pm.type}`);
			}

			const { stdout } = await execAsync(command, {
				cwd: this.cwd,
				timeout: 60000,
				maxBuffer: 10 * 1024 * 1024 // 10MB buffer
			});

			return parser(stdout);

		} catch (error) {
			console.warn(`Warning: Failed to get dependency tree: ${(error as Error).message}`);
			return null;
		}
	}

	private parseNpmTree(output: string): DependencyTreeNode {
		const data = JSON.parse(output);
		return this.convertNpmNodeToTreeNode(data);
	}

	private convertNpmNodeToTreeNode(node: any): DependencyTreeNode {
		const treeNode: DependencyTreeNode = {
			name: node.name || 'root',
			version: node.version || '0.0.0',
			path: node.path || this.cwd,
			dev: node.dev || false,
			optional: node.optional || false,
			resolved: node.resolved
		};

		if (node.dependencies) {
			treeNode.dependencies = new Map();
			for (const [name, depNode] of Object.entries(node.dependencies)) {
				treeNode.dependencies.set(name, this.convertNpmNodeToTreeNode(depNode));
			}
		}

		return treeNode;
	}

	private parseYarnTree(output: string): DependencyTreeNode {
		const lines = output.split('\n').filter(line => line.trim());
		let rootNode: DependencyTreeNode | null = null;
		
		for (const line of lines) {
			try {
				const data = JSON.parse(line);
				if (data.type === 'tree' && data.data?.trees?.length > 0) {
					const tree = data.data.trees[0];
					rootNode = {
						name: tree.name?.split('@')[0] || 'root',
						version: tree.name?.split('@')[1] || '0.0.0',
						path: this.cwd,
						dev: false,
						optional: false,
						dependencies: new Map()
					};
					break;
				}
			} catch {
				continue;
			}
		}
		
		return rootNode || {
			name: 'root',
			version: '0.0.0',
			path: this.cwd,
			dev: false,
			optional: false
		};
	}

	private parsePnpmTree(output: string): DependencyTreeNode {
		const data = JSON.parse(output);
		
		if (Array.isArray(data) && data.length > 0) {
			const root = data[0];
			return {
				name: root.name || 'root',
				version: root.version || '0.0.0',
				path: root.path || this.cwd,
				dev: false,
				optional: false,
				dependencies: new Map()
			};
		}
		
		return {
			name: 'root',
			version: '0.0.0',
			path: this.cwd,
			dev: false,
			optional: false
		};
	}

	async findDuplicateDependencies(): Promise<Map<string, string[]>> {
		const tree = await this.getDependencyTree();
		const duplicates = new Map<string, string[]>();
		const versionMap = new Map<string, Set<string>>();

		if (!tree) return duplicates;

		this.collectVersions(tree, versionMap);

		for (const [name, versions] of versionMap) {
			if (versions.size > 1) {
				duplicates.set(name, Array.from(versions));
			}
		}

		return duplicates;
	}

	private collectVersions(node: DependencyTreeNode, versionMap: Map<string, Set<string>>): void {
		if (node.name !== 'root') {
			if (!versionMap.has(node.name)) {
				versionMap.set(node.name, new Set());
			}
			versionMap.get(node.name)!.add(node.version);
		}

		if (node.dependencies) {
			for (const [, childNode] of node.dependencies) {
				this.collectVersions(childNode, versionMap);
			}
		}
	}

	formatSize(bytes: number): string {
		const units = ['B', 'KB', 'MB', 'GB'];
		let size = bytes;
		let unitIndex = 0;

		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}

		return `${size.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
	}
}