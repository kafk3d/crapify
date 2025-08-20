import { FileStats } from '../../shared/types';

export interface CharacterIssue {
	character: string;
	codePoint: number;
	line: number;
	column: number;
	context: string;
	script: ScriptType;
	severity: IssueSeverity;
	replacement?: string;
}

export interface CharStats extends FileStats {
	charactersFound: number;
	charactersFixed: number;
	scriptTypes: Record<ScriptType, number>;
}

export interface CharacterDetectionResult {
	content: string;
	modified: boolean;
	issues: CharacterIssue[];
	fixed: number;
	errors?: string[];
}

export enum ScriptType {
	LATIN_EXTENDED = 'latin-extended',
	CYRILLIC = 'cyrillic',
	CJK = 'cjk',
	ARABIC = 'arabic',
	GREEK = 'greek',
	INVISIBLE = 'invisible',
	CONFUSABLE = 'confusable',
	OTHER = 'other'
}

export enum IssueSeverity {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	CRITICAL = 'critical'
}

export interface CharacterRange {
	start: number;
	end: number;
	script: ScriptType;
	severity: IssueSeverity;
}

export interface CharacterDetectorOptions {
	strict?: boolean;
	interactive?: boolean;
	showContext?: number;
	ignoreStrings?: boolean;
	ignoreComments?: boolean;
}
