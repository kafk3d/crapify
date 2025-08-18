import { CommentCategory } from './types';
import { 
    BasePreservationRule,
    FrameworkPreservationRule,
    DevelopmentPreservationRule,
    ToolingPreservationRule,
    DocumentationPreservationRule,
    CustomPreservationRule
} from './preservation-rules';

export interface CommentClassification {
    category: CommentCategory;
    rule: BasePreservationRule | null;
    shouldPreserve: boolean;
    metadata: Record<string, any>;
}

export class PreservationRuleManager {
    private rules: BasePreservationRule[] = [];

    constructor() {
        this.initializeDefaultRules();
    }

    addRule(rule: BasePreservationRule): void {
        this.rules.push(rule);
        this.sortRulesByPriority();
    }

    removeRule(name: string): boolean {
        const initialLength = this.rules.length;
        this.rules = this.rules.filter(rule => rule.name !== name);
        return this.rules.length < initialLength;
    }

    getRules(): BasePreservationRule[] {
        return [...this.rules];
    }

    getRulesByCategory(category: CommentCategory): BasePreservationRule[] {
        return this.rules.filter(rule => rule.category === category);
    }

    classifyComment(comment: string): CommentClassification {
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

        return {
            category: CommentCategory.REGULAR,
            rule: null,
            shouldPreserve: false,
            metadata: {}
        };
    }

    shouldPreserveComment(comment: string): boolean {
        return this.classifyComment(comment).shouldPreserve;
    }

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

    clearRules(): void {
        this.rules = [];
    }

    resetToDefaults(): void {
        this.clearRules();
        this.initializeDefaultRules();
    }

    private sortRulesByPriority(): void {
        this.rules.sort((a, b) => b.priority - a.priority);
    }

    private initializeDefaultRules(): void {
        this.addFrameworkRules();
        this.addDevelopmentRules();
        this.addToolingRules();
        this.addDocumentationRules();
    }

    private addFrameworkRules(): void {
        this.addRule(new FrameworkPreservationRule(
            'svelte-ignore',
            /svelte-ignore\s+[\w_-]+/i,
            900,
            'Svelte ignore directives',
            'Svelte'
        ));

        this.addRule(new FrameworkPreservationRule(
            'vue-eslint-disable',
            /<!--\s*eslint-disable/i,
            900,
            'Vue.js ESLint disable comments',
            'Vue'
        ));

        this.addRule(new FrameworkPreservationRule(
            'jsx-pragma',
            /@jsx\s+\w+/,
            900,
            'React/JSX pragma comments',
            'React'
        ));

        this.addRule(new FrameworkPreservationRule(
            'typescript-reference',
            /\/\/\/\s*<reference\s+(path|types|lib|no-default-lib)=/,
            900,
            'TypeScript reference directives',
            'TypeScript'
        ));

        this.addRule(new FrameworkPreservationRule(
            'webpack-magic',
            /webpack(ChunkName|Mode|Prefetch|Preload|Ignore|Include|Exclude|Exports):/i,
            900,
            'Webpack magic comments',
            'Webpack'
        ));
    }

    private addDevelopmentRules(): void {
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
        this.addRule(new ToolingPreservationRule(
            'eslint-directives',
            /eslint-(disable|enable)(-next-line)?/i,
            800,
            'ESLint directives',
            'ESLint'
        ));

        this.addRule(new ToolingPreservationRule(
            'prettier-ignore',
            /prettier-ignore/i,
            800,
            'Prettier ignore comments',
            'Prettier'
        ));

        this.addRule(new ToolingPreservationRule(
            'typescript-ignore',
            /@ts-(ignore|expect-error|nocheck)\b/i,
            800,
            'TypeScript ignore comments',
            'TypeScript'
        ));

        this.addRule(new ToolingPreservationRule(
            'coverage-ignore',
            /(istanbul|c8)\s+ignore/i,
            800,
            'Code coverage ignore comments',
            'Coverage'
        ));
    }

    private addDocumentationRules(): void {
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