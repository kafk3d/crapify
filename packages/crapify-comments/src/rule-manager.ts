import { CommentCategory } from './types';
import { 
    BasePreservationRule,
    FrameworkPreservationRule,
    DevelopmentPreservationRule,
    ToolingPreservationRule,
    DocumentationPreservationRule,
    CustomPreservationRule
} from './preservation-rules';

/**
 * Result of comment classification
 */
export interface CommentClassification {
    category: CommentCategory;
    rule: BasePreservationRule | null;
    shouldPreserve: boolean;
    metadata: Record<string, any>;
}

/**
 * Manages preservation rules and handles comment classification with priority system
 */
export class PreservationRuleManager {
    private rules: BasePreservationRule[] = [];

    constructor() {
        this.initializeDefaultRules();
    }

    /**
     * Add a preservation rule to the manager
     */
    addRule(rule: BasePreservationRule): void {
        this.rules.push(rule);
        this.sortRulesByPriority();
    }

    /**
     * Remove a rule by name
     */
    removeRule(name: string): boolean {
        const initialLength = this.rules.length;
        this.rules = this.rules.filter(rule => rule.name !== name);
        return this.rules.length < initialLength;
    }

    /**
     * Get all rules, sorted by priority (highest first)
     */
    getRules(): BasePreservationRule[] {
        return [...this.rules];
    }

    /**
     * Get rules by category
     */
    getRulesByCategory(category: CommentCategory): BasePreservationRule[] {
        return this.rules.filter(rule => rule.category === category);
    }

    /**
     * Classify a comment and determine if it should be preserved
     */
    classifyComment(comment: string): CommentClassification {
        // Find the first matching rule (highest priority)
        for (const rule of this.rules) {
            if (rule.matches(comment)) {
                return {
                    category: rule.category,
                    rule,
                    shouldPreserve: true,
                    metadata: rule.extractMetadata(comment)
                };
            }
        }

        // No matching rule found - regular comment
        return {
            category: CommentCategory.REGULAR,
            rule: null,
            shouldPreserve: false,
            metadata: {}
        };
    }

    /**
     * Check if a comment should be preserved based on rules
     */
    shouldPreserveComment(comment: string): boolean {
        return this.classifyComment(comment).shouldPreserve;
    }

    /**
     * Add custom pattern as a preservation rule
     */
    addCustomPattern(name: string, pattern: string, priority: number = 100): void {
        try {
            const regex = new RegExp(pattern, 'i');
            const rule = new CustomPreservationRule(
                name,
                regex,
                priority,
                `Custom pattern: ${pattern}`,
                pattern
            );
            this.addRule(rule);
        } catch (error) {
            throw new Error(`Invalid regex pattern: ${pattern}`);
        }
    }

    /**
     * Clear all rules
     */
    clearRules(): void {
        this.rules = [];
    }

    /**
     * Reset to default rules only
     */
    resetToDefaults(): void {
        this.clearRules();
        this.initializeDefaultRules();
    }

