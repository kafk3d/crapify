import { exec } from 'child_process';
import { promisify } from 'util';
import { SecurityVulnerability, PackageManagerInfo } from './types';

const execAsync = promisify(exec);

export class SecurityScanner {
	private cwd: string;
	private timeout: number;

	constructor(cwd: string = process.cwd(), timeout: number = 60000) {
		this.cwd = cwd;
		this.timeout = timeout;
	}

	async scanVulnerabilities(packageManager: PackageManagerInfo): Promise<{
		vulnerabilities: SecurityVulnerability[];
		summary: { critical: number; high: number; moderate: number; low: number };
		auditOutput?: any;
	}> {
		try {
			let command: string;
			let parser: (output: string) => { vulnerabilities: SecurityVulnerability[]; summary: any };

			switch (packageManager.type) {
				case 'npm':
					command = 'npm audit --json';
					parser = this.parseNpmAudit.bind(this);
					break;
				case 'yarn':
					command = 'yarn audit --json';
					parser = this.parseYarnAudit.bind(this);
					break;
				case 'pnpm':
					command = 'pnpm audit --json';
					parser = this.parsePnpmAudit.bind(this);
					break;
				default:
					throw new Error(`Unsupported package manager: ${packageManager.type}`);
			}

			const { stdout, stderr } = await execAsync(command, {
				cwd: this.cwd,
				timeout: this.timeout,
				env: { ...process.env, NO_UPDATE_NOTIFIER: 'true' }
			});

			if (stdout.trim()) {
				const result = parser(stdout);
				return {
					vulnerabilities: result.vulnerabilities,
					summary: result.summary,
					auditOutput: stdout
				};
			}

			return {
				vulnerabilities: [],
				summary: { critical: 0, high: 0, moderate: 0, low: 0 }
			};

		} catch (error: any) {
			if (error.code === 1) {
				try {
					const result = this.parseAuditError(error.stdout || error.stderr, packageManager.type);
					return result;
				} catch (parseError) {
					console.warn(`Warning: Audit found vulnerabilities but output couldn't be parsed: ${(parseError as Error).message}`);
				}
			}
			
			console.warn(`Warning: Security audit failed: ${error.message}`);
			return {
				vulnerabilities: [],
				summary: { critical: 0, high: 0, moderate: 0, low: 0 }
			};
		}
	}

	private parseNpmAudit(output: string): {
		vulnerabilities: SecurityVulnerability[];
		summary: { critical: number; high: number; moderate: number; low: number };
	} {
		const vulnerabilities: SecurityVulnerability[] = [];
		let summary = { critical: 0, high: 0, moderate: 0, low: 0 };

		try {
			const auditData = JSON.parse(output);

			// Handle new npm audit format (npm v7+)
			if (auditData.auditReportVersion === 2 && auditData.vulnerabilities) {
				for (const [packageName, vulnData] of Object.entries(auditData.vulnerabilities as any)) {
					const vuln = vulnData as any;
					
					if (vuln.via && Array.isArray(vuln.via)) {
						for (const advisory of vuln.via) {
							if (typeof advisory === 'object' && advisory.source) {
								const vulnerability: SecurityVulnerability = {
									id: advisory.source?.toString() || packageName,
									title: `${packageName}: ${advisory.title || 'Security vulnerability'}`,
									description: advisory.overview || advisory.description || '',
									severity: this.normalizeSeverity(advisory.severity),
									references: advisory.references || [],
									vulnerable_versions: advisory.range || vuln.range || '',
									patched_versions: advisory.patched_versions,
									recommendation: `Update ${packageName} to version ${vuln.fixAvailable ? vuln.fixAvailable.version || 'latest' : 'latest'}`
								};
								
								vulnerabilities.push(vulnerability);
								
								// Count severity
								switch (vulnerability.severity) {
									case 'critical': summary.critical++; break;
									case 'high': summary.high++; break;
									case 'moderate': summary.moderate++; break;
									case 'low': summary.low++; break;
								}
							}
						}
					}
				}
			}
			// Handle old npm audit format (npm v6)
			else if (auditData.advisories) {
				if (auditData.metadata?.vulnerabilities) {
					summary = {
						critical: auditData.metadata.vulnerabilities.critical || 0,
						high: auditData.metadata.vulnerabilities.high || 0,
						moderate: auditData.metadata.vulnerabilities.moderate || 0,
						low: auditData.metadata.vulnerabilities.low || 0
					};
				}

				for (const [id, advisory] of Object.entries(auditData.advisories as any)) {
					const adv = advisory as any;
					const packageName = adv.module_name || adv.package_name || 'unknown';
					
					const vulnerability: SecurityVulnerability = {
						id: id,
						title: `${packageName}: ${adv.title || 'Security vulnerability'}`,
						description: adv.overview || adv.description || '',
						severity: this.normalizeSeverity(adv.severity),
						references: adv.references || [],
						vulnerable_versions: adv.vulnerable_versions || adv.range || '',
						patched_versions: adv.patched_versions,
						recommendation: adv.recommendation || `Update ${packageName}`
					};

					vulnerabilities.push(vulnerability);
				}
			}

		} catch (error) {
			console.warn(`Warning: Failed to parse npm audit output: ${(error as Error).message}`);
		}

		return { vulnerabilities, summary };
	}

