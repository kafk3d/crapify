export enum ExitCode {
	Success = 0,
	IssuesFound = 1,
	Error = 2
}

export interface CrapifyConfig {
	dryRun?: boolean;
	verbose?: boolean;
	quiet?: boolean;
	json?: boolean;
	exclude?: string[];
	include?: string[];
}

export interface ToolConfig extends CrapifyConfig {
	[key: string]: any;
}
