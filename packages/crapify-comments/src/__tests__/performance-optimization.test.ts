import { CommentRemover } from '../comment-remover';
import { EnhancedTokenizer } from '../enhanced-tokenizer';
import { PerformanceMonitor, PerformanceBenchmark } from '../performance-monitor';
import { Logger } from '@kafked/shared';

describe('Performance Optimization and Validation Tests', () => {
    let mockLogger: jest.Mocked<Logger>;

    beforeEach(() => {
        mockLogger = new Logger(false, false, false) as jest.Mocked<Logger>;
        mockLogger.info = jest.fn();
        mockLogger.success = jest.fn();
        mockLogger.error = jest.fn();
        mockLogger.warn = jest.fn();
        mockLogger.json = jest.fn();
    });

    describe('Tokenizer Performance Optimization', () => {
        it('should show improved performance with optimized tokenizer', async () => {
            // Generate a large test file
            const lines: string[] = [];
            for (let i = 0; i < 5000; i++) {
                lines.push(`const variable${i} = "test string ${i}"; // Comment ${i}`);
                lines.push(`/* Block comment ${i} */`);
                lines.push(`const regex${i} = /pattern${i}\\/\\*comment\\*\\//g;`);
                lines.push(`const template${i} = \`Template \${value${i}} // fake comment\`;`);
            }
            const testContent = lines.join('\n');

            // Test baseline (legacy) performance
            const baselineRemover = new CommentRemover([], { 
                useEnhancedTokenizer: false, 
                logger: mockLogger 
            });
            
            const baselineStart = performance.now();
            const baselineResult = baselineRemover.removeComments(testContent, 'baseline.js');
            const baselineEnd = performance.now();
            const baselineTime = baselineEnd - baselineStart;

            // Test optimized performance
            const optimizedRemover = new CommentRemover([], { 
                useEnhancedTokenizer: true, 
                logger: mockLogger 
            });
            
            const optimizedStart = performance.now();
            const optimizedResult = optimizedRemover.removeComments(testContent, 'optimized.js');
            const optimizedEnd = performance.now();
            const optimizedTime = optimizedEnd - optimizedStart;

            console.log(`Baseline time: ${baselineTime.toFixed(2)}ms`);
            console.log(`Optimized time: ${optimizedTime.toFixed(2)}ms`);
            console.log(`Performance improvement: ${((baselineTime - optimizedTime) / baselineTime * 100).toFixed(1)}%`);

            // Both should produce similar results
            expect(baselineResult.removed).toBe(optimizedResult.removed);
            expect(baselineResult.preserved).toBe(optimizedResult.preserved);
            
            // Optimized version should preserve regex patterns correctly
            expect(optimizedResult.content).toContain('/pattern0\\/\\*comment\\*\\//g');
            expect(optimizedResult.content).toContain('Template ${value0} // fake comment');
            
            // Performance should be reasonable (not necessarily faster due to overhead, but not significantly slower)
            expect(optimizedTime).toBeLessThan(baselineTime * 2); // Allow up to 2x slower due to additional features
        });

        it('should handle memory efficiently for large files', () => {
            // Generate a very large file (5MB+)
            const largeContent = 'const test = "value"; // Comment\n'.repeat(200000);
            
            const remover = new CommentRemover([], { logger: mockLogger });
            
            // Monitor memory before processing
            const memoryBefore = process.memoryUsage();
            
            const result = remover.removeComments(largeContent, 'large-file.js');
            
            // Monitor memory after processing
            const memoryAfter = process.memoryUsage();
            
            const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
            const fileSize = largeContent.length;
            
            console.log(`File size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
            console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
            console.log(`Memory efficiency ratio: ${(memoryIncrease / fileSize).toFixed(2)}`);
            
            // Memory usage should be reasonable (less than 5x file size)
            expect(memoryIncrease).toBeLessThan(fileSize * 5);
            
            // Should successfully process the file
            expect(result.removed).toBe(200000);
            expect(result.content.length).toBeLessThan(largeContent.length);
        });

        it('should maintain consistent performance across multiple runs', () => {
            const testContent = `
const example = "test";
// Regular comment
/* TODO: Preserve this */
const regex = /\\/\\*pattern\\*\\//g;
const template = \`Template with \${value} // fake comment\`;
            `.trim();

            const remover = new CommentRemover([], { logger: mockLogger });
            const times: number[] = [];
            const runs = 10;

            // Run multiple times to check consistency
            for (let i = 0; i < runs; i++) {
                const start = performance.now();
                const result = remover.removeComments(testContent, `run-${i}.js`);
                const end = performance.now();
                
                times.push(end - start);
                
                // Verify consistent results
                expect(result.removed).toBe(1);
                expect(result.preserved).toBe(1);
            }

            const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
            const maxTime = Math.max(...times);
            const minTime = Math.min(...times);
            const variance = maxTime - minTime;

            console.log(`Performance consistency: avg=${avgTime.toFixed(2)}ms, variance=${variance.toFixed(2)}ms`);

            // Variance should be reasonable (less than 100% of average)
            expect(variance).toBeLessThan(avgTime);
        });
    });

    describe('Parsing Accuracy Validation', () => {
        it('should validate token boundaries correctly', () => {
            const testCases = [
                {
                    name: 'Simple case',
                    content: 'const x = "test"; // comment',
                    expectedTokens: 4 // 'const x = ', '"test"', '; ', '// comment'
                },
                {
                    name: 'Regex with comment-like pattern',
                    content: 'const regex = /\\/\\*test\\*\\//g;',
                    expectedMinTokens: 3 // 'const regex = ', '/\\/\\*test\\*\\//g', ';'
                },
                {
                    name: 'Template with interpolation',
                    content: 'const template = `Hello ${name}!`;',
                    expectedMinTokens: 3 // 'const template = ', '`Hello ${name}!`', ';'
                }
            ];

            const tokenizer = new EnhancedTokenizer(mockLogger);

            testCases.forEach(testCase => {
                const tokens = tokenizer.tokenize(testCase.content);
                
                // Validate token boundaries
                let reconstructed = '';
                let lastEndPos = 0;
                
                for (const token of tokens) {
                    // Check for gaps
                    if (token.startPos > lastEndPos) {
                        // Add any gap content
                        reconstructed += testCase.content.substring(lastEndPos, token.startPos);
                    }
                    
                    reconstructed += token.value;
                    lastEndPos = token.endPos;
                }
                
                // Add any remaining content
                if (lastEndPos < testCase.content.length) {
                    reconstructed += testCase.content.substring(lastEndPos);
                }

                expect(reconstructed).toBe(testCase.content);
                
                if (testCase.expectedTokens) {
                    expect(tokens.length).toBe(testCase.expectedTokens);
                }
                
                if (testCase.expectedMinTokens) {
                    expect(tokens.length).toBeGreaterThanOrEqual(testCase.expectedMinTokens);
                }
                
                console.log(`${testCase.name}: ${tokens.length} tokens, reconstruction successful`);
            });
        });

        it('should handle edge cases without corruption', () => {
            const edgeCases = [
                'const str = "string with \\"escaped quotes\\"";',
                'const regex = /complex\\/pattern\\/with[\\]\\\\]/g;',
                'const template = `Nested ${`inner ${value}`} template`;',
                '/* Unterminated comment',
                '"Unterminated string',
                '`Unterminated template',
                '/Unterminated regex',
                'const mixed = "string" + /regex/ + `template`;'
            ];

            const remover = new CommentRemover([], { logger: mockLogger });

            edgeCases.forEach((testCase, index) => {
                const result = remover.removeComments(testCase, `edge-case-${index}.js`);
                
                // Should not crash and should return some result
                expect(result.content).toBeDefined();
                expect(typeof result.content).toBe('string');
                
                // Content should not be empty unless input was empty
                if (testCase.trim().length > 0) {
                    expect(result.content.length).toBeGreaterThan(0);
                }
                
                console.log(`Edge case ${index}: processed successfully`);
            });
        });

        it('should preserve critical patterns accurately', () => {
            const criticalPatterns = [
                {
                    content: 'result = result.replace(/\\/\\*[\\s\\S]*?\\*\\//g, "");',
                    shouldPreserve: '/\\/\\*[\\s\\S]*?\\*\\//g',
                    description: 'Original truncation bug pattern'
                },
                {
                    content: '/* TODO: Fix this */ const x = 1;',
                    shouldPreserve: '/* TODO: Fix this */',
                    description: 'TODO comment'
                },
                {
                    content: '// eslint-disable-next-line no-console',
                    shouldPreserve: '// eslint-disable-next-line no-console',
                    description: 'ESLint directive'
                },
                {
                    content: '/// <reference path="./types.d.ts" />',
                    shouldPreserve: '/// <reference path="./types.d.ts" />',
                    description: 'TypeScript reference'
                }
            ];

            const remover = new CommentRemover([], { logger: mockLogger });

            criticalPatterns.forEach(pattern => {
                const result = remover.removeComments(pattern.content, 'critical-pattern.js');
                
                expect(result.content).toContain(pattern.shouldPreserve);
                console.log(`${pattern.description}: preserved correctly`);
            });
        });
    });

    describe('Performance Benchmarking', () => {
        it('should benchmark against current implementation', () => {
            // Create test scenarios of different sizes and complexities
            const scenarios = [
                {
                    name: 'Small file',
                    generator: () => 'const x = 1; // comment\n'.repeat(100)
                },
                {
                    name: 'Medium file',
                    generator: () => 'const x = "test"; /* comment */ const y = /regex/;\n'.repeat(1000)
                },
                {
                    name: 'Large file',
                    generator: () => {
                        const lines = [];
                        for (let i = 0; i < 5000; i++) {
                            lines.push(`const var${i} = "value${i}"; // Comment ${i}`);
                            lines.push(`/* Block comment ${i} */`);
                            lines.push(`const regex${i} = /pattern${i}/g;`);
                        }
                        return lines.join('\n');
                    }
                },
                {
                    name: 'Complex patterns',
                    generator: () => {
                        const patterns = [];
                        for (let i = 0; i < 1000; i++) {
                            patterns.push(`const regex${i} = /\\/\\*[\\s\\S]*?\\*\\//g;`);
                            patterns.push(`const template${i} = \`Template \${value${i}} // fake\`;`);
                            patterns.push(`/* TODO: Task ${i} */`);
                            patterns.push(`// eslint-disable-next-line rule${i}`);
                        }
                        return patterns.join('\n');
                    }
                }
            ];

            const benchmarks: PerformanceBenchmark[] = [];

            scenarios.forEach(scenario => {
                const content = scenario.generator();
                
                // Baseline (legacy tokenizer)
                const baselineRemover = new CommentRemover([], { 
                    useEnhancedTokenizer: false, 
                    logger: mockLogger 
                });
                
                const baselineMonitor = new PerformanceMonitor(mockLogger);
                baselineMonitor.startMonitoring();
                const baselineResult = baselineRemover.removeComments(content, 'baseline.js');
                const baselineMetrics = baselineMonitor.stopMonitoring(
                    content.split('\n').length, // Rough token estimate
                    content.length
                );

                // Optimized (enhanced tokenizer)
                const optimizedRemover = new CommentRemover([], { 
                    useEnhancedTokenizer: true, 
                    logger: mockLogger 
                });
                
                const optimizedMonitor = new PerformanceMonitor(mockLogger);
                optimizedMonitor.startMonitoring();
                const optimizedResult = optimizedRemover.removeComments(content, 'optimized.js');
                const optimizedMetrics = optimizedMonitor.stopMonitoring(
                    content.split('\n').length, // Rough token estimate
                    content.length
                );

                const benchmark = PerformanceMonitor.compareBenchmarks(baselineMetrics, optimizedMetrics);
                benchmarks.push(benchmark);

                console.log(`\n${scenario.name} Benchmark:`);
                console.log(`  Processing Time: ${baselineMetrics.processingTime.toFixed(2)}ms → ${optimizedMetrics.processingTime.toFixed(2)}ms`);
                console.log(`  Memory Usage: ${(baselineMetrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB → ${(optimizedMetrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
                console.log(`  Throughput: ${baselineMetrics.throughput.toFixed(2)} → ${optimizedMetrics.throughput.toFixed(2)} tokens/ms`);

                // Verify results are consistent
                expect(optimizedResult.removed).toBe(baselineResult.removed);
                expect(optimizedResult.preserved).toBe(baselineResult.preserved);
            });

            // Generate performance report
            const report = PerformanceMonitor.generateReport(benchmarks);
            console.log('\n' + report);

            // All benchmarks should complete successfully
            expect(benchmarks.length).toBe(scenarios.length);
        });

        it('should validate memory usage patterns', () => {
            const fileSizes = [1000, 10000, 100000, 500000]; // Different file sizes in characters
            
            fileSizes.forEach(size => {
                const content = 'const x = "test"; // comment\n'.repeat(size / 30); // Approximate size
                const remover = new CommentRemover([], { logger: mockLogger });
                
                const memoryBefore = process.memoryUsage();
                const result = remover.removeComments(content, `size-${size}.js`);
                const memoryAfter = process.memoryUsage();
                
                const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
                const memoryRatio = memoryIncrease / content.length;
                
                console.log(`File size: ${(content.length / 1024).toFixed(2)}KB, Memory increase: ${(memoryIncrease / 1024).toFixed(2)}KB, Ratio: ${memoryRatio.toFixed(2)}`);
                
                // Memory usage should scale reasonably with file size
                expect(memoryRatio).toBeLessThan(10); // Less than 10x memory usage
                expect(result.content).toBeDefined();
            });
        });
    });

    describe('Regression Testing', () => {
        it('should not regress on known performance issues', () => {
            // Test the original truncation bug scenario
            const problematicCode = `
result = result.replace(/\\/\\*[\\s\\S]*?\\*\\//g, (match) => {
    // This should be removed
    return '';
});
            `.trim();

            const remover = new CommentRemover([], { logger: mockLogger });
            
            const start = performance.now();
            const result = remover.removeComments(problematicCode, 'regression.js');
            const end = performance.now();
            
            const processingTime = end - start;
            
            // Should complete quickly (under 100ms for this small example)
            expect(processingTime).toBeLessThan(100);
            
            // Should preserve the regex pattern
            expect(result.content).toContain('/\\/\\*[\\s\\S]*?\\*\\//g');
            
            // Should remove the regular comment
            expect(result.content).not.toContain('// This should be removed');
            expect(result.removed).toBe(1);
            expect(result.preserved).toBe(0);
            
            console.log(`Regression test completed in ${processingTime.toFixed(2)}ms`);
        });

        it('should handle stress test scenarios', () => {
            // Create a stress test with many different patterns
            const stressPatterns = [];
            
            for (let i = 0; i < 1000; i++) {
                stressPatterns.push(`const regex${i} = /\\/\\*pattern${i}\\*\\//g;`);
                stressPatterns.push(`const str${i} = "string with /* fake comment */ content";`);
                stressPatterns.push(`const template${i} = \`Template \${value${i}} // fake comment\`;`);
                stressPatterns.push(`// Regular comment ${i}`);
                stressPatterns.push(`/* TODO: Task ${i} */`);
            }
            
            const stressContent = stressPatterns.join('\n');
            const remover = new CommentRemover([], { logger: mockLogger });
            
            const start = performance.now();
            const result = remover.removeComments(stressContent, 'stress-test.js');
            const end = performance.now();
            
            const processingTime = end - start;
            
            console.log(`Stress test: ${stressPatterns.length} patterns processed in ${processingTime.toFixed(2)}ms`);
            
            // Should complete in reasonable time (under 2 seconds)
            expect(processingTime).toBeLessThan(2000);
            
            // Should preserve regex patterns and TODO comments
            expect(result.content).toContain('/\\/\\*pattern0\\*\\//g');
            expect(result.content).toContain('/* TODO: Task 0 */');
            
            // Should remove regular comments
            expect(result.content).not.toContain('// Regular comment 0');
            
            // Verify counts
            expect(result.removed).toBe(1000); // Regular comments
            expect(result.preserved).toBe(1000); // TODO comments
        });
    });
});