	private parseYarnAudit(output: string): {
		vulnerabilities: SecurityVulnerability[];
		summary: { critical: number; high: number; moderate: number; low: number };
	} {
		const vulnerabilities: SecurityVulnerability[] = [];
		let summary = { critical: 0, high: 0, moderate: 0, low: 0 };

		try {
			const lines = output.split('\n').filter(line => line.trim());
			
			for (const line of lines) {
				const data = JSON.parse(line);
				
				if (data.type === 'auditSummary' && data.data) {
					summary = {
						critical: data.data.vulnerabilities?.critical || 0,
						high: data.data.vulnerabilities?.high || 0,
						moderate: data.data.vulnerabilities?.moderate || 0,
						low: data.data.vulnerabilities?.low || 0
					};
				}
				
				if (data.type === 'auditAdvisory' && data.data) {
					const advisory = data.data.advisory as any;
					const vulnerability: SecurityVulnerability = {
						id: advisory.id?.toString() || '',
						title: advisory.title || 'Unknown vulnerability',
						description: advisory.overview || advisory.description || '',
						severity: this.normalizeSeverity(advisory.severity),
						references: advisory.references || [],
						vulnerable_versions: advisory.vulnerable_versions || advisory.range || '',
						patched_versions: advisory.patched_versions,
						recommendation: advisory.recommendation || this.generateRecommendation(advisory)
					};

					vulnerabilities.push(vulnerability);
				}
			}

		} catch (error) {
			console.warn(`Warning: Failed to parse yarn audit output: ${(error as Error).message}`);
		}

		return { vulnerabilities, summary };
	}

	private parsePnpmAudit(output: string): {
		vulnerabilities: SecurityVulnerability[];
		summary: { critical: number; high: number; moderate: number; low: number };
	} {
		const vulnerabilities: SecurityVulnerability[] = [];
		let summary = { critical: 0, high: 0, moderate: 0, low: 0 };

		try {
			const auditData = JSON.parse(output);

			if (auditData.metadata?.vulnerabilities) {
				summary = {
					critical: auditData.metadata.vulnerabilities.critical || 0,
					high: auditData.metadata.vulnerabilities.high || 0,
					moderate: auditData.metadata.vulnerabilities.moderate || 0,
					low: auditData.metadata.vulnerabilities.low || 0
				};
			}

			if (auditData.advisories) {
				for (const [id, advisory] of Object.entries(auditData.advisories as any)) {
					const advisoryData = advisory as any;
					const vulnerability: SecurityVulnerability = {
						id: id,
						title: advisoryData.title || 'Unknown vulnerability',
						description: advisoryData.overview || advisoryData.description || '',
						severity: this.normalizeSeverity(advisoryData.severity),
						references: advisoryData.references || [],
						vulnerable_versions: advisoryData.vulnerable_versions || advisoryData.range || '',
						patched_versions: advisoryData.patched_versions,
						recommendation: advisoryData.recommendation || this.generateRecommendation(advisoryData)
					};

					vulnerabilities.push(vulnerability);
				}
			}

		} catch (error) {
			console.warn(`Warning: Failed to parse pnpm audit output: ${(error as Error).message}`);
		}

		return { vulnerabilities, summary };
	}

