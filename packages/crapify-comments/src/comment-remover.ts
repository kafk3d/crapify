import path from 'path';
import { ProcessResult } from './types';

interface Token {
    type: 'string' | 'comment' | 'code';
    value: string;
}

export class CommentRemover {
    private readonly keepPatterns: string[];

    constructor(keepPatterns: string[]) {
        this.keepPatterns = keepPatterns.filter(p => p.trim().length > 0);
    }


    removeComments(content: string, filePath: string): ProcessResult {
        const extension = this.getFileExtension(filePath);
        
        
        const tokens = this.tokenize(content, extension);
        const result: string[] = [];
        let removed = 0;
        let preserved = 0;

        for (const token of tokens) {
            if (token.type === 'comment') {
                if (this.shouldPreserveComment(token.value)) {
                    result.push(token.value);
                    preserved++;
                } else {
                    removed++;
                    
                }
            } else {
                result.push(token.value);
            }
        }

        const processedContent = result.join('');
        return {
            content: processedContent,
            modified: content !== processedContent,
            removed,
            preserved
        };
    }

    private getFileExtension(filePath: string): string {
        return path.extname(filePath).slice(1).toLowerCase();
    }

    private tokenize(content: string, extension: string): Token[] {
        const tokens: Token[] = [];
        let i = 0;

        while (i < content.length) {
            const char = content[i];
            const next = content[i + 1];

            
            if (char === "'") {
                const str = this.parseString(content, i, "'");
                tokens.push({ type: 'string', value: str.value });
                i = str.end;
                continue;
            }

            
            if (char === '"') {
                const str = this.parseString(content, i, '"');
                tokens.push({ type: 'string', value: str.value });
                i = str.end;
                continue;
            }

            
            if (char === '`') {
                const str = this.parseTemplateString(content, i);
                tokens.push({ type: 'string', value: str.value });
                i = str.end;
                continue;
            }

            
            if (char === '/' && next === '*') {
                const comment = this.parseBlockComment(content, i);
                tokens.push({ type: 'comment', value: comment.value });
                i = comment.end;
                continue;
            }

            
            if (char === '/' && next === '/') {
                const comment = this.parseLineComment(content, i);
                tokens.push({ type: 'comment', value: comment.value });
                i = comment.end;
                continue;
            }

            
            if (char === '<' && content.substr(i, 4) === '<!--') {
                const comment = this.parseHtmlComment(content, i);
                tokens.push({ type: 'comment', value: comment.value });
                i = comment.end;
                continue;
            }

            
            if (char === '#' && this.isHashCommentFile(extension)) {
                const comment = this.parseHashComment(content, i);
                tokens.push({ type: 'comment', value: comment.value });
                i = comment.end;
                continue;
            }

            
            tokens.push({ type: 'code', value: char });
            i++;
        }

        return tokens;
    }

    private parseString(content: string, start: number, quote: string): { value: string; end: number } {
        let i = start + 1; 
        let value = quote;

        while (i < content.length) {
            const char = content[i];
            value += char;

            if (char === '\\') {
                
                i++;
                if (i < content.length) {
                    value += content[i];
                }
            } else if (char === quote) {
                
                return { value, end: i + 1 };
            }
            i++;
        }

        return { value, end: i };
    }

    private parseTemplateString(content: string, start: number): { value: string; end: number } {
        let i = start + 1; 
        let value = '`';

        while (i < content.length) {
            const char = content[i];
            value += char;

            if (char === '\\') {
                
                i++;
                if (i < content.length) {
                    value += content[i];
                }
            } else if (char === '`') {
                
                return { value, end: i + 1 };
            }
            i++;
        }

        return { value, end: i };
    }

    private parseLineComment(content: string, start: number): { value: string; end: number } {
        let i = start;
        let value = '';

        while (i < content.length && content[i] !== '\n') {
            value += content[i];
            i++;
        }

        return { value, end: i };
    }

    private parseBlockComment(content: string, start: number): { value: string; end: number } {
        let i = start + 2; 
        let value = '/*';

        while (i < content.length - 1) {
            value += content[i];
            if (content[i] === '*' && content[i + 1] === '/') {
                value += '/';
                return { value, end: i + 2 };
            }
            i++;
        }

        return { value, end: i };
    }

    private parseHtmlComment(content: string, start: number): { value: string; end: number } {
        let i = start + 4; 
        let value = '<!--';

        while (i < content.length - 2) {
            value += content[i];
            if (content.substr(i, 3) === '-->') {
                value += '-->';
                return { value, end: i + 3 };
            }
            i++;
        }

        return { value, end: i };
    }

    private parseHashComment(content: string, start: number): { value: string; end: number } {
        let i = start;
        let value = '';

        while (i < content.length && content[i] !== '\n') {
            value += content[i];
            i++;
        }

        return { value, end: i };
    }

    private isHashCommentFile(extension: string): boolean {
        const hashCommentExtensions = ['py', 'sh', 'bash', 'zsh', 'fish', 'rb', 'pl', 'yaml', 'yml'];
        return hashCommentExtensions.includes(extension);
    }

    private shouldPreserveComment(comment: string): boolean {
        if (this.keepPatterns.length === 0) return false;
        
        return this.keepPatterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            return regex.test(comment);
        });
    }
}