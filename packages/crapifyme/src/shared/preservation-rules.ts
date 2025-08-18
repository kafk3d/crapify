import { PreservationRule, CommentCategory } from './types';

export abstract class BasePreservationRule implements PreservationRule {
	public readonly name: string;
	public readonly pattern: RegExp;
	public readonly priority: number;
	public readonly description: string;
	public readonly category: CommentCategory;

	constructor(
		name: string,
		pattern: RegExp,
		priority: number,
		description: string,
		category: CommentCategory
	) {
		this.name = name;
		this.pattern = pattern;
		this.priority = priority;
		this.description = description;
		this.category = category;
	}

	matches(comment: string): boolean {
		return this.pattern.test(comment);
	}

	extractMetadata(comment: string): Record<string, any> {
		return {};
	}
}

export class FrameworkPreservationRule extends BasePreservationRule {
	public readonly framework: string;

	constructor(
		name: string,
		pattern: RegExp,
		priority: number,
		description: string,
		framework: string
	) {
		super(name, pattern, priority, description, CommentCategory.FRAMEWORK);
		this.framework = framework;
	}

	extractMetadata(comment: string): Record<string, any> {
		return {
			framework: this.framework,
			category: this.category
		};
	}
}

export class DevelopmentPreservationRule extends BasePreservationRule {
	public readonly keywords: string[];

	constructor(
		name: string,
		pattern: RegExp,
		priority: number,
		description: string,
		keywords: string[]
	) {
		super(name, pattern, priority, description, CommentCategory.DEVELOPMENT);
		this.keywords = keywords;
	}

	extractMetadata(comment: string): Record<string, any> {
		const matchedKeyword = this.keywords.find(keyword =>
			new RegExp(`\\b${keyword}\\b`, 'i').test(comment)
		);

		return {
			keyword: matchedKeyword,
			category: this.category
		};
	}
}

export class ToolingPreservationRule extends BasePreservationRule {
	public readonly tool: string;

	constructor(name: string, pattern: RegExp, priority: number, description: string, tool: string) {
		super(name, pattern, priority, description, CommentCategory.TOOLING);
		this.tool = tool;
	}

	extractMetadata(comment: string): Record<string, any> {
		return {
			tool: this.tool,
			category: this.category
		};
	}
}

export class DocumentationPreservationRule extends BasePreservationRule {
	constructor(name: string, pattern: RegExp, priority: number, description: string) {
		super(name, pattern, priority, description, CommentCategory.DOCUMENTATION);
	}

	extractMetadata(comment: string): Record<string, any> {
		const jsdocTags = comment.match(/@\w+/g) || [];

		return {
			jsdocTags,
			category: this.category
		};
	}
}

export class CustomPreservationRule extends BasePreservationRule {
	public readonly userPattern: string;

	constructor(
		name: string,
		pattern: RegExp,
		priority: number,
		description: string,
		userPattern: string
	) {
		super(name, pattern, priority, description, CommentCategory.CUSTOM);
		this.userPattern = userPattern;
	}

	extractMetadata(comment: string): Record<string, any> {
		return {
			userPattern: this.userPattern,
			category: this.category
		};
	}
}
