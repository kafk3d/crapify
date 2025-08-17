import { CommentCategory } from '../types';
import {
    BasePreservationRule,
    FrameworkPreservationRule,
    DevelopmentPreservationRule,
    ToolingPreservationRule,
    DocumentationPreservationRule,
    CustomPreservationRule
} from '../preservation-rules';

describe('BasePreservationRule', () => {
    class TestRule extends BasePreservationRule {
        constructor() {
            super(
                'test-rule',
                /test/i,
                100,
                'Test rule',
                CommentCategory.CUSTOM
            );
        }
    }

    it('should create a rule with correct properties', () => {
        const rule = new TestRule();
        
        expect(rule.name).toBe('test-rule');
        expect(rule.pattern).toEqual(/test/i);
        expect(rule.priority).toBe(100);
        expect(rule.description).toBe('Test rule');
        expect(rule.category).toBe(CommentCategory.CUSTOM);
    });

    it('should match comments correctly', () => {
        const rule = new TestRule();
        
        expect(rule.matches('// test comment')).toBe(true);
        expect(rule.matches('/* TEST COMMENT */')).toBe(true);
        expect(rule.matches('// other comment')).toBe(false);
    });

    it('should extract basic metadata', () => {
        const rule = new TestRule();
        const metadata = rule.extractMetadata('// test comment');
        
        expect(metadata).toEqual({});
    });
});

describe('FrameworkPreservationRule', () => {
    it('should create framework rule with correct properties', () => {
        const rule = new FrameworkPreservationRule(
            'svelte-ignore',
            /svelte-ignore/i,
            900,
            'Svelte ignore directives',
            'Svelte'
        );

        expect(rule.framework).toBe('Svelte');
        expect(rule.category).toBe(CommentCategory.FRAMEWORK);
    });

    it('should extract framework metadata', () => {
        const rule = new FrameworkPreservationRule(
            'svelte-ignore',
            /svelte-ignore/i,
            900,
            'Svelte ignore directives',
            'Svelte'
        );

        const metadata = rule.extractMetadata('<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->');
        
        expect(metadata).toEqual({
            framework: 'Svelte',
            category: CommentCategory.FRAMEWORK
        });
    });

    it('should match Svelte ignore comments', () => {
        const rule = new FrameworkPreservationRule(
            'svelte-ignore',
            /svelte-ignore\s+[\w_-]+/i,
            900,
            'Svelte ignore directives',
            'Svelte'
        );

        expect(rule.matches('<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->')).toBe(true);
        expect(rule.matches('<!-- svelte-ignore accessibility-click-events-have-key-events -->')).toBe(true);
        expect(rule.matches('<!-- regular comment -->')).toBe(false);
    });
});

describe('DevelopmentPreservationRule', () => {
    it('should create development rule with keywords', () => {
        const keywords = ['TODO', 'FIXME', 'HACK'];
        const rule = new DevelopmentPreservationRule(
            'dev-keywords',
            /\b(TODO|FIXME|HACK)\b/i,
            700,
            'Development keywords',
            keywords
        );

        expect(rule.keywords).toEqual(keywords);
        expect(rule.category).toBe(CommentCategory.DEVELOPMENT);
    });

    it('should match development keywords case-insensitively', () => {
        const rule = new DevelopmentPreservationRule(
            'dev-keywords',
            /\b(TODO|FIXME|HACK)\b/i,
            700,
            'Development keywords',
            ['TODO', 'FIXME', 'HACK']
        );

        expect(rule.matches('// TODO: implement this')).toBe(true);
        expect(rule.matches('/* FIXME: broken logic */')).toBe(true);
        expect(rule.matches('// hack: temporary solution')).toBe(true);
        expect(rule.matches('// regular comment')).toBe(false);
    });

    it('should extract matched keyword metadata', () => {
        const rule = new DevelopmentPreservationRule(
            'dev-keywords',
            /\b(TODO|FIXME|HACK)\b/i,
            700,
            'Development keywords',
            ['TODO', 'FIXME', 'HACK']
        );

        const metadata = rule.extractMetadata('// TODO: implement this feature');
        
        expect(metadata).toEqual({
            keyword: 'TODO',
            category: CommentCategory.DEVELOPMENT
        });
    });
});

