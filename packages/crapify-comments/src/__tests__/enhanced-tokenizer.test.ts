import { EnhancedTokenizer } from '../enhanced-tokenizer';
import { ErrorCategory, ErrorSeverity } from '../error-handler';
import { Logger } from '@kafked/shared';

describe('EnhancedTokenizer', () => {
    let tokenizer: EnhancedTokenizer;

    beforeEach(() => {
        tokenizer = new EnhancedTokenizer();
    });

    describe('Basic tokenization', () => {
        it('should tokenize simple code', () => {
            const code = 'const x = 5;';
            const tokens = tokenizer.tokenize(code);

            expect(tokens.length).toBeGreaterThan(0);
            expect(tokens[0]).toMatchObject({
                type: 'code',
                value: expect.any(String),
                context: { type: 'code' }
            });
        });

        it('should handle empty input', () => {
            const tokens = tokenizer.tokenize('');
            expect(tokens).toHaveLength(0);
        });

        it('should handle whitespace-only input', () => {
            const tokens = tokenizer.tokenize('   \n\t  ');
            expect(tokens.length).toBeGreaterThan(0);
            tokens.forEach(token => {
                expect(token.type).toBe('code');
            });
        });
    });

    describe('String literal parsing', () => {
        it('should parse single-quoted strings', () => {
            const code = "'hello'";
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe("'hello'");
            expect(stringToken?.context.quote).toBe("'");
        });

        it('should parse double-quoted strings', () => {
            const code = '"hello"';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('"hello"');
            expect(stringToken?.context.quote).toBe('"');
        });

        it('should handle escaped quotes in strings', () => {
            const code = '"He said \\"Hello\\""';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('"He said \\"Hello\\""');
        });

        it('should handle escaped backslashes in strings', () => {
            const code = '"Path: C:\\\\Users\\\\file.txt"';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('"Path: C:\\\\Users\\\\file.txt"');
        });

        it('should handle mixed escape sequences', () => {
            const code = '"Line 1\\nTab:\\tQuote:\\"End"';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('"Line 1\\nTab:\\tQuote:\\"End"');
        });

        it('should handle hexadecimal escape sequences', () => {
            const code = '"Hex: \\x41\\x42\\x43"';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('"Hex: \\x41\\x42\\x43"');
        });

        it('should handle unicode escape sequences', () => {
            const code = '"Unicode: \\u0041\\u0042\\u{1F600}"';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('"Unicode: \\u0041\\u0042\\u{1F600}"');
        });

        it('should handle unterminated strings gracefully', () => {
            const code = '"Unterminated string\nconst x = 5;';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('"Unterminated string');
            
            // Should continue parsing after the unterminated string
            expect(tokens.length).toBeGreaterThan(1);
        });

        it('should handle strings with comment-like patterns', () => {
            const code = '"This // looks like a comment but is not"';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            const commentTokens = tokens.filter(t => t.type === 'comment');
            
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('"This // looks like a comment but is not"');
            expect(commentTokens).toHaveLength(0);
        });

        it('should handle strings with block comment patterns', () => {
            const code = '"This /* looks like */ a comment but is not"';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            const commentTokens = tokens.filter(t => t.type === 'comment');
            
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('"This /* looks like */ a comment but is not"');
            expect(commentTokens).toHaveLength(0);
        });
    });

    describe('Template literal parsing', () => {
        it('should parse simple template literals', () => {
            const code = '`hello world`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`hello world`');
            expect(stringToken?.context.type).toBe('template');
        });

        it('should parse template literals with interpolation', () => {
            const code = '`Hello ${name}!`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`Hello ${name}!`');
            expect(stringToken?.context.type).toBe('template');
        });

        it('should handle template literals with multiple interpolations', () => {
            const code = '`Hello ${firstName} ${lastName}! You are ${age} years old.`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`Hello ${firstName} ${lastName}! You are ${age} years old.`');
            expect(stringToken?.context.type).toBe('template');
        });

        it('should handle nested braces in template interpolation', () => {
            const code = '`Result: ${obj.method({ key: value })}`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`Result: ${obj.method({ key: value })}`');
            expect(stringToken?.context.type).toBe('template');
        });

        it('should handle template literals with nested strings in interpolation', () => {
            const code = '`Message: ${getMessage("Hello World")}`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`Message: ${getMessage("Hello World")}`');
            expect(stringToken?.context.type).toBe('template');
        });

        it('should handle template literals with nested template literals', () => {
            const code = '`Outer: ${`Inner: ${value}`}`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`Outer: ${`Inner: ${value}`}`');
            expect(stringToken?.context.type).toBe('template');
        });

        it('should handle escaped backticks in template literals', () => {
            const code = '`This is a \\`backtick\\` in template`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`This is a \\`backtick\\` in template`');
            expect(stringToken?.context.type).toBe('template');
        });

        it('should handle escaped dollar signs in template literals', () => {
            const code = '`Price: \\$${price}`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`Price: \\$${price}`');
            expect(stringToken?.context.type).toBe('template');
        });

        it('should handle template literals with comment-like patterns', () => {
            const code = '`This // is not a comment ${value} /* neither is this */`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            const commentTokens = tokens.filter(t => t.type === 'comment');
            
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`This // is not a comment ${value} /* neither is this */`');
            expect(commentTokens).toHaveLength(0);
        });

        it('should handle multiline template literals', () => {
            const code = '`Line 1\nLine 2\n${value}\nLine 4`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`Line 1\nLine 2\n${value}\nLine 4`');
            expect(stringToken?.context.type).toBe('template');
        });

        it('should handle complex expressions in interpolation', () => {
            const code = '`Result: ${array.map(item => item.value).filter(v => v > 0).join(", ")}`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`Result: ${array.map(item => item.value).filter(v => v > 0).join(", ")}`');
            expect(stringToken?.context.type).toBe('template');
        });
    });

    describe('Regex literal parsing', () => {
        it('should parse simple regex literals', () => {
            const code = '/hello/g';
            const tokens = tokenizer.tokenize(code);

            const regexToken = tokens.find(t => t.type === 'regex');
            expect(regexToken).toBeDefined();
            expect(regexToken?.value).toBe('/hello/g');
            expect(regexToken?.context.type).toBe('regex');
        });

        it('should parse regex with comment-like patterns', () => {
            const code = '/\\/\\*.*?\\*\\//g';
            const tokens = tokenizer.tokenize(code);

            const regexToken = tokens.find(t => t.type === 'regex');
            expect(regexToken).toBeDefined();
            expect(regexToken?.value).toBe('/\\/\\*.*?\\*\\//g');
        });

        it('should parse regex with line comment patterns', () => {
            const code = 'const pattern = /\\/\\/.*$/gm;';
            const tokens = tokenizer.tokenize(code);

            const regexToken = tokens.find(t => t.type === 'regex');
            expect(regexToken).toBeDefined();
            expect(regexToken?.value).toBe('/\\/\\/.*$/gm');
        });

        it('should handle regex with character classes containing slashes', () => {
            const code = 'const pattern = /[/\\\\]/g;';
            const tokens = tokenizer.tokenize(code);

            const regexToken = tokens.find(t => t.type === 'regex');
            expect(regexToken).toBeDefined();
            expect(regexToken?.value).toBe('/[/\\\\]/g');
        });

        it('should handle regex with escaped slashes', () => {
            const code = 'const pattern = /\\/path\\/to\\/file/;';
            const tokens = tokenizer.tokenize(code);

            const regexToken = tokens.find(t => t.type === 'regex');
            expect(regexToken).toBeDefined();
            expect(regexToken?.value).toBe('/\\/path\\/to\\/file/');
        });

        it('should handle complex regex with multiple flags', () => {
            const code = 'const pattern = /(?:\\/\\*[\\s\\S]*?\\*\\/|\\/\\/.*$)/gim;';
            const tokens = tokenizer.tokenize(code);

            const regexToken = tokens.find(t => t.type === 'regex');
            expect(regexToken).toBeDefined();
            expect(regexToken?.value).toBe('/(?:\\/\\*[\\s\\S]*?\\*\\/|\\/\\/.*$)/gim');
        });

        it('should handle regex with character classes containing comment-like patterns', () => {
            const code = 'const pattern = /[/*]/g;';
            const tokens = tokenizer.tokenize(code);

            const regexToken = tokens.find(t => t.type === 'regex');
            expect(regexToken).toBeDefined();
            expect(regexToken?.value).toBe('/[/*]/g');
        });

        it('should handle regex with nested character classes', () => {
            const code = 'const pattern = /[\\[\\]]/g;';
            const tokens = tokenizer.tokenize(code);

            const regexToken = tokens.find(t => t.type === 'regex');
            expect(regexToken).toBeDefined();
            expect(regexToken?.value).toBe('/[\\[\\]]/g');
        });

        it('should parse the problematic regex from the original bug report', () => {
            const code = 'result = result.replace(/\\/\\*[\\s\\S]*?\\*\\//g, (match) => {';
            const tokens = tokenizer.tokenize(code);

            const regexToken = tokens.find(t => t.type === 'regex');
            expect(regexToken).toBeDefined();
            expect(regexToken?.value).toBe('/\\/\\*[\\s\\S]*?\\*\\//g');
            
            // Ensure the regex is complete and not truncated
            expect(regexToken?.value).toContain('*\\//g');
        });

        it('should handle regex with all valid flags', () => {
            const code = 'const pattern = /test/gimsuyvd;';
            const tokens = tokenizer.tokenize(code);

            const regexToken = tokens.find(t => t.type === 'regex');
            expect(regexToken).toBeDefined();
            expect(regexToken?.value).toBe('/test/gimsuyvd');
        });

        it('should not parse division as regex', () => {
            const code = 'const result = x / y / z;';
            const tokens = tokenizer.tokenize(code);

            const regexTokens = tokens.filter(t => t.type === 'regex');
            expect(regexTokens).toHaveLength(0);
        });

        it('should parse regex after assignment operators', () => {
            const code = 'pattern = /test/g;';
            const tokens = tokenizer.tokenize(code);

            const regexToken = tokens.find(t => t.type === 'regex');
            expect(regexToken).toBeDefined();
            expect(regexToken?.value).toBe('/test/g');
        });

        it('should parse regex after return statement', () => {
            const code = 'return /test/g;';
            const tokens = tokenizer.tokenize(code);

            const regexToken = tokens.find(t => t.type === 'regex');
            expect(regexToken).toBeDefined();
            expect(regexToken?.value).toBe('/test/g');
        });

        it('should parse regex after conditional operators', () => {
            const code = 'const result = condition ? /test/g : null;';
            const tokens = tokenizer.tokenize(code);

            const regexToken = tokens.find(t => t.type === 'regex');
            expect(regexToken).toBeDefined();
            expect(regexToken?.value).toBe('/test/g');
        });

        it('should parse regex in array literals', () => {
            const code = 'const patterns = [/test1/g, /test2/i];';
            const tokens = tokenizer.tokenize(code);

            const regexTokens = tokens.filter(t => t.type === 'regex');
            expect(regexTokens).toHaveLength(2);
            expect(regexTokens[0].value).toBe('/test1/g');
            expect(regexTokens[1].value).toBe('/test2/i');
        });

        it('should parse regex in function calls', () => {
            const code = 'str.match(/pattern/g);';
            const tokens = tokenizer.tokenize(code);

            const regexToken = tokens.find(t => t.type === 'regex');
            expect(regexToken).toBeDefined();
            expect(regexToken?.value).toBe('/pattern/g');
        });

        it('should handle unterminated regex gracefully', () => {
            const code = 'const pattern = /unterminated\nconst x = 5;';
            const tokens = tokenizer.tokenize(code);

            // Should not crash and should continue parsing
            expect(tokens.length).toBeGreaterThan(0);
            
            // The unterminated regex should be parsed as far as possible
            const regexToken = tokens.find(t => t.type === 'regex');
            expect(regexToken).toBeDefined();
            expect(regexToken?.value).toBe('/unterminated');
        });
    });

    describe('Comment parsing', () => {
        it('should parse line comments', () => {
            const code = '// This is a comment';
            const tokens = tokenizer.tokenize(code);

            const commentToken = tokens.find(t => t.type === 'comment');
            expect(commentToken).toBeDefined();
            expect(commentToken?.value).toBe('// This is a comment');
            expect(commentToken?.context.type).toBe('comment');
        });

        it('should parse block comments', () => {
            const code = '/* This is a block comment */';
            const tokens = tokenizer.tokenize(code);

            const commentToken = tokens.find(t => t.type === 'comment');
            expect(commentToken).toBeDefined();
            expect(commentToken?.value).toBe('/* This is a block comment */');
        });

        it('should parse HTML comments', () => {
            const code = '<!-- This is an HTML comment -->';
            const tokens = tokenizer.tokenize(code);

            const commentToken = tokens.find(t => t.type === 'comment');
            expect(commentToken).toBeDefined();
            expect(commentToken?.value).toBe('<!-- This is an HTML comment -->');
        });
    });

    describe('Nested context tracking', () => {
        it('should handle deeply nested template interpolations', () => {
            const code = '`Level 1: ${`Level 2: ${`Level 3: ${value}`}`}`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`Level 1: ${`Level 2: ${`Level 3: ${value}`}`}`');
        });

        it('should handle mixed string types in complex expressions', () => {
            const code = '`Template with ${func("string", \'single\', `nested ${x}`)} interpolation`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`Template with ${func("string", \'single\', `nested ${x}`)} interpolation`');
        });

        it('should handle object literals in template interpolation', () => {
            const code = '`Config: ${JSON.stringify({ key: "value", nested: { prop: `template ${x}` } })}`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`Config: ${JSON.stringify({ key: "value", nested: { prop: `template ${x}` } })}`');
        });

        it('should handle function calls with multiple string arguments in interpolation', () => {
            const code = '`Result: ${combine("first", \'second\', `third ${var}`)}`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`Result: ${combine("first", \'second\', `third ${var}`)}`');
        });

        it('should handle conditional expressions in template interpolation', () => {
            const code = '`Value: ${condition ? "true case" : `false case ${alt}`}`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`Value: ${condition ? "true case" : `false case ${alt}`}`');
        });

        it('should handle array literals with mixed string types in interpolation', () => {
            const code = '`Array: ${["item1", \'item2\', `item3 ${x}`].join(", ")}`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`Array: ${["item1", \'item2\', `item3 ${x}`].join(", ")}`');
        });

        it('should handle regex literals in template interpolation', () => {
            const code = '`Pattern: ${/test\\/pattern/g.source}`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`Pattern: ${/test\\/pattern/g.source}`');
        });

        it('should handle comments inside interpolation expressions', () => {
            const code = '`Result: ${/* comment */ getValue() // another comment\n}`';
            const tokens = tokenizer.tokenize(code);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken).toBeDefined();
            expect(stringToken?.value).toBe('`Result: ${/* comment */ getValue() // another comment\n}`');
        });
    });

    describe('Context awareness', () => {
        it('should not treat comment patterns inside strings as comments', () => {
            const code = 'const str = "This // is not a comment";';
            const tokens = tokenizer.tokenize(code);

            const commentTokens = tokens.filter(t => t.type === 'comment');
            expect(commentTokens).toHaveLength(0);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken?.value).toBe('"This // is not a comment"');
        });

        it('should not treat comment patterns inside template literals as comments', () => {
            const code = 'const str = `This /* is not */ a comment`;';
            const tokens = tokenizer.tokenize(code);

            const commentTokens = tokens.filter(t => t.type === 'comment');
            expect(commentTokens).toHaveLength(0);

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken?.value).toBe('`This /* is not */ a comment`');
        });

        it('should not treat string delimiters inside regex as strings', () => {
            const code = 'const pattern = /["\'`]/g;';
            const tokens = tokenizer.tokenize(code);

            const stringTokens = tokens.filter(t => t.type === 'string');
            expect(stringTokens).toHaveLength(0);

            const regexToken = tokens.find(t => t.type === 'regex');
            expect(regexToken?.value).toBe('/["\'`]/g');
        });

        it('should handle mixed contexts correctly', () => {
            const code = `
                const regex = /\\/\\*.*?\\*\\//g; // Regex for comments
                const str = "Not a /* comment */";
                /* Actual comment */
                const template = \`Also not // a comment\`;
            `;
            const tokens = tokenizer.tokenize(code);

            const regexTokens = tokens.filter(t => t.type === 'regex');
            const stringTokens = tokens.filter(t => t.type === 'string');
            const commentTokens = tokens.filter(t => t.type === 'comment');

            expect(regexTokens).toHaveLength(1);
            expect(stringTokens).toHaveLength(2); // One regular string, one template
            expect(commentTokens).toHaveLength(2); // Line comment and block comment
        });
    });

    describe('Token positions', () => {
        it('should track correct start and end positions', () => {
            const code = 'const str = "hello";';
            const tokens = tokenizer.tokenize(code);

            expect(tokens[0].startPos).toBe(0); // First token starts at 0
            expect(tokens[0].endPos).toBeGreaterThan(0); // And has some length

            const stringToken = tokens.find(t => t.type === 'string');
            expect(stringToken?.startPos).toBeDefined();
            expect(stringToken?.endPos).toBeDefined();
            expect(stringToken?.endPos).toBeGreaterThan(stringToken?.startPos || 0);
        });

        it('should have non-overlapping token positions', () => {
            const code = 'const x = 5; // comment';
            const tokens = tokenizer.tokenize(code);

            for (let i = 0; i < tokens.length - 1; i++) {
                expect(tokens[i].endPos).toBeLessThanOrEqual(tokens[i + 1].startPos);
            }
        });
    });

    describe('Development keyword preservation integration', () => {
        it('should correctly tokenize code with development keyword comments', () => {
            const code = `
                function example() {
                    // TODO: implement error handling
                    const value = getValue();
                    
                    /* FIXME: this is a temporary hack */
                    if (!value) {
                        // HACK: quick fix for demo
                        return null;
                    }
                    
                    // NOTE: this logic needs review
                    return processValue(value);
                }
            `;
            
            const tokens = tokenizer.tokenize(code);
            
            const commentTokens = tokens.filter(t => t.type === 'comment');
            expect(commentTokens.length).toBe(4);
            
            // Verify each development keyword comment is properly tokenized
            const todoComment = commentTokens.find(t => t.value.includes('TODO'));
            const fixmeComment = commentTokens.find(t => t.value.includes('FIXME'));
            const hackComment = commentTokens.find(t => t.value.includes('HACK'));
            const noteComment = commentTokens.find(t => t.value.includes('NOTE'));
            
            expect(todoComment).toBeDefined();
            expect(fixmeComment).toBeDefined();
            expect(hackComment).toBeDefined();
            expect(noteComment).toBeDefined();
        });

        it('should handle development keywords in different comment styles', () => {
            const code = `
                // TODO: line comment
                /* FIXME: block comment */
                /** HACK: JSDoc style */
                <!-- NOTE: HTML comment -->
                // XXX: another line comment
                /* BUG: another block comment */
                // WARNING: important notice
            `;
            
            const tokens = tokenizer.tokenize(code);
            const commentTokens = tokens.filter(t => t.type === 'comment');
            
            expect(commentTokens.length).toBe(7);
            
            // Verify all development keywords are preserved in their respective comment tokens
            const keywords = ['TODO', 'FIXME', 'HACK', 'NOTE', 'XXX', 'BUG', 'WARNING'];
            keywords.forEach(keyword => {
                const keywordComment = commentTokens.find(t => t.value.includes(keyword));
                expect(keywordComment).toBeDefined();
            });
        });

        it('should not treat development keywords inside strings as comments', () => {
            const code = `
                const message = "TODO: this is not a comment";
                const template = \`FIXME: neither is this \${value}\`;
                const regex = /HACK.*NOTE/g;
                // TODO: but this is a real comment
            `;
            
            const tokens = tokenizer.tokenize(code);
            
            const commentTokens = tokens.filter(t => t.type === 'comment');
            const stringTokens = tokens.filter(t => t.type === 'string');
            const regexTokens = tokens.filter(t => t.type === 'regex');
            
            // Only one real comment should be found
            expect(commentTokens.length).toBe(1);
            expect(commentTokens[0].value).toContain('TODO: but this is a real comment');
            
            // String and regex tokens should contain the keywords but not be classified as comments
            expect(stringTokens.length).toBe(2);
            expect(regexTokens.length).toBe(1);
            
            const todoString = stringTokens.find(t => t.value.includes('TODO'));
            const fixmeTemplate = stringTokens.find(t => t.value.includes('FIXME'));
            const hackRegex = regexTokens.find(t => t.value.includes('HACK'));
            
            expect(todoString).toBeDefined();
            expect(fixmeTemplate).toBeDefined();
            expect(hackRegex).toBeDefined();
        });

        it('should handle mixed development keywords and framework comments', () => {
            const code = `
                // TODO: implement Svelte component
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                // FIXME: ESLint rule conflicts
                // eslint-disable-next-line no-console
                /* NOTE: webpack configuration issue */
                /* webpackChunkName: "async-chunk" */
                // WARNING: TypeScript compilation error
                // @ts-ignore
            `;
            
            const tokens = tokenizer.tokenize(code);
            const commentTokens = tokens.filter(t => t.type === 'comment');
            
            expect(commentTokens.length).toBe(8);
            
            // Verify both development keywords and framework comments are tokenized
            const developmentComments = commentTokens.filter(t => 
                /\b(TODO|FIXME|NOTE|WARNING)\b/i.test(t.value)
            );
            const frameworkComments = commentTokens.filter(t => 
                /svelte-ignore|eslint-disable|webpackChunkName|@ts-ignore/i.test(t.value)
            );
            
            expect(developmentComments.length).toBe(4);
            expect(frameworkComments.length).toBe(4);
        });

        it('should handle development keywords in complex code with regex patterns', () => {
            const code = `
                function processComments(content) {
                    // TODO: handle the regex pattern properly
                    const pattern = /\\/\\*[\\s\\S]*?\\*\\//g;
                    
                    /* FIXME: this regex might miss edge cases */
                    const result = content.replace(pattern, (match) => {
                        // HACK: temporary solution for comment removal
                        return '';
                    });
                    
                    // NOTE: the original bug was here
                    return result;
                }
            `;
            
            const tokens = tokenizer.tokenize(code);
            
            const commentTokens = tokens.filter(t => t.type === 'comment');
            const regexTokens = tokens.filter(t => t.type === 'regex');
            
            // Should have 4 development keyword comments
            expect(commentTokens.length).toBe(4);
            
            // Should have 1 regex token (the complex pattern)
            expect(regexTokens.length).toBe(1);
            expect(regexTokens[0].value).toBe('/\\/\\*[\\s\\S]*?\\*\\//g');
            
            // Verify all development keywords are preserved
            const keywords = ['TODO', 'FIXME', 'HACK', 'NOTE'];
            keywords.forEach(keyword => {
                const keywordComment = commentTokens.find(t => t.value.includes(keyword));
                expect(keywordComment).toBeDefined();
            });
        });

        it('should handle case-insensitive development keywords', () => {
            const code = `
                // todo: lowercase
                /* FIXME: uppercase */
                // Hack: title case
                /* nOtE: mixed case */
                // XXX: all caps
                /* bug: lowercase */
                // Warning: title case
                /* WARN: uppercase */
            `;
            
            const tokens = tokenizer.tokenize(code);
            const commentTokens = tokens.filter(t => t.type === 'comment');
            
            expect(commentTokens.length).toBe(8);
            
            // All should be properly tokenized regardless of case
            const expectedKeywords = ['todo', 'FIXME', 'Hack', 'nOtE', 'XXX', 'bug', 'Warning', 'WARN'];
            expectedKeywords.forEach(keyword => {
                const keywordComment = commentTokens.find(t => t.value.includes(keyword));
                expect(keywordComment).toBeDefined();
            });
        });
    });

    describe('Edge cases', () => {
        it('should handle division operator vs regex ambiguity', () => {
            const code1 = 'const result = x / y;'; // Division
            const code2 = 'const pattern = /test/;'; // Regex

            const tokens1 = tokenizer.tokenize(code1);
            const tokens2 = tokenizer.tokenize(code2);

            const regexTokens1 = tokens1.filter(t => t.type === 'regex');
            const regexTokens2 = tokens2.filter(t => t.type === 'regex');

            expect(regexTokens1).toHaveLength(0);
            expect(regexTokens2).toHaveLength(1);
        });

        it('should handle regex after return statement', () => {
            const code = 'return /test/g;';
            const tokens = tokenizer.tokenize(code);

            const regexToken = tokens.find(t => t.type === 'regex');
            expect(regexToken).toBeDefined();
            expect(regexToken?.value).toBe('/test/g');
        });

        it('should handle complex nested scenarios', () => {
            const code = 'const result = /test/g;';
            const tokens = tokenizer.tokenize(code);

            const regexTokens = tokens.filter(t => t.type === 'regex');
            expect(regexTokens.length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        let mockLogger: jest.Mocked<Logger>;
        let tokenizerWithLogger: EnhancedTokenizer;

        beforeEach(() => {
            mockLogger = new Logger(false, false, false) as jest.Mocked<Logger>;
            mockLogger.info = jest.fn();
            mockLogger.success = jest.fn();
            mockLogger.error = jest.fn();
            mockLogger.warn = jest.fn();
            mockLogger.json = jest.fn();
            
            tokenizerWithLogger = new EnhancedTokenizer(mockLogger, true);
        });

        it('should handle malformed string literals gracefully', () => {
            const code = 'const str = "unterminated string\nconst next = "complete";';
            const tokens = tokenizerWithLogger.tokenize(code);

            expect(tokens.length).toBeGreaterThan(0);
            
            const errorHandler = tokenizerWithLogger.getErrorHandler();
            const errors = errorHandler.getErrors();
            
            // Should have recorded an error for the unterminated string
            const stringErrors = errors.filter(e => e.category === ErrorCategory.STRING_HANDLING);
            expect(stringErrors.length).toBeGreaterThan(0);
        });

        it('should handle malformed template literals gracefully', () => {
            const code = 'const tmpl = `unterminated template\nconst next = `complete`;';
            const tokens = tokenizerWithLogger.tokenize(code);

            expect(tokens.length).toBeGreaterThan(0);
            
            const errorHandler = tokenizerWithLogger.getErrorHandler();
            const errors = errorHandler.getErrors();
            
            // Should have recorded an error for the unterminated template
            const templateErrors = errors.filter(e => e.category === ErrorCategory.TEMPLATE_LITERAL);
            expect(templateErrors.length).toBeGreaterThan(0);
        });

        it('should handle malformed regex literals gracefully', () => {
            const code = 'const regex = /unterminated[regex\nconst next = /complete/g;';
            const tokens = tokenizerWithLogger.tokenize(code);

            expect(tokens.length).toBeGreaterThan(0);
            
            const errorHandler = tokenizerWithLogger.getErrorHandler();
            const errors = errorHandler.getErrors();
            
            // Should have recorded an error for the unterminated regex
            const regexErrors = errors.filter(e => e.category === ErrorCategory.REGEX);
            expect(regexErrors.length).toBeGreaterThan(0);
        });

        it('should prevent infinite loops with safety mechanisms', () => {
            // Create a scenario that could cause infinite loops
            const code = '\x00\x01\x02'; // Control characters that might cause issues
            const tokens = tokenizerWithLogger.tokenize(code);

            expect(tokens.length).toBeGreaterThan(0);
            
            const errorHandler = tokenizerWithLogger.getErrorHandler();
            const errors = errorHandler.getErrors();
            
            // Should complete without hanging
            expect(Array.isArray(tokens)).toBe(true);
        });

        it('should validate parsing completion', () => {
            const code = 'const x = 5; // comment';
            const tokens = tokenizerWithLogger.tokenize(code);

            const errorHandler = tokenizerWithLogger.getErrorHandler();
            
            // Should validate that parsing completed successfully
            const originalLength = code.length;
            const processedLength = tokens.reduce((sum, token) => sum + token.value.length, 0);
            
            const isValid = errorHandler.validateParsingCompletion(originalLength, processedLength, tokens.length);
            expect(isValid).toBe(true);
        });

        it('should detect excessive content loss', () => {
            const errorHandler = tokenizerWithLogger.getErrorHandler();
            
            // Simulate excessive content loss
            const isValid = errorHandler.validateParsingCompletion(1000, 50, 5);
            expect(isValid).toBe(false);
            
            const errors = errorHandler.getErrors();
            const contentLossErrors = errors.filter(e => e.message.includes('content length difference'));
            expect(contentLossErrors.length).toBeGreaterThan(0);
        });

        it('should provide error context information', () => {
            const code = 'const str = "unterminated\nconst x = 5;';
            const tokens = tokenizerWithLogger.tokenize(code);

            const errorHandler = tokenizerWithLogger.getErrorHandler();
            const errors = errorHandler.getErrors();
            
            if (errors.length > 0) {
                const error = errors[0];
                expect(error.position).toBeDefined();
                expect(error.line).toBeDefined();
                expect(error.column).toBeDefined();
                expect(error.context).toBeDefined();
            }
        });

        it('should calculate line and column numbers correctly', () => {
            const code = 'line 1\nline 2\nline 3 with error here';
            const errorPosition = code.indexOf('error');
            
            const errorHandler = tokenizerWithLogger.getErrorHandler();
            const { line, column } = errorHandler.calculateLineColumn(code, errorPosition);
            
            expect(line).toBe(3);
            expect(column).toBeGreaterThan(0);
        });

        it('should provide context around error positions', () => {
            const code = 'This is a long piece of content with an error in the middle somewhere';
            const errorPosition = code.indexOf('error');
            
            const errorHandler = tokenizerWithLogger.getErrorHandler();
            const context = errorHandler.getContext(code, errorPosition, 10);
            
            expect(context).toContain('<<<ERROR>>>');
            expect(context).toContain('error');
        });

        it('should handle recovery from string parsing errors', () => {
            const code = 'const str = "unterminated\nconst next = "complete";';
            const tokens = tokenizerWithLogger.tokenize(code);

            // Should recover and continue parsing
            expect(tokens.length).toBeGreaterThan(1);
            
            // Should find the complete string
            const completeString = tokens.find(t => t.type === 'string' && t.value.includes('complete'));
            expect(completeString).toBeDefined();
        });

        it('should handle recovery from template literal errors', () => {
            const code = 'const tmpl = `unterminated\nconst next = `complete`;';
            const tokens = tokenizerWithLogger.tokenize(code);

            // Should recover and continue parsing
            expect(tokens.length).toBeGreaterThan(1);
            
            // Should find the "complete" part (it will be parsed as code since the first template consumed the backtick)
            const completeToken = tokens.find(t => t.value.includes('complete'));
            expect(completeToken).toBeDefined();
        });

        it('should handle recovery from regex parsing errors', () => {
            const code = 'const regex = /unterminated\nconst next = /complete/g;';
            const tokens = tokenizerWithLogger.tokenize(code);

            // Should recover and continue parsing
            expect(tokens.length).toBeGreaterThan(1);
            
            // Should find the complete regex
            const completeRegex = tokens.find(t => t.type === 'regex' && t.value.includes('complete'));
            expect(completeRegex).toBeDefined();
        });

        it('should provide error summary statistics', () => {
            // Generate multiple types of errors
            const code = `
                const str = "unterminated
                const tmpl = \`also unterminated
                const regex = /also unterminated
                const normal = "complete";
            `;
            
            const tokens = tokenizerWithLogger.tokenize(code);
            const errorHandler = tokenizerWithLogger.getErrorHandler();
            const summary = errorHandler.getErrorSummary();
            
            expect(summary.total).toBeGreaterThan(0);
            expect(summary.bySeverity).toBeDefined();
            expect(summary.byCategory).toBeDefined();
        });

        it('should handle critical errors without crashing', () => {
            // Simulate a critical error scenario
            const tokenizerWithoutFallback = new EnhancedTokenizer(mockLogger, false);
            
            // This should not crash even with fallback disabled
            const code = 'const problematic = "\x00\x01\x02";';
            const tokens = tokenizerWithoutFallback.tokenize(code);
            
            expect(Array.isArray(tokens)).toBe(true);
        });

        it('should log errors with appropriate severity levels', () => {
            const code = 'const str = "unterminated\nconst x = 5;';
            const tokens = tokenizerWithLogger.tokenize(code);

            // Should have logged warnings or errors
            expect(mockLogger.warn).toHaveBeenCalled();
        });

        it('should clear errors between tokenization runs', () => {
            const code1 = 'const str = "unterminated\n';
            const code2 = 'const str = "complete";';
            
            const tokens1 = tokenizerWithLogger.tokenize(code1);
            const errorHandler = tokenizerWithLogger.getErrorHandler();
            const errors1 = errorHandler.getErrors();
            
            expect(errors1.length).toBeGreaterThan(0);
            
            const tokens2 = tokenizerWithLogger.tokenize(code2);
            const errors2 = errorHandler.getErrors();
            
            // Errors should be cleared for the new tokenization
            expect(errors2.length).toBe(0);
        });

        it('should handle edge cases in error recovery', () => {
            // Test various edge cases
            const edgeCases = [
                '', // Empty string
                '\n', // Just newline
                '"', // Just quote
                '`', // Just backtick
                '/', // Just slash
                '/*', // Incomplete block comment start
                '//', // Just line comment start
                '\\', // Just backslash
            ];
            
            edgeCases.forEach(code => {
                const tokens = tokenizerWithLogger.tokenize(code);
                expect(Array.isArray(tokens)).toBe(true);
                // Should not crash on any edge case
            });
        });

        it('should handle nested error scenarios', () => {
            const code = 'const nested = `outer ${`inner "unterminated} outer`;';
            const tokens = tokenizerWithLogger.tokenize(code);

            expect(tokens.length).toBeGreaterThan(0);
            
            const errorHandler = tokenizerWithLogger.getErrorHandler();
            const errors = errorHandler.getErrors();
            
            // Should handle nested parsing errors gracefully
            expect(Array.isArray(errors)).toBe(true);
        });

        it('should provide detailed error information for debugging', () => {
            const code = 'const problematic = "unterminated string\nconst x = 5;';
            const tokens = tokenizerWithLogger.tokenize(code);

            const errorHandler = tokenizerWithLogger.getErrorHandler();
            const errors = errorHandler.getErrors();
            
            if (errors.length > 0) {
                const error = errors[0];
                expect(error.category).toBeDefined();
                expect(error.severity).toBeDefined();
                expect(error.message).toBeDefined();
                expect(typeof error.position).toBe('number');
                expect(typeof error.line).toBe('number');
                expect(typeof error.column).toBe('number');
                expect(error.context).toBeDefined();
            }
        });
    });
});