	private parseAuditError(output: string, pmType: string): {
		vulnerabilities: SecurityVulnerability[];
		summary: { critical: number; high: number; moderate: number; low: number };
	} {
		try {
			switch (pmType) {
				case 'npm':
					return this.parseNpmAudit(output);
				case 'yarn':
					return this.parseYarnAudit(output);
				case 'pnpm':
					return this.parsePnpmAudit(output);
				default:
					throw new Error(`Unsupported package manager: ${pmType}`);
			}
		} catch (error) {
			return {
				vulnerabilities: [],
				summary: { critical: 0, high: 0, moderate: 0, low: 0 }
			};
		}
	}

	private normalizeSeverity(severity: string): 'low' | 'moderate' | 'high' | 'critical' {
		const normalized = severity?.toLowerCase();
		
		switch (normalized) {
			case 'critical':
				return 'critical';
			case 'high':
				return 'high';
			case 'moderate':
			case 'medium':
				return 'moderate';
			case 'low':
			case 'info':
			default:
				return 'low';
		}
	}

	private generateRecommendation(vuln: any): string {
		if (vuln.patched_versions) {
			return `Update to version ${vuln.patched_versions}`;
		}
		
		if (vuln.vulnerable_versions && vuln.vulnerable_versions.includes('<')) {
			const match = vuln.vulnerable_versions.match(/< ?([0-9.]+)/);
			if (match) {
				return `Update to version ${match[1]} or higher`;
			}
		}
		
		return 'Review package for security updates';
	}

	async checkPackageVulnerabilities(packageName: string, version: string): Promise<SecurityVulnerability[]> {
		try {
			const { stdout } = await execAsync(
				`npm view "${packageName}@${version}" --json`,
				{ 
					cwd: this.cwd, 
					timeout: 15000,
					env: { ...process.env, NO_UPDATE_NOTIFIER: 'true' }
				}
			);

			const packageInfo = JSON.parse(stdout);
			
			if (packageInfo.deprecated) {
				return [{
					id: `deprecated-${packageName}`,
					title: `Package ${packageName} is deprecated`,
					description: packageInfo.deprecated,
					severity: 'moderate' as const,
					references: [],
					vulnerable_versions: version,
					recommendation: 'Find an alternative package'
				}];
			}

		} catch (error) {
			console.warn(`Warning: Failed to check package ${packageName}: ${(error as Error).message}`);
		}

		return [];
	}

	async batchCheckVulnerabilities(packages: Array<{ name: string; version: string }>): Promise<Map<string, SecurityVulnerability[]>> {
		const results = new Map<string, SecurityVulnerability[]>();
		const batchSize = 10;

		for (let i = 0; i < packages.length; i += batchSize) {
			const batch = packages.slice(i, i + batchSize);
			
			const promises = batch.map(pkg => 
				this.checkPackageVulnerabilities(pkg.name, pkg.version)
					.then(vulns => ({ package: pkg.name, vulnerabilities: vulns }))
					.catch(() => ({ package: pkg.name, vulnerabilities: [] }))
			);

			const batchResults = await Promise.all(promises);
			
			for (const result of batchResults) {
				if (result.vulnerabilities.length > 0) {
					results.set(result.package, result.vulnerabilities);
				}
			}

			if (i + batchSize < packages.length) {
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
		}

		return results;
	}

	getSeverityColor(severity: string): string {
		switch (severity) {
			case 'critical':
				return '🔴';
			case 'high':
				return '🟠';
			case 'moderate':
				return '🟡';
			case 'low':
			default:
				return '🔵';
		}
	}

	formatVulnerabilitySummary(summary: { critical: number; high: number; moderate: number; low: number }): string {
		const parts = [];
		
		if (summary.critical > 0) parts.push(`${summary.critical} critical`);
		if (summary.high > 0) parts.push(`${summary.high} high`);
		if (summary.moderate > 0) parts.push(`${summary.moderate} moderate`);
		if (summary.low > 0) parts.push(`${summary.low} low`);
		
		return parts.length > 0 ? parts.join(', ') : 'No vulnerabilities found';
	}
}