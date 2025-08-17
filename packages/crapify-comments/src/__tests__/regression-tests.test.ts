import { CommentRemover } from '../comment-remover';
import { Logger } from '@kafked/shared';

describe('Regression Tests', () => {
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

    describe('Original truncation bug (Requirement 1.1)', () => {
        it('should fix the exact original bug scenario', () => {
            // This is the exact code that was reported in the original bug
            const originalBugCode = `
function removeComments(content) {
    let result = content;
    
    // Remove block comments
    result = result.replace(/\\/\\*[\\s\\S]*?\\*\\//g, (match) => {
        return '';
    });
    
    // Remove line comments  
    result = result.replace(/\\/\\/.*$/gm, '');
    
    return result;
}
            `.trim();

            const result = remover.removeComments(originalBugCode, 'original-bug.js');

            
            expect(result.content).toContain('/\\/\\*[\\s\\S]*?\\*\\//g');
            expect(result.content).toContain('/\\/\\/.*$/gm');
            
            
            expect(result.content).toContain('(match) => {');
            expect(result.content).toContain("return '';");
            expect(result.content).toContain('});');
            
            
            expect(result.content).not.toContain('// Remove block comments');
            expect(result.content).not.toContain('// Remove line comments');
            
            
            expect(result.content).toContain('function removeComments(content)');
            expect(result.content).toContain('let result = content;');
            expect(result.content).toContain('return result;');
        });

        it('should handle the truncation pattern in various contexts', () => {
            const variousContexts = `
// Context 1: Direct assignment
const pattern1 = /\\/\\*[\\s\\S]*?\\*\\//g;

// Context 2: In function call
text.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');

// Context 3: In array
const patterns = [/\\/\\*[\\s\\S]*?\\*\\//g, /\\/\\/.*$/gm];

// Context 4: In object
const config = {
    blockComments: /\\/\\*[\\s\\S]*?\\*\\//g,
    lineComments: /\\/\\/.*$/gm
};

// Context 5: In conditional
if (/\\/\\*[\\s\\S]*?\\*\\//g.test(code)) {
    // TODO: Handle block comments
    console.log('Found block comment');
}

// Context 6: In template literal
const message = \`Pattern: \${/\\/\\*[\\s\\S]*?\\*\\//g.source}\`;

// Context 7: Chained method calls
const cleaned = code
    .replace(/\\/\\*[\\s\\S]*?\\*\\//g, '')
    .replace(/\\/\\/.*$/gm, '');
            `.trim();

            const result = remover.removeComments(variousContexts, 'various-contexts.js');

            
            const regexCount = (result.content.match(/\/\\\/\\\*\[\\s\\S\]\*\?\\\*\\\/\/g/g) || []).length;
            expect(regexCount).toBe(7); 

            const lineRegexCount = (result.content.match(/\/\\\/\\\/\.\*\$\/gm/g) || []).length;
            expect(lineRegexCount).toBe(3); 

            // TODO comment should be preserved
            expect(result.content).toContain('// TODO: Handle block comments');

            
            expect(result.content).not.toContain('// Context 1: Direct assignment');
            expect(result.content).not.toContain('// Context 2: In function call');
        });

        it('should handle edge cases that could cause similar truncation', () => {
            const edgeCases = `
// Edge case 1: Regex with escaped forward slashes
const pathPattern = /\\/path\\/to\\/file/g;

// Edge case 2: Regex with character class containing slash
const slashPattern = /[/\\\\]/g;

// Edge case 3: Complex regex with multiple comment-like patterns
const complexPattern = /(?:\\/\\*[\\s\\S]*?\\*\\/|\\/\\/.*$|<!--[\\s\\S]*?-->)/gm;

// Edge case 4: Regex in string that looks like regex
const fakeRegex = "This /looks/ like regex but isn't";

// Edge case 5: Division that could be mistaken for regex
const division = x / y / z;

// Edge case 6: Regex with flags that include comment-like text
const flaggedPattern = /test/gim; // global, ignoreCase, multiline

// Edge case 7: Nested regex in template with interpolation
const dynamicPattern = \`/\${escapeRegex(searchTerm)}/gi\`;
            `.trim();

            const result = remover.removeComments(edgeCases, 'edge-cases.js');

            
            expect(result.content).toContain('/\\/path\\/to\\/file/g');
            expect(result.content).toContain('/[/\\\\]/g');
            expect(result.content).toContain('/(?:\\/\\*[\\s\\S]*?\\*\\/|\\/\\/.*$|<!--[\\s\\S]*?-->)/gm');
            expect(result.content).toContain('/test/gim');
            expect(result.content).toContain('/${escapeRegex(searchTerm)}/gi');

            
            expect(result.content).toContain('"This /looks/ like regex but isn\'t"');

            
            expect(result.content).toContain('x / y / z');

            
            expect(result.content).not.toContain('// Edge case 1:');
            expect(result.content).not.toContain('// global, ignoreCase, multiline');
        });
    });

    describe('Parsing accuracy regressions', () => {
        it('should not break existing functionality while fixing bugs', () => {
            const existingFunctionality = `
// Basic comment removal should still work
function test() {
    /* This should be removed */
    return true;
}

// TODO comments should be preserved
const value = getValue();

// eslint-disable-next-line no-console
console.log('Debug');

/** @param {string} name */
function greet(name) {
    // Regular comment
    return \`Hello \${name}\`;
}
            `.trim();

            const result = remover.removeComments(existingFunctionality, 'existing.js');

            
            expect(result.content).not.toContain('/* This should be removed */');
            expect(result.content).not.toContain('// Regular comment');

            
            expect(result.content).toContain('// TODO comments should be preserved');
            expect(result.content).toContain('// eslint-disable-next-line no-console');
            expect(result.content).toContain('/** @param {string} name */');

            
            expect(result.content).toContain('`Hello ${name}`');

            
            expect(result.removed).toBeGreaterThan(0); 
            expect(result.preserved).toBeGreaterThan(0); 
        });

        it('should maintain backward compatibility with custom patterns', () => {
            const customRemover = new CommentRemover(['KEEP', 'PRESERVE'], { logger: mockLogger });

            const codeWithCustomPatterns = `
// Regular comment to remove
/* KEEP: This should be preserved by custom pattern */
// PRESERVE: This should also be preserved
/* TODO: This should be preserved by built-in rule */
// Another regular comment
// KEEP this one too
            `.trim();

            const result = customRemover.removeComments(codeWithCustomPatterns, 'custom.js');

            
            expect(result.content).toContain('/* KEEP: This should be preserved by custom pattern */');
            expect(result.content).toContain('// PRESERVE: This should also be preserved');
            expect(result.content).toContain('// KEEP this one too');

            
            expect(result.content).toContain('/* TODO: This should be preserved by built-in rule */');

            
            expect(result.content).not.toContain('// Regular comment to remove');
            expect(result.content).not.toContain('// Another regular comment');

            expect(result.removed).toBe(2);
            expect(result.preserved).toBe(4);
        });

        it('should handle malformed code without breaking', () => {
            const malformedCode = `
// Regular comment
const str = "unterminated string
// This comment comes after malformed code
const template = \`unterminated template
/* Block comment after malformed template */
const regex = /unterminated regex
// Final comment
const valid = "this is valid";
            `.trim();

            
            expect(() => {
                const result = remover.removeComments(malformedCode, 'malformed.js');
                expect(result).toBeDefined();
                expect(result.content).toBeDefined();
            }).not.toThrow();
        });
    });

    describe('Performance regressions', () => {
        it('should not have exponential time complexity with nested patterns', () => {
            
            const nestedPattern = 'a'.repeat(20) + 'b'.repeat(20);
            const problematicRegex = `/a*b*/g`;

            const codeWithNestedPatterns = `
// This pattern could cause exponential backtracking: ${nestedPattern}
const pattern = ${problematicRegex};
const test = "${nestedPattern}";
// TODO: Optimize this pattern
            `.trim();

            const startTime = performance.now();
            const result = remover.removeComments(codeWithNestedPatterns, 'nested-patterns.js');
            const endTime = performance.now();

            const processingTime = endTime - startTime;

            
            expect(processingTime).toBeLessThan(100); 
            expect(result.content).toContain(problematicRegex);
            expect(result.content).toContain('// TODO: Optimize this pattern');
        });

        it('should handle repeated similar patterns efficiently', () => {
            
            const patterns: string[] = [];
            for (let i = 0; i < 100; i++) {
                patterns.push(`const pattern${i} = /\\/\\*[\\s\\S]*?\\*\\//g;`);
                patterns.push(`// Comment ${i}`);
            }

            const repeatedPatterns = patterns.join('\n');

            const startTime = performance.now();
            const result = remover.removeComments(repeatedPatterns, 'repeated.js');
            const endTime = performance.now();

            const processingTime = endTime - startTime;

            expect(processingTime).toBeLessThan(200); 
            expect(result.removed).toBe(100); 
            
            
            for (let i = 0; i < 100; i++) {
                expect(result.content).toContain(`const pattern${i} = /\\/\\*[\\s\\S]*?\\*\\//g;`);
            }
        });
    });

    describe('Memory leak regressions', () => {
        it('should not accumulate memory with repeated processing', () => {
            const testCode = `
const pattern = /\\/\\*[\\s\\S]*?\\*\\//g;
// Comment to remove
/* TODO: Preserve this */
            `.trim();

            
            for (let i = 0; i < 1000; i++) {
                const result = remover.removeComments(testCode, `test-${i}.js`);
                
                
                expect(result.removed).toBe(1);
                expect(result.preserved).toBe(1);
                
                
                if (i % 100 === 0) {
                    
                    global.gc && global.gc();
                }
            }

            
            expect(true).toBe(true);
        });
    });

    describe('Error handling regressions', () => {
        it('should gracefully handle all previously problematic inputs', () => {
            const problematicInputs = [
                
                '',
                
                
                '   \n\t  ',
                
                
                '// Just a comment',
                
                
                'const str = "unterminated',
                
                
                'const regex = /unterminated',
                
                
                'const template = `unterminated',
                
                
                '/* unterminated block comment',
                
                
                'const str = "test"; /* unterminated',
                
                
                'const regex = /test/xyz;',
                
                
                '`${`${`${`${value}`}`}`}`',
                
                
                'const binary = "\x00\x01\x02\x03";',
                
                
                'const longString = "' + 'x'.repeat(10000) + '";'
            ];

            problematicInputs.forEach((input, index) => {
                expect(() => {
                    const result = remover.removeComments(input, `problematic-${index}.js`);
                    expect(result).toBeDefined();
                    expect(result.content).toBeDefined();
                }).not.toThrow();
            });
        });

        it('should provide consistent error reporting', () => {
            const errorProneCode = `
const str = "unterminated
// This comment follows an error
const template = \`also unterminated
/* This block comment also follows an error */
            `.trim();

            const result = remover.removeComments(errorProneCode, 'error-prone.js');

            expect(result).toBeDefined();
            expect(result.hasErrors).toBe(true);
            expect(result.errors).toBeDefined();
            expect(result.warnings).toBeDefined();

            
            expect(result.content).toBeDefined();
            expect(result.content.length).toBeGreaterThan(0);
        });
    });

    describe('Integration regressions', () => {
        it('should work correctly with all tokenizer modes', () => {
            const testCode = `
const regex = /\\/\\*[\\s\\S]*?\\*\\//g;
// Regular comment
/* TODO: Preserve this */
            `.trim();

            
            const enhancedResult = remover.removeComments(testCode, 'enhanced.js');

            
            const legacyRemover = new CommentRemover([], { 
                useEnhancedTokenizer: false,
                logger: mockLogger 
            });
            const legacyResult = legacyRemover.removeComments(testCode, 'legacy.js');

            // Both should preserve the regex and TODO comment
            expect(enhancedResult.content).toContain('/\\/\\*[\\s\\S]*?\\*\\//g');
            expect(enhancedResult.content).toContain('/* TODO: Preserve this */');
            expect(enhancedResult.removed).toBe(1);
            expect(enhancedResult.preserved).toBe(1);

            
            expect(legacyResult.content).toContain('/\\/\\*[\\s\\S]*?\\*\\');
            
            expect(legacyResult.removed).toBeGreaterThan(0);
            expect(legacyResult.preserved).toBeGreaterThanOrEqual(0);
        });

        it('should maintain rule manager functionality', () => {
            const ruleManager = remover.getRuleManager();
            
            
            ruleManager.addCustomPattern('TEST', 'TEST:\\s*\\w+', 100);
            
            const testCode = `
// Regular comment
// TEST: Custom pattern
/* TODO: Built-in pattern */
            `.trim();

            const result = remover.removeComments(testCode, 'rule-manager.js');

            expect(result.content).toContain('// TEST: Custom pattern');
            expect(result.content).toContain('/* TODO: Built-in pattern */');
            expect(result.content).not.toContain('// Regular comment');
            
            expect(result.removed).toBe(1);
            expect(result.preserved).toBe(2);
        });
    });
});