describe('ToolingPreservationRule', () => {
    it('should create tooling rule with tool name', () => {
        const rule = new ToolingPreservationRule(
            'eslint-disable',
            /eslint-disable/i,
            800,
            'ESLint disable directives',
            'ESLint'
        );

        expect(rule.tool).toBe('ESLint');
        expect(rule.category).toBe(CommentCategory.TOOLING);
    });

    it('should match ESLint directives', () => {
        const rule = new ToolingPreservationRule(
            'eslint-disable',
            /eslint-disable(-next-line)?/i,
            800,
            'ESLint disable directives',
            'ESLint'
        );

        expect(rule.matches('// eslint-disable-next-line no-console')).toBe(true);
        expect(rule.matches('/* eslint-disable */')).toBe(true);
        expect(rule.matches('// regular comment')).toBe(false);
    });

    it('should extract tool metadata', () => {
        const rule = new ToolingPreservationRule(
            'eslint-disable',
            /eslint-disable/i,
            800,
            'ESLint disable directives',
            'ESLint'
        );

        const metadata = rule.extractMetadata('// eslint-disable-next-line no-console');
        
        expect(metadata).toEqual({
            tool: 'ESLint',
            category: CommentCategory.TOOLING
        });
    });
});

describe('DocumentationPreservationRule', () => {
    it('should create documentation rule', () => {
        const rule = new DocumentationPreservationRule(
            'jsdoc',
            /@\w+/,
            600,
            'JSDoc comments'
        );

        expect(rule.category).toBe(CommentCategory.DOCUMENTATION);
    });

    it('should match JSDoc comments', () => {
        const rule = new DocumentationPreservationRule(
            'jsdoc',
            /@\w+/,
            600,
            'JSDoc comments'
        );

        expect(rule.matches('/** @param {string} name */')).toBe(true);
        expect(rule.matches('/* @returns {boolean} */')).toBe(true);
        expect(rule.matches('// regular comment')).toBe(false);
    });

    it('should extract JSDoc tags', () => {
        const rule = new DocumentationPreservationRule(
            'jsdoc',
            /@\w+/,
            600,
            'JSDoc comments'
        );

        const metadata = rule.extractMetadata('/** @param {string} name @returns {boolean} */');
        
        expect(metadata).toEqual({
            jsdocTags: ['@param', '@returns'],
            category: CommentCategory.DOCUMENTATION
        });
    });
});

describe('CustomPreservationRule', () => {
    it('should create custom rule with user pattern', () => {
        const rule = new CustomPreservationRule(
            'custom-pattern',
            /KEEP/i,
            100,
            'Custom keep pattern',
            'KEEP'
        );

        expect(rule.userPattern).toBe('KEEP');
        expect(rule.category).toBe(CommentCategory.CUSTOM);
    });

    it('should match custom patterns', () => {
        const rule = new CustomPreservationRule(
            'custom-pattern',
            /KEEP/i,
            100,
            'Custom keep pattern',
            'KEEP'
        );

        expect(rule.matches('// KEEP this comment')).toBe(true);
        expect(rule.matches('/* keep this too */')).toBe(true);
        expect(rule.matches('// remove this')).toBe(false);
    });

    it('should extract user pattern metadata', () => {
        const rule = new CustomPreservationRule(
            'custom-pattern',
            /KEEP/i,
            100,
            'Custom keep pattern',
            'KEEP'
        );

        const metadata = rule.extractMetadata('// KEEP this comment');
        
        expect(metadata).toEqual({
            userPattern: 'KEEP',
            category: CommentCategory.CUSTOM
        });
    });
});