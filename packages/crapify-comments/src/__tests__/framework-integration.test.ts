import { PreservationRuleManager } from '../rule-manager';
import { CommentCategory } from '../types';

describe('Framework Integration Tests', () => {
    let manager: PreservationRuleManager;

    beforeEach(() => {
        manager = new PreservationRuleManager();
    });

    describe('Real-world Framework Comment Scenarios', () => {
        it('should handle mixed framework comments in a single file', () => {
            const codeWithComments = `
// Regular comment that should be removed
/* Another regular comment */

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<button on:click={handleClick}>Click me</button>

/** @jsx jsx */
import { jsx } from '@emotion/react';

/// <reference path="./types.d.ts" />

// eslint-disable-next-line no-console
console.log('Debug info');

/* webpackChunkName: "lazy-component" */
const LazyComponent = lazy(() => import('./LazyComponent'));

// TODO: Refactor this component
const MyComponent = () => {
    // This comment should be removed
    return <div>Hello World</div>;
};

/* prettier-ignore */
const uglyCode = {a:1,b:2,c:3};

// @ts-ignore
const anyValue: any = someUntypedValue;

/* istanbul ignore next */
if (process.env.NODE_ENV === 'test') {
    // Test-only code
}
            `.trim();

            const lines = codeWithComments.split('\n');
            const preservedComments: string[] = [];
            const removedComments: string[] = [];

            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('<!--')) {
                    if (manager.shouldPreserveComment(trimmed)) {
                        preservedComments.push(trimmed);
                    } else {
                        removedComments.push(trimmed);
                    }
                }
            });

            // Verify preserved comments
            expect(preservedComments).toContain('<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->');
            expect(preservedComments).toContain('/** @jsx jsx */');
            expect(preservedComments).toContain('/// <reference path="./types.d.ts" />');
            expect(preservedComments).toContain('// eslint-disable-next-line no-console');
            expect(preservedComments).toContain('/* webpackChunkName: "lazy-component" */');
            expect(preservedComments).toContain('// TODO: Refactor this component');
            expect(preservedComments).toContain('/* prettier-ignore */');
            expect(preservedComments).toContain('// @ts-ignore');
            expect(preservedComments).toContain('/* istanbul ignore next */');

            // Verify removed comments
            expect(removedComments).toContain('// Regular comment that should be removed');
            expect(removedComments).toContain('/* Another regular comment */');
            expect(removedComments).toContain('// This comment should be removed');
            expect(removedComments).toContain('// Test-only code');

            // Verify counts
            expect(preservedComments.length).toBe(9);
            expect(removedComments.length).toBe(4);
        });

        it('should correctly classify all framework-specific comment types', () => {
            const frameworkComments = [
                {
                    comment: '<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->',
                    expectedFramework: 'Svelte',
                    requirement: '2.1'
                },
                {
                    comment: '<!-- eslint-disable vue/no-unused-vars -->',
                    expectedFramework: 'Vue',
                    requirement: '2.2'
                },
                {
                    comment: '/** @jsx jsx */',
                    expectedFramework: 'React',
                    requirement: '2.3'
                },
                {
                    comment: '/// <reference path="./types.d.ts" />',
                    expectedFramework: 'TypeScript',
                    requirement: '2.4'
                },
                {
                    comment: '/* webpackChunkName: "chunk-name" */',
                    expectedFramework: 'Webpack',
                    requirement: '2.5'
                }
            ];

            frameworkComments.forEach(({ comment, expectedFramework, requirement }) => {
                const classification = manager.classifyComment(comment);
                
                expect(classification.shouldPreserve).toBe(true);
                expect(classification.category).toBe(CommentCategory.FRAMEWORK);
                expect(classification.metadata.framework).toBe(expectedFramework);
                expect(classification.rule).toBeTruthy();
                
                // Verify the rule has high priority (framework rules should be 900)
                expect(classification.rule!.priority).toBe(900);
            });
        });

        it('should handle edge cases in framework patterns', () => {
            const edgeCases = [
                // Svelte with different spacing
                '<!--svelte-ignore a11y_click_events_have_key_events-->',
                '<!-- svelte-ignore   accessibility-missing-attribute   -->',
                
                // Vue with different formats
                '<!--eslint-disable-->',
                '<!-- eslint-disable vue/require-default-prop -->',
                
                // JSX with different pragma formats
                '/* @jsx h */',
                '/** @jsx React.createElement */',
                
                // TypeScript references with different paths
                '///<reference path="global.d.ts"/>',
                '/// <reference path="../types/index.d.ts" />',
                
                // Webpack with different casing
                '/* WEBPACKCHUNKNAME: "uppercase" */',
                '/* webpackmode: "lazy" */',
                '/* webpackPrefetch: true */',
                '/* webpackPreload: false */'
            ];

            edgeCases.forEach(comment => {
                expect(manager.shouldPreserveComment(comment)).toBe(true);
                const classification = manager.classifyComment(comment);
                expect(classification.category).toBe(CommentCategory.FRAMEWORK);
            });
        });

        it('should not preserve similar-looking but non-framework comments', () => {
            const nonFrameworkComments = [
                '<!-- This is just a regular HTML comment -->',
                '/* This mentions webpack but is not a magic comment */',
                '// This talks about jsx but is not a pragma',
                '/// This looks like a reference but is not',
                '<!-- This mentions svelte but is not an ignore directive -->'
            ];

            nonFrameworkComments.forEach(comment => {
                expect(manager.shouldPreserveComment(comment)).toBe(false);
                const classification = manager.classifyComment(comment);
                expect(classification.category).toBe(CommentCategory.REGULAR);
            });
        });
    });

    describe('Framework Rule Priority and Precedence', () => {
        it('should prioritize framework rules over other categories', () => {
            // Framework rules should have priority 900, which is higher than others
            const frameworkRules = manager.getRulesByCategory(CommentCategory.FRAMEWORK);
            const developmentRules = manager.getRulesByCategory(CommentCategory.DEVELOPMENT);
            const toolingRules = manager.getRulesByCategory(CommentCategory.TOOLING);

            frameworkRules.forEach(rule => {
                expect(rule.priority).toBe(900);
            });

            // Verify framework rules have higher priority than development rules (700)
            developmentRules.forEach(devRule => {
                frameworkRules.forEach(frameworkRule => {
                    expect(frameworkRule.priority).toBeGreaterThan(devRule.priority);
                });
            });

            // Verify framework rules have higher priority than most tooling rules (800)
            // Note: Some tooling rules also have priority 800, but framework should be 900
            const allRules = manager.getRules();
            const highestPriorityRules = allRules.filter(rule => rule.priority === 900);
            
            // All highest priority rules should be framework rules
            highestPriorityRules.forEach(rule => {
                expect(rule.category).toBe(CommentCategory.FRAMEWORK);
            });
        });

        it('should handle overlapping patterns correctly', () => {
            // Test a comment that could match multiple patterns
            const comment = '// eslint-disable-next-line @typescript-eslint/no-unused-vars';
            
            const classification = manager.classifyComment(comment);
            
            // Should be classified as tooling (ESLint) rather than framework
            expect(classification.category).toBe(CommentCategory.TOOLING);
            expect(classification.metadata.tool).toBe('ESLint');
        });
    });

    describe('Tooling Directive Integration Tests (Requirements 4.1-4.5)', () => {
        it('should handle mixed tooling directives in a real codebase scenario', () => {
            const codeWithToolingDirectives = `
// Regular comment that should be removed
/* Another regular comment */

// eslint-disable-next-line no-console
console.log('Debug information');

/* eslint-disable no-unused-vars, @typescript-eslint/no-explicit-any */
const unusedVar: any = 'test';
/* eslint-enable no-unused-vars */

// prettier-ignore
const uglyFormatting={a:1,b:2,c:3,d:4};

/**
 * Calculate the sum of two numbers
 * @param {number} a - First number
 * @param {number} b - Second number  
 * @returns {number} The sum of a and b
 * @example
 * const result = add(2, 3); // returns 5
 */
function add(a: number, b: number): number {
    // @ts-ignore: Legacy code compatibility
    return a + b;
}

// @ts-expect-error: This should fail type checking in tests
const invalidOperation = add('2', '3');

/* istanbul ignore next */
if (process.env.NODE_ENV === 'development') {
    console.log('Development mode');
}

// c8 ignore start
function debugOnlyFunction() {
    console.log('This is only for debugging');
}
// c8 ignore stop

// TODO: Add proper error handling
// FIXME: This function needs optimization
function processData(data: unknown) {
    // Regular comment to be removed
    return data;
}

// @ts-nocheck
// This file has legacy JavaScript that doesn't type-check well
            `.trim();

            const lines = codeWithToolingDirectives.split('\n');
            const preservedComments: string[] = [];
            const removedComments: string[] = [];

            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                    if (manager.shouldPreserveComment(trimmed)) {
                        preservedComments.push(trimmed);
                    } else {
                        removedComments.push(trimmed);
                    }
                }
            });

            // Verify ESLint directives are preserved (Requirement 4.1)
            expect(preservedComments).toContain('// eslint-disable-next-line no-console');
            expect(preservedComments).toContain('/* eslint-disable no-unused-vars, @typescript-eslint/no-explicit-any */');
            expect(preservedComments).toContain('/* eslint-enable no-unused-vars */');

            // Verify Prettier ignore is preserved (Requirement 4.2)
            expect(preservedComments).toContain('// prettier-ignore');

            // Verify JSDoc comments are preserved (Requirement 4.3)
            expect(preservedComments.some(comment => comment.includes('@param'))).toBe(true);
            expect(preservedComments.some(comment => comment.includes('@returns'))).toBe(true);
            expect(preservedComments.some(comment => comment.includes('@example'))).toBe(true);

            // Verify TypeScript ignore comments are preserved (Requirement 4.4)
            expect(preservedComments).toContain('// @ts-ignore: Legacy code compatibility');
            expect(preservedComments).toContain('// @ts-expect-error: This should fail type checking in tests');
            expect(preservedComments).toContain('// @ts-nocheck');

            // Verify coverage ignore comments are preserved (Requirement 4.5)
            expect(preservedComments).toContain('/* istanbul ignore next */');
            expect(preservedComments).toContain('// c8 ignore start');
            expect(preservedComments).toContain('// c8 ignore stop');

            // Verify development keywords are preserved
            expect(preservedComments).toContain('// TODO: Add proper error handling');
            expect(preservedComments).toContain('// FIXME: This function needs optimization');

            // Verify regular comments are removed
            expect(removedComments).toContain('// Regular comment that should be removed');
            expect(removedComments).toContain('/* Another regular comment */');
            expect(removedComments).toContain('// Regular comment to be removed');

            // Verify we have the expected number of preserved vs removed comments
            expect(preservedComments.length).toBeGreaterThan(10);
            expect(removedComments.length).toBeGreaterThan(0);
        });

        it('should correctly classify all tooling directive types', () => {
            const toolingDirectives = [
                {
                    comment: '// eslint-disable-next-line no-console',
                    expectedTool: 'ESLint',
                    requirement: '4.1'
                },
                {
                    comment: '/* prettier-ignore */',
                    expectedTool: 'Prettier',
                    requirement: '4.2'
                },
                {
                    comment: '// @ts-ignore',
                    expectedTool: 'TypeScript',
                    requirement: '4.4'
                },
                {
                    comment: '/* istanbul ignore next */',
                    expectedTool: 'Coverage',
                    requirement: '4.5'
                }
            ];

            toolingDirectives.forEach(({ comment, expectedTool, requirement }) => {
                const classification = manager.classifyComment(comment);
                
                expect(classification.shouldPreserve).toBe(true);
                expect(classification.category).toBe(CommentCategory.TOOLING);
                expect(classification.metadata.tool).toBe(expectedTool);
                expect(classification.rule).toBeTruthy();
                
                // Verify the rule has high priority (tooling rules should be 800)
                expect(classification.rule!.priority).toBe(800);
            });
        });

        it('should handle JSDoc comments with proper documentation classification', () => {
            const jsdocComments = [
                '/** @param {string} name */',
                '/* @returns {boolean} */',
                '/** @deprecated Use newFunction instead */',
                '/* @example console.log("hello") */',
                '/** @since 1.0.0 @author John Doe */'
            ];

            jsdocComments.forEach(comment => {
                const classification = manager.classifyComment(comment);
                
                expect(classification.shouldPreserve).toBe(true);
                expect(classification.category).toBe(CommentCategory.DOCUMENTATION);
                expect(classification.metadata.jsdocTags).toBeDefined();
                expect(classification.metadata.jsdocTags.length).toBeGreaterThan(0);
                
                // JSDoc should have priority 750 (higher than development keywords)
                expect(classification.rule!.priority).toBe(750);
            });
        });

        it('should handle complex tooling directive scenarios', () => {
            const complexScenarios = [
                // Multiple ESLint rules in one directive
                '// eslint-disable-next-line no-console, no-alert, @typescript-eslint/no-explicit-any',
                
                // ESLint with explanatory text
                '/* eslint-disable no-unused-vars -- needed for interface compatibility */',
                
                // Prettier with context
                '// prettier-ignore: complex mathematical expression formatting',
                
                // TypeScript with explanation
                '// @ts-ignore TODO: fix type definitions in next version',
                
                // Coverage with reason
                '/* istanbul ignore next: generated code from template */',
                
                // Mixed JSDoc tags
                '/** @param {Object} config @param {string} config.name @param {number} config.age */',
                
                // Nested tooling directives
                '// eslint-disable-next-line @typescript-eslint/ban-ts-comment\n// @ts-ignore'
            ];

            complexScenarios.forEach(scenario => {
                const lines = scenario.split('\n');
                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
                        expect(manager.shouldPreserveComment(trimmed)).toBe(true);
                        const classification = manager.classifyComment(trimmed);
                        expect([CommentCategory.TOOLING, CommentCategory.DOCUMENTATION]).toContain(classification.category);
                    }
                });
            });
        });

        it('should not preserve non-tooling comments that contain tooling-like text', () => {
            const nonToolingComments = [
                '// This code is prettier than the old version',
                '/* We use eslint in our project for linting */',
                '// The @ts format is used for timestamps',
                '/* This function was tested in istanbul last year */',
                '// The c8 corvette is a fast car',
                '// Send email to user@param.com',
                '// Meeting scheduled @returns 3pm'
            ];

            nonToolingComments.forEach(comment => {
                const shouldPreserve = manager.shouldPreserveComment(comment);
                // These should either not be preserved, or if preserved, should be for other reasons (like development keywords)
                if (shouldPreserve) {
                    const classification = manager.classifyComment(comment);
                    // If preserved, it should not be because of tooling rules
                    expect(classification.category).not.toBe(CommentCategory.TOOLING);
                }
            });
        });

        it('should handle tooling directives with various comment styles', () => {
            const styleVariations = [
                // Line comments
                '// eslint-disable-next-line',
                '// prettier-ignore',
                '// @ts-ignore',
                '// istanbul ignore next',
                
                // Block comments
                '/* eslint-disable */',
                '/* prettier-ignore */',
                '/* @ts-expect-error */',
                '/* c8 ignore start */',
                
                // JSDoc style
                '/** @param {string} name */',
                '/** @returns {boolean} */',
                
                // Mixed with other content
                '// TODO: eslint-disable-next-line no-console',
                '/* FIXME: @ts-ignore needed here */'
            ];

            styleVariations.forEach(comment => {
                expect(manager.shouldPreserveComment(comment)).toBe(true);
                const classification = manager.classifyComment(comment);
                expect([
                    CommentCategory.TOOLING, 
                    CommentCategory.DOCUMENTATION, 
                    CommentCategory.DEVELOPMENT
                ]).toContain(classification.category);
            });
        });
    });
});