    /**
     * Sort rules by priority (highest first) to ensure proper precedence
     */
    private sortRulesByPriority(): void {
        this.rules.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Initialize default preservation rules based on requirements
     */
    private initializeDefaultRules(): void {
        // Framework-specific rules (Requirements 2.1-2.5) - High priority
        this.addFrameworkRules();
        
        // Development keyword rules (Requirements 3.1-3.7) - Medium priority  
        this.addDevelopmentRules();
        
        // Tooling directive rules (Requirements 4.1-4.5) - High priority
        this.addToolingRules();
        
        // Documentation rules - Medium priority
        this.addDocumentationRules();
    }

    private addFrameworkRules(): void {
        // Svelte (Requirement 2.1)
        this.addRule(new FrameworkPreservationRule(
            'svelte-ignore',
            /svelte-ignore\s+[\w_-]+/i,
            900,
            'Svelte ignore directives',
            'Svelte'
        ));

        // Vue.js (Requirement 2.2)
        this.addRule(new FrameworkPreservationRule(
            'vue-eslint-disable',
            /<!--\s*eslint-disable/i,
            900,
            'Vue.js ESLint disable comments',
            'Vue'
        ));

        // React/JSX pragma (Requirement 2.3)
        this.addRule(new FrameworkPreservationRule(
            'jsx-pragma',
            /@jsx\s+\w+/,
            900,
            'React/JSX pragma comments',
            'React'
        ));

        // TypeScript compiler directives (Requirement 2.4)
        this.addRule(new FrameworkPreservationRule(
            'typescript-reference',
            /\/\/\/\s*<reference\s+(path|types|lib|no-default-lib)=/,
            900,
            'TypeScript reference directives',
            'TypeScript'
        ));

        // Webpack magic comments (Requirement 2.5)
        this.addRule(new FrameworkPreservationRule(
            'webpack-magic',
            /webpack(ChunkName|Mode|Prefetch|Preload|Ignore|Include|Exclude|Exports):/i,
            900,
            'Webpack magic comments',
            'Webpack'
        ));
    }

    private addDevelopmentRules(): void {
        // Development keywords (Requirements 3.1-3.7)
        const keywords = ['TODO', 'FIXME', 'HACK', 'NOTE', 'XXX', 'BUG', 'WARN', 'WARNING'];
        
        this.addRule(new DevelopmentPreservationRule(
            'development-keywords',
            new RegExp(`\\b(${keywords.join('|')})\\b`, 'i'),
            700,
            'Development keywords (TODO, FIXME, etc.)',
            keywords
        ));
    }

    private addToolingRules(): void {
        // ESLint directives (Requirement 4.1)
        this.addRule(new ToolingPreservationRule(
            'eslint-directives',
            /eslint-(disable|enable)(-next-line)?/i,
            800,
            'ESLint directives',
            'ESLint'
        ));

        // Prettier ignore (Requirement 4.2)
        this.addRule(new ToolingPreservationRule(
            'prettier-ignore',
            /prettier-ignore/i,
            800,
            'Prettier ignore comments',
            'Prettier'
        ));

        // TypeScript ignore comments (Requirement 4.4)
        this.addRule(new ToolingPreservationRule(
            'typescript-ignore',
            /@ts-(ignore|expect-error|nocheck)\b/i,
            800,
            'TypeScript ignore comments',
            'TypeScript'
        ));

        // Coverage ignore comments (Requirement 4.5)
        this.addRule(new ToolingPreservationRule(
            'coverage-ignore',
            /(istanbul|c8)\s+ignore/i,
            800,
            'Code coverage ignore comments',
            'Coverage'
        ));
    }

    private addDocumentationRules(): void {
        // JSDoc comments (Requirement 4.3) - Higher priority than development keywords
        // More specific pattern for common JSDoc tags to avoid false positives
        const jsdocTags = [
            'param', 'returns?', 'return', 'throws?', 'throw', 'example', 'since', 'author', 'see', 'todo',
            'override', 'readonly', 'static', 'private', 'public', 'protected', 'abstract', 'final',
            'namespace', 'module', 'class', 'interface', 'typedef', 'callback', 'enum', 'memberof',
            'inner', 'instance', 'global', 'ignore', 'fileoverview', 'deprecated', 'description',
            'summary', 'version', 'license', 'copyright', 'constructor', 'extends', 'implements',
            'mixes', 'augments', 'borrows', 'lends', 'requires', 'external', 'event', 'fires',
            'listens', 'mixin', 'variation', 'kind', 'constant', 'default', 'defaultvalue',
            'type', 'this', 'async', 'generator', 'hideconstructor', 'inheritdoc', 'inner',
            'jsx', 'react'
        ];
        
        this.addRule(new DocumentationPreservationRule(
            'jsdoc',
            new RegExp(`@(${jsdocTags.join('|')})\\b`, 'i'),
            750,
            'JSDoc comments with @ annotations'
        ));
    }
}