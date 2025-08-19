import anyAscii from 'any-ascii';
import { Logger } from '../../shared';
import {
	CharacterIssue,
	CharacterDetectionResult,
	ScriptType,
	IssueSeverity,
	CharacterRange,
	CharacterDetectorOptions
} from './types';

export class CharacterDetector {
	private logger: Logger;
	private options: CharacterDetectorOptions;

	private static readonly CHARACTER_RANGES: CharacterRange[] = [
		{ start: 0x0080, end: 0x00FF, script: ScriptType.LATIN_EXTENDED, severity: IssueSeverity.MEDIUM },
		{ start: 0x0100, end: 0x024F, script: ScriptType.LATIN_EXTENDED, severity: IssueSeverity.LOW },
		{ start: 0x1E00, end: 0x1EFF, script: ScriptType.LATIN_EXTENDED, severity: IssueSeverity.LOW },
		{ start: 0x0370, end: 0x03FF, script: ScriptType.GREEK, severity: IssueSeverity.MEDIUM },
		{ start: 0x0400, end: 0x04FF, script: ScriptType.CYRILLIC, severity: IssueSeverity.HIGH },
		{ start: 0x4E00, end: 0x9FFF, script: ScriptType.CJK, severity: IssueSeverity.HIGH },
		{ start: 0x3400, end: 0x4DBF, script: ScriptType.CJK, severity: IssueSeverity.HIGH },
		{ start: 0x0600, end: 0x06FF, script: ScriptType.ARABIC, severity: IssueSeverity.HIGH },
		{ start: 0x200B, end: 0x200D, script: ScriptType.INVISIBLE, severity: IssueSeverity.CRITICAL },
		{ start: 0xFEFF, end: 0xFEFF, script: ScriptType.INVISIBLE, severity: IssueSeverity.CRITICAL }
	];


	constructor(logger: Logger, options: CharacterDetectorOptions = {}) {
		this.logger = logger;
		this.options = {
			strict: false,
			interactive: false,
			showContext: 40,
			ignoreStrings: false,
			ignoreComments: false,
			...options
		};
	}

	detectCharacters(content: string, filePath: string): CharacterDetectionResult {
		const issues: CharacterIssue[] = [];
		const lines = content.split('\n');

		for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
			const line = lines[lineIndex];
			
			for (let charIndex = 0; charIndex < line.length; charIndex++) {
				const char = line[charIndex];
				const codePoint = char.codePointAt(0) || 0;
				
				if (this.shouldIgnoreCharacter(char, codePoint, line, charIndex)) {
					continue;
				}

				const scriptInfo = this.getScriptInfo(codePoint);
				if (scriptInfo || (this.options.strict && codePoint > 127)) {
					const context = this.getContext(line, charIndex, this.options.showContext || 40);
					const replacement = anyAscii(char);
					
					issues.push({
						character: char,
						codePoint,
						line: lineIndex + 1,
						column: charIndex + 1,
						context,
						script: scriptInfo?.script || ScriptType.OTHER,
						severity: scriptInfo?.severity || IssueSeverity.MEDIUM,
						replacement: replacement !== char ? replacement : undefined
					});
				}
			}
		}

		return {
			content,
			modified: false,
			issues,
			fixed: 0
		};
	}

	fixCharacters(content: string, filePath: string): CharacterDetectionResult {
		const result = this.detectCharacters(content, filePath);
		let modifiedContent = content;
		let fixed = 0;

		const sortedIssues = result.issues
			.filter(issue => issue.replacement !== undefined)
			.sort((a, b) => {
				if (a.line !== b.line) return b.line - a.line;
				return b.column - a.column;
			});

		for (const issue of sortedIssues) {
			const lines = modifiedContent.split('\n');
			if (lines[issue.line - 1]) {
				const line = lines[issue.line - 1];
				const before = line.substring(0, issue.column - 1);
				const after = line.substring(issue.column);
				lines[issue.line - 1] = before + (issue.replacement || '') + after;
				modifiedContent = lines.join('\n');
				fixed++;
			}
		}

		return {
			content: modifiedContent,
			modified: fixed > 0,
			issues: result.issues,
			fixed
		};
	}

	private shouldIgnoreCharacter(char: string, codePoint: number, line: string, charIndex: number): boolean {
		if (codePoint <= 127 && !this.options.strict) {
			return true;
		}

		if (this.options.ignoreStrings && this.isInString(line, charIndex)) {
			return true;
		}

		if (this.options.ignoreComments && this.isInComment(line, charIndex)) {
			return true;
		}

		return false;
	}

	private getScriptInfo(codePoint: number): { script: ScriptType; severity: IssueSeverity } | null {
		for (const range of CharacterDetector.CHARACTER_RANGES) {
			if (codePoint >= range.start && codePoint <= range.end) {
				return { script: range.script, severity: range.severity };
			}
		}
		return null;
	}

	private getContext(line: string, charIndex: number, contextLength: number): string {
		const start = Math.max(0, charIndex - Math.floor(contextLength / 2));
		const end = Math.min(line.length, charIndex + Math.floor(contextLength / 2));
		const context = line.substring(start, end);
		
		const prefix = start > 0 ? '...' : '';
		const suffix = end < line.length ? '...' : '';
		
		return prefix + context + suffix;
	}

	private isInString(line: string, charIndex: number): boolean {
		let inString = false;
		let quote = '';
		let escaped = false;

		for (let i = 0; i < charIndex; i++) {
			const char = line[i];
			
			if (escaped) {
				escaped = false;
				continue;
			}

			if (char === '\\') {
				escaped = true;
				continue;
			}

			if (!inString && (char === '"' || char === "'" || char === '`')) {
				inString = true;
				quote = char;
			} else if (inString && char === quote) {
				inString = false;
				quote = '';
			}
		}

		return inString;
	}

	private isInComment(line: string, charIndex: number): boolean {
		const beforeChar = line.substring(0, charIndex);
		const singleLineComment = beforeChar.indexOf('//');
		const blockCommentStart = beforeChar.indexOf('/*');
		
		return singleLineComment !== -1 || blockCommentStart !== -1;
	}

	getScriptTypeStats(issues: CharacterIssue[]): Record<ScriptType, number> {
		const stats: Record<ScriptType, number> = {} as Record<ScriptType, number>;
		
		for (const scriptType of Object.values(ScriptType)) {
			stats[scriptType] = 0;
		}

		for (const issue of issues) {
			stats[issue.script]++;
		}

		return stats;
	}
}