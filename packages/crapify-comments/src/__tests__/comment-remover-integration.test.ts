import { CommentRemover } from '../comment-remover';
import { Logger } from '@kafked/shared';

describe('CommentRemover Integration', () => {
    describe('Enhanced Tokenizer Integration', () => {
        it('should use enhanced tokenizer by default', () => {
            const remover = new CommentRemover([]);
            expect(remover).toBeDefined();
            
            
            const code = `
                const pattern = /\\/\\*[\\s\\S]*?\\*\\//g;
                // This is a regular comment
                /* TODO: Fix this */
            `;
            
            const result = remover.removeComments(code, 'test.js');
            
            // Should preserve the regex pattern and TODO comment
            expect(result.content).toContain('/\\/\\*[\\s\\S]*?\\*\\//g');
            expect(result.content).toContain('/* TODO: Fix this */');
            expect(result.content).not.toContain('// This is a regular comment');
            expect(result.removed).toBe(1);
            expect(result.preserved).toBe(1);
        });

        it('should handle framework-specific comments with enhanced tokenizer', () => {
            const remover = new CommentRemover([]);
            
            const code = `
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <div>Content</div>
                // Regular comment to remove
                /** @jsx jsx */
                const component = <div />;
            `;
            
            const result = remover.removeComments(code, 'test.svelte');
            
            
            expect(result.content).toContain('svelte-ignore');
            expect(result.content).toContain('@jsx jsx');
            expect(result.content).not.toContain('// Regular comment to remove');
            expect(result.preserved).toBe(2);
            expect(result.removed).toBe(1);
        });

        it('should maintain backward compatibility with keepPatterns', () => {
            const remover = new CommentRemover(['custom-pattern']);
            
            const code = `
                // custom-pattern: keep this
                // regular comment to remove
                /* TODO: also keep this */
            `;
            
            const result = remover.removeComments(code, 'test.js');
            
            // Should preserve both custom pattern and built-in TODO
            expect(result.content).toContain('custom-pattern: keep this');
            expect(result.content).toContain('TODO: also keep this');
            expect(result.content).not.toContain('regular comment to remove');
            expect(result.preserved).toBe(2);
            expect(result.removed).toBe(1);
        });

        it('should fallback to legacy tokenizer when enhanced tokenizer fails', () => {
            const remover = new CommentRemover([]);
            
            
            const originalTokenize = remover['enhancedTokenizer'].tokenize;
            remover['enhancedTokenizer'].tokenize = () => {
                throw new Error('Enhanced tokenizer failed');
            };
            
            const code = `
                // Regular comment
                /* Block comment */
            `;
            
            const result = remover.removeComments(code, 'test.js');
            
            
            expect(result.content).not.toContain('Regular comment');
            expect(result.content).not.toContain('Block comment');
            expect(result.removed).toBe(2);
            
            
            remover['enhancedTokenizer'].tokenize = originalTokenize;
        });

        it('should allow disabling enhanced tokenizer', () => {
            const remover = new CommentRemover([], { useEnhancedTokenizer: false });
            
            const code = `
                const pattern = /simple-regex/g;
                // Regular comment
            `;
            
            const result = remover.removeComments(code, 'test.js');
            
            
            
            expect(result.content).toContain('/simple-regex/g');
            expect(result.content).not.toContain('// Regular comment');
        });
    });

    describe('Rule Manager Integration', () => {
        it('should provide access to rule manager', () => {
            const remover = new CommentRemover([]);
            const ruleManager = remover.getRuleManager();
            
            expect(ruleManager).toBeDefined();
            expect(ruleManager.getRules().length).toBeGreaterThan(0);
        });

        it('should allow adding custom rules through rule manager', () => {
            const remover = new CommentRemover([]);
            const ruleManager = remover.getRuleManager();
            
            ruleManager.addCustomPattern('test-pattern', 'CUSTOM:\\s*\\w+', 100);
            
            const code = `
                // CUSTOM: important note
                // regular comment
            `;
            
            const result = remover.removeComments(code, 'test.js');
            
            expect(result.content).toContain('CUSTOM: important note');
            expect(result.content).not.toContain('regular comment');
            expect(result.preserved).toBe(1);
            expect(result.removed).toBe(1);
        });

        it('should handle complex nested contexts', () => {
            const remover = new CommentRemover([]);
            
            const code = `
                const template = \`
                    // This is inside a template literal
                    \${someVar} /* not a real comment */
                \`;
                // This is a real comment
                const regex = /\\/\\/ not a comment/g;
            `;
            
            const result = remover.removeComments(code, 'test.js');
            
            
            expect(result.content).toContain('// This is inside a template literal');
            expect(result.content).toContain('/* not a real comment */');
            expect(result.content).toContain('/\\/\\/ not a comment/g');
            expect(result.content).not.toContain('// This is a real comment');
            expect(result.removed).toBe(1);
        });
    });

    describe('Error Handling and Fallback', () => {
        it('should handle malformed code gracefully', () => {
            const remover = new CommentRemover([]);
            
            const malformedCode = `
                const str = "unterminated string
                // comment after malformed code
                const regex = /unterminated regex
                /* block comment */
            `;
            
            const result = remover.removeComments(malformedCode, 'test.js');
            
            
            expect(result).toBeDefined();
            expect(result.content).toBeDefined();
        });

        it('should handle empty content', () => {
            const remover = new CommentRemover([]);
            
            const result = remover.removeComments('', 'test.js');
            
            expect(result.content).toBe('');
            expect(result.modified).toBe(false);
            expect(result.removed).toBe(0);
            expect(result.preserved).toBe(0);
        });

        it('should handle content with only comments', () => {
            const remover = new CommentRemover([]);
            
            const code = `
                // Comment 1
                /* Comment 2 */
                <!-- HTML comment -->
            `;
            
            const result = remover.removeComments(code, 'test.js');
            
            expect(result.removed).toBe(3);
            expect(result.preserved).toBe(0);
            expect(result.modified).toBe(true);
        });
    });

    describe('Performance and Edge Cases', () => {
        it('should handle large files efficiently', () => {
            const remover = new CommentRemover([]);
            
            
            const lines = [];
            for (let i = 0; i < 1000; i++) {
                lines.push(`const var${i} = "value${i}"; // Comment ${i}`);
            }
            const largeCode = lines.join('\n');
            
            const startTime = Date.now();
            const result = remover.removeComments(largeCode, 'test.js');
            const endTime = Date.now();
            
            expect(result.removed).toBe(1000);
            expect(endTime - startTime).toBeLessThan(1000); 
        });

        it('should handle deeply nested contexts', () => {
            const remover = new CommentRemover([]);
            
            const code = `
                const template = \`
                    \${obj.method(\`
                        nested template \${/regex\\/\\*pattern/g}
                        // comment in nested template
                    \`)}
                    // comment in outer template
                \`;
                // real comment outside
            `;
            
            const result = remover.removeComments(code, 'test.js');
            
            
            expect(result.content).toContain('// comment in nested template');
            expect(result.content).toContain('// comment in outer template');
            expect(result.content).toContain('/regex\\/\\*pattern/g');
            expect(result.content).not.toContain('// real comment outside');
            expect(result.removed).toBe(1);
        });
    });
});   
 describe('Error Handling Integration', () => {
        let mockLogger: jest.Mocked<Logger>;
        let removerWithLogger: CommentRemover;

        beforeEach(() => {
            mockLogger = new Logger(false, false, false) as jest.Mocked<Logger>;
            mockLogger.info = jest.fn();
            mockLogger.success = jest.fn();
            mockLogger.error = jest.fn();
            mockLogger.warn = jest.fn();
            mockLogger.json = jest.fn();
            
            removerWithLogger = new CommentRemover([], { logger: mockLogger });
        });

        it('should handle malformed code gracefully', () => {
            const malformedCode = `
                const str = "unterminated string
                const tmpl = \`unterminated template
                const regex = /unterminated regex
                // This is a valid comment
                const valid = "complete";
            `;

            const result = removerWithLogger.removeComments(malformedCode, 'test.js');

            expect(result).toBeDefined();
            expect(result.content).toBeDefined();
            expect(result.hasErrors).toBe(true);
            expect(result.errors).toBeDefined();
            expect(result.warnings).toBeDefined();
        });

        it('should provide detailed error information in results', () => {
            const problematicCode = 'const str = "unterminated\nconst x = 5;';
            const result = removerWithLogger.removeComments(problematicCode, 'test.js');

            expect(result.hasErrors).toBe(true);
            expect(result.errors?.length).toBeGreaterThan(0);
            
            if (result.errors && result.errors.length > 0) {
                const error = result.errors[0];
                expect(error.category).toBeDefined();
                expect(error.severity).toBeDefined();
                expect(error.message).toBeDefined();
            }
        });

        it('should fall back to legacy tokenizer on enhanced tokenizer failure', () => {
            
            const problematicCode = '\x00\x01\x02 const x = 5; // comment';
            const result = removerWithLogger.removeComments(problematicCode, 'test.js');

            expect(result).toBeDefined();
            expect(result.content).toBeDefined();
            
        });

        it('should return original content when all parsing fails', () => {
            
            const originalTokenize = removerWithLogger['tokenize'];
            const originalEnhancedTokenize = removerWithLogger['enhancedTokenizer']['tokenize'];
            
            removerWithLogger['tokenize'] = jest.fn().mockImplementation(() => {
                throw new Error('Legacy tokenization failed');
            });
            
            removerWithLogger['enhancedTokenizer']['tokenize'] = jest.fn().mockImplementation(() => {
                throw new Error('Enhanced tokenization failed');
            });

            const code = 'const x = 5; // comment';
            const result = removerWithLogger.removeComments(code, 'test.js');

            expect(result.content).toBe(code); 
            expect(result.modified).toBe(false);
            expect(result.hasCriticalErrors).toBe(true);

            
            removerWithLogger['tokenize'] = originalTokenize;
            removerWithLogger['enhancedTokenizer']['tokenize'] = originalEnhancedTokenize;
        });

        it('should handle preservation errors gracefully', () => {
            
            const originalShouldPreserve = removerWithLogger['shouldPreserveCommentEnhanced'];
            removerWithLogger['shouldPreserveCommentEnhanced'] = jest.fn().mockImplementation(() => {
                throw new Error('Preservation logic failed');
            });

            const code = 'const x = 5; // TODO: fix this';
            const result = removerWithLogger.removeComments(code, 'test.js');

            expect(result).toBeDefined();
            expect(result.hasErrors).toBe(true);
            
            expect(result.preserved).toBeGreaterThan(0);

            
            removerWithLogger['shouldPreserveCommentEnhanced'] = originalShouldPreserve;
        });

        it('should validate processing results', () => {
            const code = 'const x = 5; /* comment */ const y = 10;';
            const result = removerWithLogger.removeComments(code, 'test.js');

            expect(result).toBeDefined();
            
            
            const originalLength = code.length;
            const processedLength = result.content.length;
            const lossPercentage = (originalLength - processedLength) / originalLength;
            
            expect(lossPercentage).toBeLessThan(0.8); 
        });

        it('should provide comprehensive processing statistics', () => {
            const code = `
                const str = "unterminated
                // TODO: fix this
                /* FIXME: another issue */
                const valid = "complete";
            `;

            const result = removerWithLogger.removeComments(code, 'test.js');
            const stats = removerWithLogger.getProcessingStats();

            expect(stats).toBeDefined();
            expect(stats.errors).toBeDefined();
            expect(stats.warnings).toBeDefined();
            expect(stats.errorSummary).toBeDefined();
            expect(stats.hasErrors).toBeDefined();
            expect(stats.hasCriticalErrors).toBeDefined();
        });

        it('should handle encoding issues', () => {
            const codeWithEncodingIssues = 'const str = "text with \uFFFD replacement char";';
            const result = removerWithLogger.removeComments(codeWithEncodingIssues, 'test.js');

            expect(result).toBeDefined();
            
            const stats = removerWithLogger.getProcessingStats();
            const encodingErrors = stats.errors.filter(e => 
                e.message && e.message.includes('encoding')
            );
            
            
            expect(encodingErrors.length).toBeGreaterThan(0);
        });

        it('should handle very large content without memory issues', () => {
            
            const largeContent = 'const x = 5; // comment\n'.repeat(1000);
            const result = removerWithLogger.removeComments(largeContent, 'large.js');

            expect(result).toBeDefined();
            expect(result.content).toBeDefined();
            
        });

        it('should handle mixed comment types with errors', () => {
            const mixedCode = `
                // Line comment
                /* Block comment */
                <!-- HTML comment -->
                const str = "unterminated
                // TODO: fix the string above
                const regex = /pattern/g;
            `;

            const result = removerWithLogger.removeComments(mixedCode, 'mixed.js');

            expect(result).toBeDefined();
            expect(result.removed).toBeGreaterThan(0); 
            expect(result.preserved).toBeGreaterThan(0); // Should preserve TODO comment
        });

        it('should log appropriate error messages', () => {
            const problematicCode = 'const str = "unterminated\nconst x = 5;';
            const result = removerWithLogger.removeComments(problematicCode, 'test.js');

            
            expect(mockLogger.warn).toHaveBeenCalled();
        });

        it('should handle concurrent error scenarios', () => {
            const codes = [
                'const str = "unterminated\n',
                'const tmpl = `unterminated\n',
                'const regex = /unterminated\n',
                'const valid = "complete"; // comment'
            ];

            const results = codes.map((code, index) => 
                removerWithLogger.removeComments(code, `test${index}.js`)
            );

            results.forEach(result => {
                expect(result).toBeDefined();
                expect(result.content).toBeDefined();
            });
        });

        it('should provide error recovery information', () => {
            const code = 'const str = "unterminated\nconst x = 5; // comment';
            const result = removerWithLogger.removeComments(code, 'test.js');

            expect(result.warnings).toBeDefined();
            
            if (result.warnings && result.warnings.length > 0) {
                const recoveryWarnings = result.warnings.filter(w => 
                    w.includes('recovery') || w.includes('recovered')
                );
                expect(recoveryWarnings.length).toBeGreaterThan(0);
            }
        });

        it('should handle error handler access', () => {
            const errorHandler = removerWithLogger.getErrorHandler();
            expect(errorHandler).toBeDefined();
            
            
            expect(typeof errorHandler.recordError).toBe('function');
            expect(typeof errorHandler.getErrors).toBe('function');
            expect(typeof errorHandler.getWarnings).toBe('function');
        });
    });