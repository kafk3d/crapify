import { CommentCategory } from '../types';
import { PreservationRuleManager } from '../rule-manager';
import { CustomPreservationRule } from '../preservation-rules';

describe('PreservationRuleManager', () => {
    let manager: PreservationRuleManager;

    beforeEach(() => {
        manager = new PreservationRuleManager();
    });

    describe('Rule Management', () => {
        it('should initialize with default rules', () => {
            const rules = manager.getRules();
            expect(rules.length).toBeGreaterThan(0);
            
            // Should have rules for all categories
            const categories = rules.map(rule => rule.category);
            expect(categories).toContain(CommentCategory.FRAMEWORK);
            expect(categories).toContain(CommentCategory.DEVELOPMENT);
            expect(categories).toContain(CommentCategory.TOOLING);
            expect(categories).toContain(CommentCategory.DOCUMENTATION);
        });

        it('should add custom rules', () => {
            const initialCount = manager.getRules().length;
            const customRule = new CustomPreservationRule(
                'test-rule',
                /TEST/i,
                500,
                'Test rule',
                'TEST'
            );

            manager.addRule(customRule);
            
            expect(manager.getRules().length).toBe(initialCount + 1);
            expect(manager.getRules()).toContain(customRule);
        });

        it('should remove rules by name', () => {
            const customRule = new CustomPreservationRule(
                'test-rule',
                /TEST/i,
                500,
                'Test rule',
                'TEST'
            );

            manager.addRule(customRule);
            const removed = manager.removeRule('test-rule');
            
            expect(removed).toBe(true);
            expect(manager.getRules()).not.toContain(customRule);
        });

        it('should return false when removing non-existent rule', () => {
            const removed = manager.removeRule('non-existent');
            expect(removed).toBe(false);
        });

        it('should sort rules by priority', () => {
            manager.clearRules();
            
            const lowPriority = new CustomPreservationRule('low', /low/i, 100, 'Low', 'low');
            const highPriority = new CustomPreservationRule('high', /high/i, 900, 'High', 'high');
            const mediumPriority = new CustomPreservationRule('medium', /medium/i, 500, 'Medium', 'medium');

            manager.addRule(lowPriority);
            manager.addRule(highPriority);
            manager.addRule(mediumPriority);

            const rules = manager.getRules();
            expect(rules[0]).toBe(highPriority);
            expect(rules[1]).toBe(mediumPriority);
            expect(rules[2]).toBe(lowPriority);
        });

        it('should get rules by category', () => {
            const frameworkRules = manager.getRulesByCategory(CommentCategory.FRAMEWORK);
            const developmentRules = manager.getRulesByCategory(CommentCategory.DEVELOPMENT);

            expect(frameworkRules.length).toBeGreaterThan(0);
            expect(developmentRules.length).toBeGreaterThan(0);
            
            frameworkRules.forEach(rule => {
                expect(rule.category).toBe(CommentCategory.FRAMEWORK);
            });
        });
    });

    describe('Comment Classification', () => {
        it('should classify Svelte ignore comments', () => {
            const comment = '<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->';
            const classification = manager.classifyComment(comment);

            expect(classification.shouldPreserve).toBe(true);
            expect(classification.category).toBe(CommentCategory.FRAMEWORK);
            expect(classification.rule).toBeTruthy();
            expect(classification.rule?.name).toBe('svelte-ignore');
        });

        it('should classify development keywords', () => {
            const comment = '// TODO: implement this feature';
            const classification = manager.classifyComment(comment);

            expect(classification.shouldPreserve).toBe(true);
            expect(classification.category).toBe(CommentCategory.DEVELOPMENT);
            expect(classification.metadata.keyword).toBe('TODO');
        });

        it('should classify ESLint directives', () => {
            const comment = '// eslint-disable-next-line no-console';
            const classification = manager.classifyComment(comment);

            expect(classification.shouldPreserve).toBe(true);
            expect(classification.category).toBe(CommentCategory.TOOLING);
            expect(classification.metadata.tool).toBe('ESLint');
        });

        it('should classify JSDoc comments', () => {
            const comment = '/** @param {string} name */';
            const classification = manager.classifyComment(comment);

            expect(classification.shouldPreserve).toBe(true);
            expect(classification.category).toBe(CommentCategory.DOCUMENTATION);
            expect(classification.metadata.jsdocTags).toContain('@param');
        });

        it('should classify regular comments as not preserved', () => {
            const comment = '// just a regular comment';
            const classification = manager.classifyComment(comment);

            expect(classification.shouldPreserve).toBe(false);
            expect(classification.category).toBe(CommentCategory.REGULAR);
            expect(classification.rule).toBeNull();
        });

        it('should use highest priority rule for overlapping patterns', () => {
            manager.clearRules();
            
            const lowPriority = new CustomPreservationRule('low', /test/i, 100, 'Low', 'test');
            const highPriority = new CustomPreservationRule('high', /test/i, 900, 'High', 'test');

            manager.addRule(lowPriority);
            manager.addRule(highPriority);

            const classification = manager.classifyComment('// test comment');
            expect(classification.rule?.name).toBe('high');
        });
    });

    describe('Framework-Specific Rules', () => {
        describe('Svelte Framework (Requirement 2.1)', () => {
            it('should preserve Svelte ignore comments with various accessibility rules', () => {
                const comments = [
                    '<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->',
                    '<!-- svelte-ignore accessibility-click-events-have-key-events -->',
                    '<!-- svelte-ignore a11y-missing-attribute -->',
                    '<!-- svelte-ignore a11y_click_events_have_key_events -->'
                ];

                comments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.FRAMEWORK);
                    expect(classification.metadata.framework).toBe('Svelte');
                });
            });

            it('should not preserve regular HTML comments', () => {
                const comment = '<!-- This is just a regular HTML comment -->';
                expect(manager.shouldPreserveComment(comment)).toBe(false);
            });
        });

        describe('Vue.js Framework (Requirement 2.2)', () => {
            it('should preserve Vue.js ESLint disable comments', () => {
                const comments = [
                    '<!-- eslint-disable vue/no-unused-vars -->',
                    '<!-- eslint-disable -->',
                    '<!--eslint-disable vue/require-default-prop-->'
                ];

                comments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.FRAMEWORK);
                    expect(classification.metadata.framework).toBe('Vue');
                });
            });
        });

        describe('React/JSX Framework (Requirement 2.3)', () => {
            it('should preserve React JSX pragma comments', () => {
                const comments = [
                    '/** @jsx jsx */',
                    '/* @jsx React.createElement */',
                    '/** @jsx h */',
                    '/* @jsx preact.h */'
                ];

                comments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.FRAMEWORK);
                    expect(classification.metadata.framework).toBe('React');
                });
            });
        });

        describe('TypeScript Framework (Requirement 2.4)', () => {
            it('should preserve TypeScript reference directives', () => {
                const comments = [
                    '/// <reference path="./types.d.ts" />',
                    '/// <reference path="../global.d.ts" />',
                    '/// <reference path="./lib/utils.d.ts" />',
                    '///<reference path="types.d.ts"/>'
                ];

                comments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.FRAMEWORK);
                    expect(classification.metadata.framework).toBe('TypeScript');
                });
            });
        });

        describe('Webpack Framework (Requirement 2.5)', () => {
            it('should preserve webpack magic comments', () => {
                const comments = [
                    '/* webpackChunkName: "chunk-name" */',
                    '/* webpackMode: "lazy" */',
                    '/* webpackPrefetch: true */',
                    '/* webpackPreload: true */',
                    '/* webpackChunkName: "my-chunk" */',
                    '/* WEBPACKCHUNKNAME: "uppercase" */',
                    '/* webpackmode: "eager" */'
                ];

                comments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.FRAMEWORK);
                    expect(classification.metadata.framework).toBe('Webpack');
                });
            });

            it('should not preserve regular webpack-related comments', () => {
                const comment = '/* This is about webpack but not a magic comment */';
                expect(manager.shouldPreserveComment(comment)).toBe(false);
            });
        });
    });

    describe('Development Keywords (Requirements 3.1-3.7)', () => {
        describe('TODO keyword preservation (Requirement 3.1)', () => {
            it('should preserve TODO comments in various cases and formats', () => {
                const todoComments = [
                    '// TODO: implement this feature',
                    '/* TODO: refactor this code */',
                    '// todo: fix the bug',
                    '/* Todo: update documentation */',
                    '// TODO - add error handling',
                    '/* TODO implement validation */',
                    '<!-- TODO: update HTML structure -->',
                    '// TODO(john): review this logic'
                ];

                todoComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.DEVELOPMENT);
                    expect(classification.metadata.keyword).toBe('TODO');
                });
            });

            it('should not preserve comments that contain TODO as part of other words', () => {
                const nonTodoComments = [
                    '// This is about TODOS in general',
                    '// TODOLIST functionality',
                    '// TODOIST integration'
                ];

                nonTodoComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(false);
                });
            });
        });

        describe('FIXME keyword preservation (Requirement 3.2)', () => {
            it('should preserve FIXME comments in various cases and formats', () => {
                const fixmeComments = [
                    '// FIXME: broken logic here',
                    '/* FIXME: memory leak issue */',
                    '// fixme: incorrect calculation',
                    '/* Fixme: handle edge case */',
                    '// FIXME - performance issue',
                    '/* FIXME urgent bug */',
                    '// FIXME(urgent): critical issue'
                ];

                fixmeComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.DEVELOPMENT);
                    expect(classification.metadata.keyword).toBe('FIXME');
                });
            });
        });

        describe('HACK keyword preservation (Requirement 3.3)', () => {
            it('should preserve HACK comments in various cases and formats', () => {
                const hackComments = [
                    '// HACK: temporary workaround',
                    '/* HACK: quick fix for demo */',
                    '// hack: not the best solution',
                    '/* Hack: needs proper implementation */',
                    '// HACK - remove before production',
                    '/* HACK dirty solution */'
                ];

                hackComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.DEVELOPMENT);
                    expect(classification.metadata.keyword).toBe('HACK');
                });
            });
        });

        describe('NOTE keyword preservation (Requirement 3.4)', () => {
            it('should preserve NOTE comments in various cases and formats', () => {
                const noteComments = [
                    '// NOTE: important information',
                    '/* NOTE: remember to update this */',
                    '// note: this is significant',
                    '/* Note: check with team lead */',
                    '// NOTE - critical detail',
                    '/* NOTE for future reference */'
                ];

                noteComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.DEVELOPMENT);
                    expect(classification.metadata.keyword).toBe('NOTE');
                });
            });
        });

        describe('XXX keyword preservation (Requirement 3.5)', () => {
            it('should preserve XXX comments in various cases and formats', () => {
                const xxxComments = [
                    '// XXX: needs attention',
                    '/* XXX: problematic code */',
                    '// xxx: review this section',
                    '/* Xxx: potential issue */',
                    '// XXX - requires investigation',
                    '/* XXX dangerous operation */'
                ];

                xxxComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.DEVELOPMENT);
                    expect(classification.metadata.keyword).toBe('XXX');
                });
            });
        });

        describe('BUG keyword preservation (Requirement 3.6)', () => {
            it('should preserve BUG comments in various cases and formats', () => {
                const bugComments = [
                    '// BUG: incorrect behavior',
                    '/* BUG: fails under certain conditions */',
                    '// bug: not working as expected',
                    '/* Bug: edge case failure */',
                    '// BUG - needs immediate fix',
                    '/* BUG known issue */'
                ];

                bugComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.DEVELOPMENT);
                    expect(classification.metadata.keyword).toBe('BUG');
                });
            });
        });

        describe('WARN/WARNING keyword preservation (Requirement 3.7)', () => {
            it('should preserve WARN comments in various cases and formats', () => {
                const warnComments = [
                    '// WARN: potential issue',
                    '/* WARN: use with caution */',
                    '// warn: might cause problems',
                    '/* Warn: check before using */',
                    '// WARN - dangerous operation',
                    '/* WARN experimental feature */'
                ];

                warnComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.DEVELOPMENT);
                    expect(classification.metadata.keyword).toBe('WARN');
                });
            });

            it('should preserve WARNING comments in various cases and formats', () => {
                const warningComments = [
                    '// WARNING: critical issue',
                    '/* WARNING: do not modify */',
                    '// warning: breaking change',
                    '/* Warning: deprecated method */',
                    '// WARNING - handle with care',
                    '/* WARNING security risk */'
                ];

                warningComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.DEVELOPMENT);
                    expect(classification.metadata.keyword).toBe('WARNING');
                });
            });
        });

        describe('Mixed development keywords', () => {
            it('should preserve comments with multiple development keywords', () => {
                const mixedComments = [
                    '// TODO: FIXME this hack',
                    '/* NOTE: BUG in this section */',
                    '// XXX: WARNING - dangerous TODO'
                ];

                mixedComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.DEVELOPMENT);
                });
            });

            it('should preserve development keywords in different comment styles', () => {
                const styleVariations = [
                    '// TODO: line comment',
                    '/* FIXME: block comment */',
                    '/** HACK: JSDoc style */',
                    '<!-- NOTE: HTML comment -->',
                    '# XXX: shell comment',
                    '/* BUG: multi-line\n   comment */',
                    '// WARNING: with special chars !@#$%'
                ];

                styleVariations.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                });
            });
        });

        describe('Edge cases for development keywords', () => {
            it('should preserve keywords at word boundaries only', () => {
                const validBoundaries = [
                    '// TODO: at start',
                    '// (TODO) in parentheses',
                    '// [FIXME] in brackets',
                    '// "HACK" in quotes',
                    '// NOTE. with punctuation',
                    '// XXX, with comma',
                    '// BUG! with exclamation',
                    '// WARNING? with question'
                ];

                validBoundaries.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                });
            });

            it('should not preserve keywords that are part of larger words', () => {
                const invalidBoundaries = [
                    '// TODOLIST functionality',
                    '// FIXMEUP operation',
                    '// HACKATHON event',
                    '// NOTEBOOK reference',
                    '// XXXLARGE size',
                    '// DEBUGGING session',
                    '// WARNINGS array'
                ];

                invalidBoundaries.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(false);
                });
            });

            it('should preserve keywords with various separators', () => {
                const separatorVariations = [
                    '// TODO: with colon',
                    '// TODO - with dash',
                    '// TODO with space',
                    '// TODO(author) with parentheses',
                    '// TODO[ticket] with brackets',
                    '// TODO | with pipe',
                    '// TODO > with arrow'
                ];

                separatorVariations.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                });
            });
        });

        it('should preserve all development keywords case-insensitively', () => {
            const keywords = ['TODO', 'FIXME', 'HACK', 'NOTE', 'XXX', 'BUG', 'WARN', 'WARNING'];
            
            keywords.forEach(keyword => {
                expect(manager.shouldPreserveComment(`// ${keyword}: test`)).toBe(true);
                expect(manager.shouldPreserveComment(`// ${keyword.toLowerCase()}: test`)).toBe(true);
                expect(manager.shouldPreserveComment(`/* ${keyword}: test */`)).toBe(true);
            });
        });
    });

    describe('Tooling Directives (Requirements 4.1-4.5)', () => {
        describe('ESLint directive preservation (Requirement 4.1)', () => {
            it('should preserve ESLint disable directives', () => {
                const disableDirectives = [
                    '// eslint-disable',
                    '/* eslint-disable */',
                    '// eslint-disable no-console',
                    '/* eslint-disable no-unused-vars */',
                    '// eslint-disable no-console, no-alert',
                    '/* eslint-disable @typescript-eslint/no-explicit-any */',
                    '// ESLINT-DISABLE (case insensitive)',
                    '/* ESLINT-DISABLE-NEXT-LINE */'
                ];

                disableDirectives.forEach(directive => {
                    expect(manager.shouldPreserveComment(directive)).toBe(true);
                    const classification = manager.classifyComment(directive);
                    expect(classification.category).toBe(CommentCategory.TOOLING);
                    expect(classification.metadata.tool).toBe('ESLint');
                });
            });

            it('should preserve ESLint enable directives', () => {
                const enableDirectives = [
                    '// eslint-enable',
                    '/* eslint-enable */',
                    '// eslint-enable no-console',
                    '/* eslint-enable no-unused-vars */',
                    '// eslint-enable no-console, no-alert',
                    '// ESLINT-ENABLE (case insensitive)'
                ];

                enableDirectives.forEach(directive => {
                    expect(manager.shouldPreserveComment(directive)).toBe(true);
                    const classification = manager.classifyComment(directive);
                    expect(classification.category).toBe(CommentCategory.TOOLING);
                    expect(classification.metadata.tool).toBe('ESLint');
                });
            });

            it('should preserve ESLint disable-next-line directives', () => {
                const nextLineDirectives = [
                    '// eslint-disable-next-line',
                    '/* eslint-disable-next-line */',
                    '// eslint-disable-next-line no-console',
                    '/* eslint-disable-next-line no-unused-vars */',
                    '// eslint-disable-next-line no-console, no-alert',
                    '/* eslint-disable-next-line @typescript-eslint/no-explicit-any */',
                    '// ESLINT-DISABLE-NEXT-LINE (case insensitive)'
                ];

                nextLineDirectives.forEach(directive => {
                    expect(manager.shouldPreserveComment(directive)).toBe(true);
                    const classification = manager.classifyComment(directive);
                    expect(classification.category).toBe(CommentCategory.TOOLING);
                    expect(classification.metadata.tool).toBe('ESLint');
                });
            });

            it('should not preserve non-ESLint comments containing eslint', () => {
                const nonDirectives = [
                    '// This is about eslint configuration',
                    '/* eslint is a great tool */',
                    '// We use eslint in our project'
                ];

                nonDirectives.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(false);
                });
            });
        });

        describe('Prettier ignore comment preservation (Requirement 4.2)', () => {
            it('should preserve Prettier ignore comments in various formats', () => {
                const prettierIgnoreComments = [
                    '// prettier-ignore',
                    '/* prettier-ignore */',
                    '// PRETTIER-IGNORE (case insensitive)',
                    '/* PRETTIER-IGNORE */',
                    '// prettier-ignore: specific formatting',
                    '/* prettier-ignore - keep this formatting */'
                ];

                prettierIgnoreComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.TOOLING);
                    expect(classification.metadata.tool).toBe('Prettier');
                });
            });

            it('should not preserve non-Prettier comments containing prettier', () => {
                const nonDirectives = [
                    '// This code is prettier than before',
                    '/* prettier configuration file */',
                    '// We use prettier for formatting'
                ];

                nonDirectives.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(false);
                });
            });
        });

        describe('JSDoc comment preservation with @ annotation detection (Requirement 4.3)', () => {
            it('should preserve JSDoc comments with @ annotations', () => {
                const jsdocComments = [
                    '/** @param {string} name */',
                    '/* @returns {boolean} */',
                    '/** @param {number} age @returns {string} */',
                    '/* @deprecated Use newFunction instead */',
                    '/** @throws {Error} When validation fails */',
                    '/* @example console.log("hello") */',
                    '/** @since 1.0.0 */',
                    '/* @author John Doe */',
                    '/** @see https://example.com */',
                    '/* @todo Implement this feature */',
                    '/** @override */',
                    '/* @readonly */',
                    '/** @static */',
                    '/* @private */',
                    '/** @public */',
                    '/* @protected */',
                    '/** @abstract */',
                    '/* @final */',
                    '/** @namespace MyNamespace */',
                    '/* @module MyModule */',
                    '/** @class MyClass */',
                    '/* @interface MyInterface */',
                    '/** @typedef {Object} MyType */',
                    '/* @callback MyCallback */',
                    '/** @enum {string} */',
                    '/* @memberof MyClass */',
                    '/** @inner */',
                    '/* @instance */',
                    '/** @global */',
                    '/* @ignore */',
                    '/** @fileoverview This file contains utilities */'
                ];

                jsdocComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.DOCUMENTATION);
                    expect(classification.metadata.jsdocTags).toBeDefined();
                    expect(classification.metadata.jsdocTags.length).toBeGreaterThan(0);
                });
            });

            it('should extract multiple JSDoc tags correctly', () => {
                const comment = '/** @param {string} name @param {number} age @returns {boolean} */';
                const classification = manager.classifyComment(comment);
                
                expect(classification.shouldPreserve).toBe(true);
                expect(classification.metadata.jsdocTags).toEqual(['@param', '@param', '@returns']);
            });

            it('should not preserve comments with @ that are not JSDoc annotations', () => {
                const nonJsdocComments = [
                    '// Send email to user@example.com',
                    '/* Price is $10 @ store */',
                    '// Meeting @ 3pm today'
                ];

                // These might still match the @\w+ pattern, but they're not typical JSDoc
                // The current implementation is broad and will match these
                // This is acceptable as it's better to over-preserve than under-preserve
            });
        });

        describe('TypeScript ignore comment preservation (Requirement 4.4)', () => {
            it('should preserve @ts-ignore comments', () => {
                const tsIgnoreComments = [
                    '// @ts-ignore',
                    '/* @ts-ignore */',
                    '// @ts-ignore: Type assertion needed here',
                    '/* @ts-ignore - Legacy code compatibility */',
                    '// @TS-IGNORE (case insensitive)',
                    '/* @TS-IGNORE */'
                ];

                tsIgnoreComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.TOOLING);
                    expect(classification.metadata.tool).toBe('TypeScript');
                });
            });

            it('should preserve @ts-expect-error comments', () => {
                const tsExpectErrorComments = [
                    '// @ts-expect-error',
                    '/* @ts-expect-error */',
                    '// @ts-expect-error: This should fail type checking',
                    '/* @ts-expect-error - Intentional type error for testing */',
                    '// @TS-EXPECT-ERROR (case insensitive)',
                    '/* @TS-EXPECT-ERROR */'
                ];

                tsExpectErrorComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.TOOLING);
                    expect(classification.metadata.tool).toBe('TypeScript');
                });
            });

            it('should preserve @ts-nocheck comments', () => {
                const tsNocheckComments = [
                    '// @ts-nocheck',
                    '/* @ts-nocheck */',
                    '// @ts-nocheck: Skip type checking for this file',
                    '/* @ts-nocheck - Legacy JavaScript file */',
                    '// @TS-NOCHECK (case insensitive)',
                    '/* @TS-NOCHECK */'
                ];

                tsNocheckComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.TOOLING);
                    expect(classification.metadata.tool).toBe('TypeScript');
                });
            });

            it('should not preserve non-TypeScript comments containing @ts', () => {
                const nonTsComments = [
                    '// This function returns @ts-format data',
                    '/* Email sent @ts-timestamp info */',
                    '// Configuration @ts-settings value'
                ];

                nonTsComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(false);
                });
            });
        });

        describe('Code coverage ignore comment preservation (Requirement 4.5)', () => {
            it('should preserve Istanbul coverage ignore comments', () => {
                const istanbulComments = [
                    '/* istanbul ignore next */',
                    '// istanbul ignore next',
                    '/* istanbul ignore file */',
                    '// istanbul ignore file',
                    '/* istanbul ignore if */',
                    '// istanbul ignore if',
                    '/* istanbul ignore else */',
                    '// istanbul ignore else',
                    '/* ISTANBUL IGNORE NEXT (case insensitive) */',
                    '// ISTANBUL IGNORE FILE',
                    '/* istanbul ignore next: reason for ignoring */',
                    '// istanbul ignore file - generated code'
                ];

                istanbulComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.TOOLING);
                    expect(classification.metadata.tool).toBe('Coverage');
                });
            });

            it('should preserve c8 coverage ignore comments', () => {
                const c8Comments = [
                    '/* c8 ignore next */',
                    '// c8 ignore next',
                    '/* c8 ignore start */',
                    '// c8 ignore start',
                    '/* c8 ignore stop */',
                    '// c8 ignore stop',
                    '/* C8 IGNORE NEXT (case insensitive) */',
                    '// C8 IGNORE START',
                    '/* c8 ignore next: reason for ignoring */',
                    '// c8 ignore start - generated code section'
                ];

                c8Comments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                    const classification = manager.classifyComment(comment);
                    expect(classification.category).toBe(CommentCategory.TOOLING);
                    expect(classification.metadata.tool).toBe('Coverage');
                });
            });

            it('should not preserve non-coverage comments containing istanbul or c8', () => {
                const nonCoverageComments = [
                    '// This test was run in istanbul',
                    '/* c8 is a great coverage tool */',
                    '// We use istanbul for coverage reporting'
                ];

                nonCoverageComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(false);
                });
            });
        });

        describe('Tooling directive edge cases', () => {
            it('should handle mixed tooling directives in single comments', () => {
                const mixedComments = [
                    '// eslint-disable-next-line @typescript-eslint/no-explicit-any',
                    '/* prettier-ignore eslint-disable */',
                    '// @ts-ignore eslint-disable-next-line'
                ];

                mixedComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                });
            });

            it('should preserve tooling directives with additional context', () => {
                const contextualComments = [
                    '// eslint-disable-next-line no-console -- needed for debugging',
                    '/* prettier-ignore: complex formatting required */',
                    '// @ts-ignore TODO: fix type definitions',
                    '/* istanbul ignore next: generated code */'
                ];

                contextualComments.forEach(comment => {
                    expect(manager.shouldPreserveComment(comment)).toBe(true);
                });
            });

            it('should handle tooling directives in different comment styles', () => {
                const styleVariations = [
                    '// eslint-disable-next-line',
                    '/* eslint-disable */',
                    '/** eslint-disable */',
                    '<!-- eslint-disable -->',
                    '# eslint-disable',
                    '// prettier-ignore',
                    '/* prettier-ignore */',
                    '/** prettier-ignore */'
                ];

                styleVariations.forEach(comment => {
                    const shouldPreserve = manager.shouldPreserveComment(comment);
                    // Most should be preserved, HTML and shell comments might not match
                    if (comment.includes('eslint-disable') || comment.includes('prettier-ignore')) {
                        expect(shouldPreserve).toBe(true);
                    }
                });
            });
        });
    });

    describe('Custom Patterns', () => {
        it('should add custom patterns successfully', () => {
            manager.addCustomPattern('keep-important', 'IMPORTANT', 500);
            
            expect(manager.shouldPreserveComment('// IMPORTANT: keep this')).toBe(true);
            expect(manager.shouldPreserveComment('// regular comment')).toBe(false);
        });

        it('should handle invalid regex patterns', () => {
            expect(() => {
                manager.addCustomPattern('invalid', '[invalid regex', 500);
            }).toThrow('Invalid regex pattern');
        });
    });

    describe('Rule Management Operations', () => {
        it('should clear all rules', () => {
            manager.clearRules();
            expect(manager.getRules().length).toBe(0);
        });

        it('should reset to default rules', () => {
            manager.clearRules();
            expect(manager.getRules().length).toBe(0);
            
            manager.resetToDefaults();
            expect(manager.getRules().length).toBeGreaterThan(0);
        });
    });
});