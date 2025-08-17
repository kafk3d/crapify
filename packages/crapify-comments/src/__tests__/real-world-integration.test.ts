import { CommentRemover } from '../comment-remover';
import { Logger } from '@kafked/shared';

describe('Real-World Integration Tests', () => {
    let remover: CommentRemover;
    let mockLogger: jest.Mocked<Logger>;

    beforeEach(() => {
        mockLogger = new Logger(false, false, false) as jest.Mocked<Logger>;
        mockLogger.info = jest.fn();
        mockLogger.success = jest.fn();
        mockLogger.error = jest.fn();
        mockLogger.warn = jest.fn();
        mockLogger.json = jest.fn();
        
        remover = new CommentRemover([], { logger: mockLogger });
    });

    describe('Real-world code examples with regex patterns (Requirement 1.1)', () => {
        it('should handle the original truncation bug scenario', () => {
            // This is the exact code that caused the original bug
            const problematicCode = `
function removeComments(content) {
    // Remove block comments
    result = result.replace(/\\/\\*[\\s\\S]*?\\*\\//g, (match) => {
        return '';
    });
    
    // Remove line comments
    result = result.replace(/\\/\\/.*$/gm, '');
    
    return result;
}
            `.trim();

            const result = remover.removeComments(problematicCode, 'test.js');

            
            expect(result.content).toContain('/\\/\\*[\\s\\S]*?\\*\\//g');
            expect(result.content).toContain('/\\/\\/.*$/gm');
            
            
            expect(result.content).toContain('(match) => {');
            expect(result.content).toContain("return '';");
            
            
            expect(result.content).not.toContain('// Remove block comments');
            expect(result.content).not.toContain('// Remove line comments');
            
            expect(result.removed).toBe(2);
            expect(result.preserved).toBe(0);
        });

        it('should handle complex regex patterns in real code', () => {
            const codeWithComplexRegex = `
const emailValidator = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;
const urlPattern = /https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)/;
const commentRemover = /(?:\\/\\*[\\s\\S]*?\\*\\/|\\/\\/.*$)/gm;
const htmlTagPattern = /<\\/?[a-z][\\s\\S]*>/i;

// This is a regular comment that should be removed
function validateInput(input) {
    /* TODO: Add more validation rules */
    if (emailValidator.test(input)) {
        return 'email';
    }
    
    // Check if it's a URL
    if (urlPattern.test(input)) {
        return 'url';
    }
    
    return 'unknown';
}
            `.trim();

            const result = remover.removeComments(codeWithComplexRegex, 'validator.js');

            
            expect(result.content).toContain('/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/');
            expect(result.content).toContain('/https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)/');
            expect(result.content).toContain('/(?:\\/\\*[\\s\\S]*?\\*\\/|\\/\\/.*$)/gm');
            expect(result.content).toContain('/<\\/?[a-z][\\s\\S]*>/i');
            
            // TODO comment should be preserved
            expect(result.content).toContain('/* TODO: Add more validation rules */');
            
            
            expect(result.content).not.toContain('// This is a regular comment that should be removed');
            expect(result.content).not.toContain('// Check if it\'s a URL');
            
            expect(result.removed).toBe(2);
            expect(result.preserved).toBe(1);
        });

        it('should handle regex in template literals and complex expressions', () => {
            const complexCode = `
const buildRegexPattern = (flags = 'g') => {
    const pattern = \`/\\/\\*[\\s\\S]*?\\*\\//\${flags}\`;
    return new RegExp(pattern);
};

const patterns = {
    comments: /\\/\\*[\\s\\S]*?\\*\\//g,
    lineComments: /\\/\\/.*$/gm,
    strings: /"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'/g,
    regexLiterals: /\\/(?:[^\\/\\\\\\n]|\\\\.)+\\/[gimsuyvd]*/g
};

// Regular comment to remove
const processor = {
    // Another comment to remove
    process: (code) => {
        /* FIXME: This needs optimization */
        return code.replace(patterns.comments, '')
                  .replace(patterns.lineComments, '');
    }
};

const testCases = [
    { input: 'const x = /test\\/pattern/g;', expected: 'preserved' },
    { input: '// comment', expected: 'removed' }
];
            `.trim();

            const result = remover.removeComments(complexCode, 'processor.js');

            
            expect(result.content).toContain('`/\\/\\*[\\s\\S]*?\\*\\//${flags}`');
            
            
            expect(result.content).toContain('/\\/\\*[\\s\\S]*?\\*\\//g');
            expect(result.content).toContain('/\\/\\/.*$/gm');
            expect(result.content).toContain('/"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\'/g');
            expect(result.content).toContain('/\\/(?:[^\\/\\\\\\n]|\\\\.)+\\/[gimsuyvd]*/g');
            
            
            expect(result.content).toContain('/test\\/pattern/g');
            
            // FIXME comment should be preserved
            expect(result.content).toContain('/* FIXME: This needs optimization */');
            
            
            expect(result.content).not.toContain('// Regular comment to remove');
            expect(result.content).not.toContain('// Another comment to remove');
            
            expect(result.removed).toBe(2);
            expect(result.preserved).toBe(1);
        });
    });

    describe('Framework-specific comment preservation (Requirement 2.1)', () => {
        it('should handle a complete Svelte component', () => {
            const svelteComponent = `
<script>
    // Regular comment to remove
    import { onMount } from 'svelte';
    
    let count = 0;
    
    /* TODO: Add proper validation */
    function increment() {
        count += 1;
    }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div on:click={increment}>
    <!-- This is a regular HTML comment -->
    <h1>Count: {count}</h1>
    <!-- svelte-ignore a11y_missing_attribute -->
    <img src="icon.png" />
</div>

<style>
    /* Regular CSS comment */
    h1 {
        color: blue;
    }
    
    /* TODO: Improve styling */
    div {
        cursor: pointer;
    }
</style>
            `.trim();

            const result = remover.removeComments(svelteComponent, 'Counter.svelte');

            
            expect(result.content).toContain('<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->');
            expect(result.content).toContain('<!-- svelte-ignore a11y_click_events_have_key_events -->');
            expect(result.content).toContain('<!-- svelte-ignore a11y_missing_attribute -->');
            
            // TODO comments should be preserved
            expect(result.content).toContain('/* TODO: Add proper validation */');
            expect(result.content).toContain('/* TODO: Improve styling */');
            
            
            expect(result.content).not.toContain('// Regular comment to remove');
            expect(result.content).not.toContain('<!-- This is a regular HTML comment -->');
            expect(result.content).not.toContain('/* Regular CSS comment */');
            
            expect(result.removed).toBe(3);
            expect(result.preserved).toBe(5);
        });

        it('should handle a React component with JSX pragma and webpack comments', () => {
            const reactComponent = `
/** @jsx jsx */
import { jsx } from '@emotion/react';
import { lazy, Suspense } from 'react';

// Regular import comment
const LazyComponent = lazy(() => 
    /* webpackChunkName: "lazy-component" */
    /* webpackMode: "lazy" */
    import('./LazyComponent')
);

const AsyncComponent = lazy(() =>
    /* webpackChunkName: "async-component" */
    /* webpackPrefetch: true */
    import(/* webpackPreload: true */ './AsyncComponent')
);

// TODO: Add error boundary
export default function App() {
    /* Regular block comment */
    return jsx('div', null,
        jsx('h1', null, 'My App'),
        jsx(Suspense, { fallback: jsx('div', null, 'Loading...') },
            jsx(LazyComponent, null),
            jsx(AsyncComponent, null)
        )
    );
}
            `.trim();

            const result = remover.removeComments(reactComponent, 'App.jsx');

            
            expect(result.content).toContain('/** @jsx jsx */');
            
            
            expect(result.content).toContain('/* webpackChunkName: "lazy-component" */');
            expect(result.content).toContain('/* webpackMode: "lazy" */');
            expect(result.content).toContain('/* webpackChunkName: "async-component" */');
            expect(result.content).toContain('/* webpackPrefetch: true */');
            expect(result.content).toContain('/* webpackPreload: true */');
            
            // TODO comment should be preserved
            expect(result.content).toContain('// TODO: Add error boundary');
            
            
            expect(result.content).not.toContain('// Regular import comment');
            expect(result.content).not.toContain('/* Regular block comment */');
            
            expect(result.removed).toBe(2);
            expect(result.preserved).toBe(7);
        });

        it('should handle TypeScript with reference directives', () => {
            const typescriptCode = `
/// <reference path="./types/global.d.ts" />
/// <reference types="node" />

// Regular comment
import { EventEmitter } from 'events';

/* TODO: Add proper type definitions */
interface CustomEvent {
    type: string;
    data: any; // @ts-ignore: legacy compatibility
}

class EventManager extends EventEmitter {
    // Regular method comment
    emit(event: CustomEvent): boolean {
        /* FIXME: Validate event structure */
        // @ts-expect-error: testing error handling
        return super.emit(event.type, event.data);
    }
}

// @ts-nocheck
function legacyFunction() {
    // This function has type issues
    return undefined;
}
            `.trim();

            const result = remover.removeComments(typescriptCode, 'events.ts');

            
            expect(result.content).toContain('/// <reference path="./types/global.d.ts" />');
            
            
            expect(result.content).toContain('// @ts-ignore: legacy compatibility');
            expect(result.content).toContain('// @ts-expect-error: testing error handling');
            expect(result.content).toContain('// @ts-nocheck');
            
            
            expect(result.content).toContain('/* TODO: Add proper type definitions */');
            expect(result.content).toContain('/* FIXME: Validate event structure */');
            
            
            expect(result.content).not.toContain('// Regular comment');
            expect(result.content).not.toContain('// Regular method comment');
            expect(result.content).not.toContain('// This function has type issues');
            
            expect(result.removed).toBe(3);
            expect(result.preserved).toBe(7);
        });
    });

    describe('Development keyword preservation (Requirement 3.1)', () => {
        it('should handle mixed development keywords in a large codebase', () => {
            const codebaseExample = `
class DataProcessor {
    // Regular comment about the class
    constructor(options) {
        // TODO: Validate options parameter
        this.options = options;
    }
    
    process(data) {
        /* FIXME: This method is too complex and needs refactoring */
        if (!data) {
            // HACK: Quick fix for null data - should be handled properly
            return null;
        }
        
        // NOTE: The following logic was added for backwards compatibility
        const processed = this.transform(data);
        
        /* XXX: This is a temporary workaround until we fix the API */
        if (processed.error) {
            // BUG: Error handling is incomplete
            console.error(processed.error);
        }
        
        // WARNING: This operation is expensive for large datasets
        return this.validate(processed);
    }
    
    transform(data) {
        // Regular implementation comment
        return { ...data, transformed: true };
    }
    
    validate(data) {
        /* Regular validation comment */
        // WARN: Validation rules are not comprehensive
        return data.transformed ? data : null;
    }
}
            `.trim();

            const result = remover.removeComments(codebaseExample, 'processor.js');

            
            expect(result.content).toContain('// TODO: Validate options parameter');
            expect(result.content).toContain('/* FIXME: This method is too complex and needs refactoring */');
            expect(result.content).toContain('// HACK: Quick fix for null data - should be handled properly');
            expect(result.content).toContain('// NOTE: The following logic was added for backwards compatibility');
            expect(result.content).toContain('/* XXX: This is a temporary workaround until we fix the API */');
            expect(result.content).toContain('// BUG: Error handling is incomplete');
            expect(result.content).toContain('// WARNING: This operation is expensive for large datasets');
            expect(result.content).toContain('// WARN: Validation rules are not comprehensive');
            
            
            expect(result.content).not.toContain('// Regular comment about the class');
            expect(result.content).not.toContain('// Regular implementation comment');
            expect(result.content).not.toContain('/* Regular validation comment */');
            
            expect(result.removed).toBe(3);
            expect(result.preserved).toBe(8);
        });

        it('should handle development keywords with different casing and contexts', () => {
            const mixedCaseCode = `
// todo: lowercase version
/* Todo: Title case version */
// TODO: Uppercase version
/* tOdO: Mixed case version */

// fixme: needs attention
/* FIXME: urgent fix required */

// hack: temporary solution
/* Hack: Quick workaround */

// note: important information
/* NOTE: Remember this */

// xxx: placeholder
/* XXX: Needs implementation */

// bug: known issue
/* BUG: Critical problem */

// warning: be careful
/* WARNING: Dangerous operation */
// warn: short form
/* WARN: Alert */

function example() {
    // Regular comment that should be removed
    const value = getValue();
    
    // TODO: Add error handling here
    return value;
}
            `.trim();

            const result = remover.removeComments(mixedCaseCode, 'mixed-case.js');

            
            expect(result.content).toContain('// todo: lowercase version');
            expect(result.content).toContain('/* Todo: Title case version */');
            expect(result.content).toContain('// TODO: Uppercase version');
            expect(result.content).toContain('/* tOdO: Mixed case version */');
            expect(result.content).toContain('// fixme: needs attention');
            expect(result.content).toContain('/* FIXME: urgent fix required */');
            expect(result.content).toContain('// hack: temporary solution');
            expect(result.content).toContain('/* Hack: Quick workaround */');
            expect(result.content).toContain('// note: important information');
            expect(result.content).toContain('/* NOTE: Remember this */');
            expect(result.content).toContain('// xxx: placeholder');
            expect(result.content).toContain('/* XXX: Needs implementation */');
            expect(result.content).toContain('// bug: known issue');
            expect(result.content).toContain('/* BUG: Critical problem */');
            expect(result.content).toContain('// warning: be careful');
            expect(result.content).toContain('/* WARNING: Dangerous operation */');
            expect(result.content).toContain('// warn: short form');
            expect(result.content).toContain('/* WARN: Alert */');
            expect(result.content).toContain('// TODO: Add error handling here');
            
            
            expect(result.content).not.toContain('// Regular comment that should be removed');
            
            expect(result.removed).toBe(1);
            expect(result.preserved).toBe(19);
        });
    });

    describe('Tooling directive preservation (Requirement 4.1)', () => {
        it('should handle a complete project with all tooling directives', () => {
            const projectCode = `
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('./config.json');

/* eslint-disable no-console, no-alert */
function debugLog(message) {
    console.log(message);
    alert(message);
}
/* eslint-enable no-console */

// prettier-ignore
const uglyObject = {a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:8,i:9,j:10};

/**
 * Calculate the factorial of a number
 * @param {number} n - The number to calculate factorial for
 * @returns {number} The factorial result
 * @example
 * const result = factorial(5); // returns 120
 * @since 1.0.0
 * @author John Doe
 */
function factorial(n) {
    // @ts-ignore: legacy code compatibility
    if (n <= 1) return 1;
    
    // @ts-expect-error: intentional type error for testing
    return n * factorial(n - 1);
}

/* istanbul ignore next */
if (process.env.NODE_ENV === 'test') {
    // c8 ignore start
    function testOnlyFunction() {
        console.log('Test mode');
    }
    // c8 ignore stop
}

// @ts-nocheck
function legacyCode() {
    // Regular comment in legacy code
    return 'legacy';
}

// Regular comment that should be removed
const result = factorial(5);
            `.trim();

            const result = remover.removeComments(projectCode, 'project.js');

            
            expect(result.content).toContain('// eslint-disable-next-line @typescript-eslint/no-var-requires');
            expect(result.content).toContain('/* eslint-disable no-console, no-alert */');
            expect(result.content).toContain('/* eslint-enable no-console */');
            
            
            expect(result.content).toContain('// prettier-ignore');
            
            
            expect(result.content).toContain('* @param {number} n - The number to calculate factorial for');
            expect(result.content).toContain('* @returns {number} The factorial result');
            expect(result.content).toContain('* @example');
            expect(result.content).toContain('* @since 1.0.0');
            expect(result.content).toContain('* @author John Doe');
            
            
            expect(result.content).toContain('// @ts-ignore: legacy code compatibility');
            expect(result.content).toContain('// @ts-expect-error: intentional type error for testing');
            expect(result.content).toContain('// @ts-nocheck');
            
            
            expect(result.content).toContain('/* istanbul ignore next */');
            expect(result.content).toContain('// c8 ignore start');
            expect(result.content).toContain('// c8 ignore stop');
            
            
            expect(result.content).not.toContain('// Regular comment in legacy code');
            expect(result.content).not.toContain('// Regular comment that should be removed');
            
            expect(result.removed).toBe(2);
            expect(result.preserved).toBeGreaterThan(10);
        });
    });

    describe('Complex nested contexts (Requirement 5.5)', () => {
        it('should handle deeply nested template literals with regex and comments', () => {
            const complexNestedCode = `
const buildComplexTemplate = (config) => {
    // Regular comment to remove
    const pattern = /\\/\\*[\\s\\S]*?\\*\\//g;
    
    return \`
        // This comment is inside a template literal
        const processor = {
            /* This block comment is also in the template */
            process: (code) => {
                const result = code.replace(\${JSON.stringify(pattern.source)}, '');
                
                // TODO: Add validation for the result
                return \`Processed: \${result.replace(/\\n/g, '\\\\n')}\`;
            },
            
            validate: (input) => {
                /* FIXME: Improve validation logic */
                const regex = /^[a-zA-Z0-9\\s]*$/;
                return regex.test(input);
            }
        };
        
        // Another comment in template
        return processor;
    \`;
};

/* Regular block comment outside template */
const usage = buildComplexTemplate({ strict: true });
            `.trim();

            const result = remover.removeComments(complexNestedCode, 'complex.js');

            
            expect(result.content).toContain('/\\/\\*[\\s\\S]*?\\*\\//g');
            
            
            expect(result.content).toContain('// This comment is inside a template literal');
            expect(result.content).toContain('/* This block comment is also in the template */');
            expect(result.content).toContain('// TODO: Add validation for the result');
            expect(result.content).toContain('/* FIXME: Improve validation logic */');
            expect(result.content).toContain('// Another comment in template');
            
            
            expect(result.content).toContain('/^[a-zA-Z0-9\\s]*$/');
            
            
            expect(result.content).not.toContain('// Regular comment to remove');
            expect(result.content).not.toContain('/* Regular block comment outside template */');
            
            expect(result.removed).toBe(2);
            expect(result.preserved).toBe(0); 
        });
    });
});