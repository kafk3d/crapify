import { SimpleTokenizer } from '../../shared/tokenizer';
import { ProcessResult } from '../../shared/types';

export interface CommentsOptions {
	keep?: string[];
	preserveFramework?: boolean;
	preserveDevelopment?: boolean;
	preserveTooling?: boolean;
	preserveDocumentation?: boolean;
}

export class CommentsProcessor {
	private keepPatterns: string[];
	private preserveFramework: boolean;
	private preserveDevelopment: boolean;
	private preserveTooling: boolean;
	private preserveDocumentation: boolean;

	constructor(options: CommentsOptions = {}) {
		this.keepPatterns = options.keep || ['todo', 'fixme', 'hack', 'ts-ignore', 'eslint-disable'];
		this.preserveFramework = options.preserveFramework !== false;
		this.preserveDevelopment = options.preserveDevelopment !== false;
		this.preserveTooling = options.preserveTooling !== false;
		this.preserveDocumentation = options.preserveDocumentation !== false;
	}

	processFile(content: string): ProcessResult {
		const tokenizer = new SimpleTokenizer();
		const tokens = tokenizer.tokenize(content);

		const result: string[] = [];
		let removed = 0;
		let preserved = 0;

		for (const token of tokens) {
			if (token.type === 'comment') {
				if (this.shouldPreserveComment(token.value)) {
					result.push(token.value);
					preserved++;
				} else {
					removed++;
				}
			} else {
				result.push(token.value);
			}
		}

		const processedContent = result.join('');

		return {
			content: processedContent,
			modified: content !== processedContent,
			removed,
			preserved
		};
	}

	private shouldPreserveComment(comment: string): boolean {
		const lowerComment = comment.toLowerCase();

		for (const pattern of this.keepPatterns) {
			if (lowerComment.includes(pattern.toLowerCase())) {
				return true;
			}
		}

		if (this.preserveFramework) {
			const frameworkPatterns = [
				'@vue',
				'@svelte',
				'@react',
				'@angular',
				'typescript',
				'webpack',
				'@ts-',
				'vite'
			];

			for (const pattern of frameworkPatterns) {
				if (lowerComment.includes(pattern)) {
					return true;
				}
			}
		}

		if (this.preserveDevelopment) {
			const devPatterns = ['todo', 'fixme', 'hack', 'note', 'xxx', 'bug', 'warn'];

			for (const pattern of devPatterns) {
				if (lowerComment.includes(pattern)) {
					return true;
				}
			}
		}

		if (this.preserveTooling) {
			const toolingPatterns = [
				'eslint',
				'prettier',
				'ts-ignore',
				'ts-nocheck',
				'coverage',
				'istanbul',
				'@ts-expect-error'
			];

			for (const pattern of toolingPatterns) {
				if (lowerComment.includes(pattern)) {
					return true;
				}
			}
		}

		if (this.preserveDocumentation) {
			if (
				comment.includes('/**') ||
				comment.includes('@param') ||
				comment.includes('@return') ||
				comment.includes('@throws') ||
				comment.includes('@author') ||
				comment.includes('@since') ||
				comment.includes('@example') ||
				comment.includes('@see')
			) {
				return true;
			}
		}

		return false;
	}
}
