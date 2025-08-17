import { CommentRemover } from '../comment-remover';
import { Logger } from '@kafked/shared';

describe('Performance Tests', () => {
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

    describe('Large file processing performance', () => {
        it('should process large files efficiently (under 1 second for 10MB)', () => {
            
            const lines: string[] = [];
            const targetSize = 10 * 1024 * 1024; 
            let currentSize = 0;
            let lineCount = 0;

            while (currentSize < targetSize) {
                const line = `const variable${lineCount} = "This is a test string with some content ${lineCount}"; // Comment ${lineCount}`;
                lines.push(line);
                currentSize += line.length + 1; 
                lineCount++;
            }

            const largeCode = lines.join('\n');
            console.log(`Generated ${(largeCode.length / 1024 / 1024).toFixed(2)}MB file with ${lineCount} lines`);

            const startTime = performance.now();
            const result = remover.removeComments(largeCode, 'large-file.js');
            const endTime = performance.now();

            const processingTime = endTime - startTime;
            console.log(`Processing time: ${processingTime.toFixed(2)}ms`);

            expect(processingTime).toBeLessThan(1000); 
            expect(result.removed).toBe(lineCount); 
            expect(result.content.length).toBeLessThan(largeCode.length); 
        }, 10000); 

        it('should handle large files with complex patterns efficiently', () => {
            
            const complexPatterns: string[] = [];
            const iterations = 1000;

            for (let i = 0; i < iterations; i++) {
                complexPatterns.push(`
// Regular comment ${i}
const regex${i} = /\\/\\*[\\s\\S]*?\\*\\//g;
const template${i} = \`Template with \${value${i}} and // fake comment\`;
/* TODO: Optimize this section ${i} */
const string${i} = "String with /* fake block comment */ content";
// FIXME: This needs attention ${i}
const nestedTemplate${i} = \`Outer \${inner\`Inner \${deep}\`} template\`;
/* Regular block comment ${i} */
const complexRegex${i} = /(?:\\/\\*[\\s\\S]*?\\*\\/|\\/\\/.*$)/gm;
                `.trim());
            }

            const complexCode = complexPatterns.join('\n\n');
            console.log(`Generated complex file: ${(complexCode.length / 1024).toFixed(2)}KB`);

            const startTime = performance.now();
            const result = remover.removeComments(complexCode, 'complex-file.js');
            const endTime = performance.now();

            const processingTime = endTime - startTime;
            console.log(`Complex processing time: ${processingTime.toFixed(2)}ms`);

            expect(processingTime).toBeLessThan(2000); 
            expect(result.removed).toBeGreaterThan(0); 
            expect(result.preserved).toBeGreaterThan(0); 
            
            
            expect(result.content).toContain('/\\/\\*[\\s\\S]*?\\*\\//g');
            expect(result.content).toContain('/(?:\\/\\*[\\s\\S]*?\\*\\/|\\/\\/.*$)/gm');
        }, 15000); 

        it('should maintain consistent performance across multiple runs', () => {
            
            const lines: string[] = [];
            for (let i = 0; i < 5000; i++) {
                lines.push(`const var${i} = getValue(${i}); // Comment ${i}`);
                lines.push(`/* Block comment ${i} */`);
                lines.push(`const regex${i} = /pattern${i}/g;`);
            }
            const testCode = lines.join('\n');

            const times: number[] = [];
            const runs = 5;

            for (let run = 0; run < runs; run++) {
                const startTime = performance.now();
                const result = remover.removeComments(testCode, `test-run-${run}.js`);
                const endTime = performance.now();

                times.push(endTime - startTime);
                
                
                expect(result.removed).toBe(10000); 
                expect(result.preserved).toBe(0);
            }

            const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
            const maxTime = Math.max(...times);
            const minTime = Math.min(...times);
            const variance = maxTime - minTime;

            console.log(`Performance consistency: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms, variance=${variance.toFixed(2)}ms`);

            
            expect(variance).toBeLessThan(avgTime * 0.5);
            expect(avgTime).toBeLessThan(500); 
        }, 20000); 
    });

    describe('Memory usage optimization', () => {
        it('should not cause memory leaks with repeated processing', () => {
            const testCode = `
const example = "test";
// Comment to remove
/* TODO: Preserve this */
const regex = /pattern/g;
            `.trim();

            
            const iterations = 1000;
            const results: any[] = [];

            for (let i = 0; i < iterations; i++) {
                const result = remover.removeComments(testCode, `iteration-${i}.js`);
                
                
                if (i % 100 === 0) {
                    results.push(result);
                }
            }

            
            results.forEach(result => {
                expect(result.removed).toBe(1);
                expect(result.preserved).toBe(1);
                expect(result.content).toContain('/* TODO: Preserve this */');
                expect(result.content).toContain('/pattern/g');
                expect(result.content).not.toContain('// Comment to remove');
            });

            
            expect(results.length).toBeGreaterThan(0);
        });

        it('should handle streaming-like processing of multiple files', () => {
            const fileContents: string[] = [];
            
            
            for (let fileIndex = 0; fileIndex < 100; fileIndex++) {
                const lines: string[] = [];
                for (let lineIndex = 0; lineIndex < 100; lineIndex++) {
                    lines.push(`const var${lineIndex} = "file${fileIndex}_line${lineIndex}"; // Comment ${lineIndex}`);
                }
                fileContents.push(lines.join('\n'));
            }

            const startTime = performance.now();
            const results: any[] = [];

            
            fileContents.forEach((content, index) => {
                const result = remover.removeComments(content, `file-${index}.js`);
                results.push({
                    fileIndex: index,
                    removed: result.removed,
                    preserved: result.preserved
                });
            });

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            console.log(`Processed ${fileContents.length} files in ${totalTime.toFixed(2)}ms`);
            console.log(`Average time per file: ${(totalTime / fileContents.length).toFixed(2)}ms`);

            
            expect(results.length).toBe(100);
            results.forEach(result => {
                expect(result.removed).toBe(100); 
                expect(result.preserved).toBe(0);
            });

            
            expect(totalTime).toBeLessThan(5000); 
        });
    });

    describe('Scalability with complex patterns', () => {
        it('should scale well with increasing number of preservation rules', () => {
            
            const customPatterns = [];
            for (let i = 0; i < 50; i++) {
                customPatterns.push(`CUSTOM${i}`);
            }
            
            const heavyRemover = new CommentRemover(customPatterns, { logger: mockLogger });

            const testCode = `
// Regular comment
/* TODO: Preserve this */
// CUSTOM25: This should be preserved
/* FIXME: Another preserved comment */
// CUSTOM42: Another custom pattern
const regex = /complex\\/pattern\\/with\\/slashes/g;
// eslint-disable-next-line no-console
console.log("test");
            `.trim();

            const startTime = performance.now();
            const result = heavyRemover.removeComments(testCode, 'heavy-rules.js');
            const endTime = performance.now();

            const processingTime = endTime - startTime;
            console.log(`Processing with ${customPatterns.length} custom rules: ${processingTime.toFixed(2)}ms`);

            
            expect(processingTime).toBeLessThan(100); 
            
            
            expect(result.content).toContain('/* TODO: Preserve this */');
            expect(result.content).toContain('// CUSTOM25: This should be preserved');
            expect(result.content).toContain('/* FIXME: Another preserved comment */');
            expect(result.content).toContain('// CUSTOM42: Another custom pattern');
            expect(result.content).toContain('// eslint-disable-next-line no-console');
            expect(result.content).not.toContain('// Regular comment');
            
            expect(result.removed).toBe(1);
            expect(result.preserved).toBe(5);
        });

        it('should handle files with many different comment types efficiently', () => {
            
            const commentTypes: string[] = [];
            
            
            for (let i = 0; i < 20; i++) {
                commentTypes.push(`<!-- svelte-ignore rule${i} -->`);
                commentTypes.push(`/* webpackChunkName: "chunk${i}" */`);
                commentTypes.push(`/// <reference path="./types${i}.d.ts" />`);
            }
            
            
            const keywords = ['TODO', 'FIXME', 'HACK', 'NOTE', 'XXX', 'BUG', 'WARNING'];
            for (let i = 0; i < 30; i++) {
                const keyword = keywords[i % keywords.length];
                commentTypes.push(`// ${keyword}: Task ${i}`);
                commentTypes.push(`/* ${keyword}: Block task ${i} */`);
            }
            
            
            for (let i = 0; i < 25; i++) {
                commentTypes.push(`// eslint-disable-next-line rule${i}`);
                commentTypes.push(`/* @ts-ignore: reason ${i} */`);
                commentTypes.push(`/** @param {string} param${i} */`);
            }
            
            
            for (let i = 0; i < 50; i++) {
                commentTypes.push(`// Regular comment ${i}`);
                commentTypes.push(`/* Regular block comment ${i} */`);
            }

            const mixedCode = commentTypes.join('\n') + '\n\nconst code = "actual code";';

            const startTime = performance.now();
            const result = remover.removeComments(mixedCode, 'mixed-comments.js');
            const endTime = performance.now();

            const processingTime = endTime - startTime;
            console.log(`Processing ${commentTypes.length} mixed comments: ${processingTime.toFixed(2)}ms`);

            expect(processingTime).toBeLessThan(200); 
            expect(result.removed).toBe(100); 
            expect(result.preserved).toBeGreaterThan(100); 
        });
    });

    describe('Regression performance tests', () => {
        it('should not regress on the original truncation bug scenario', () => {
            
            const problematicPattern = '/\\/\\*[\\s\\S]*?\\*\\//g';
            
            
            const lines: string[] = [];
            for (let i = 0; i < 1000; i++) {
                lines.push(`result = result.replace(${problematicPattern}, (match) => {`);
                lines.push(`    // Comment ${i}`);
                lines.push(`    return '';`);
                lines.push(`});`);
            }
            
            const regressionCode = lines.join('\n');

            const startTime = performance.now();
            const result = remover.removeComments(regressionCode, 'regression.js');
            const endTime = performance.now();

            const processingTime = endTime - startTime;
            console.log(`Regression test processing time: ${processingTime.toFixed(2)}ms`);

            
            expect(processingTime).toBeLessThan(1000); 
            
            
            expect(result.content.split(problematicPattern).length - 1).toBe(1000);
            
            
            expect(result.removed).toBe(1000);
            expect(result.preserved).toBe(0);
        });

        it('should maintain performance with nested contexts', () => {
            
            const nestedLevels = 10;
            let nestedTemplate = 'value';
            
            for (let level = 0; level < nestedLevels; level++) {
                nestedTemplate = `\`Level ${level}: \${${nestedTemplate}}\``;
            }
            
            
            const lines: string[] = [];
            for (let i = 0; i < 100; i++) {
                lines.push(`const template${i} = ${nestedTemplate};`);
                lines.push(`// Comment ${i}`);
            }
            
            const nestedCode = lines.join('\n');

            const startTime = performance.now();
            const result = remover.removeComments(nestedCode, 'nested.js');
            const endTime = performance.now();

            const processingTime = endTime - startTime;
            console.log(`Nested contexts processing time: ${processingTime.toFixed(2)}ms`);

            expect(processingTime).toBeLessThan(500); 
            expect(result.removed).toBe(100); 
            
            
            for (let level = 0; level < nestedLevels; level++) {
                expect(result.content).toContain(`Level ${level}:`);
            }
        });
    });
});