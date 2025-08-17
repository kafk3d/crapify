import path from 'path';
import { ProcessResult, CommentPattern } from './types';

export class CommentRemover {
    private readonly keepPatterns: RegExp[];
    private readonly languagePatterns: Map<string, CommentPattern[]>;

    constructor(keepPatterns: string[]) {
        this.keepPatterns = this.compileKeepPatterns(keepPatterns);
        this.languagePatterns = this.initializeLanguagePatterns();
    }

    private compileKeepPatterns(patterns: string[]): RegExp[] {
        if (patterns.length === 0) return [];
        
        return patterns
            .filter(p => p.trim().length > 0)
            .map(pattern => {
                const escaped = pattern.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return new RegExp(`\\b${escaped}\\b`, 'i');
            });
    }

    removeComments(content: string, filePath: string): ProcessResult {
        const extension = this.getFileExtension(filePath);
        const patterns = this.getLanguagePatterns(extension);
        
        if (patterns.length === 0) {
            return { content, modified: false, removed: 0, preserved: 0 };
        }

        let processedContent = content;
        let totalRemoved = 0;
        let totalPreserved = 0;

        for (const pattern of patterns) {
            const result = this.processCommentPattern(processedContent, pattern);
            processedContent = result.content;
            totalRemoved += result.removed;
            totalPreserved += result.preserved;
        }

        return {
            content: processedContent,
            modified: content !== processedContent,
            removed: totalRemoved,
            preserved: totalPreserved
        };
    }

    private getFileExtension(filePath: string): string {
        return path.extname(filePath).slice(1).toLowerCase();
    }

    private processCommentPattern(content: string, pattern: CommentPattern): ProcessResult {
        let processedContent = content;
        let removed = 0;
        let preserved = 0;

        if (pattern.inline) {
            processedContent = this.processInlineComments(processedContent, pattern, (r, p) => {
                removed += r;
                preserved += p;
            });
        } else if (pattern.end) {
            processedContent = this.processBlockComments(processedContent, pattern, (r, p) => {
                removed += r;
                preserved += p;
            });
        }

        return { content: processedContent, modified: false, removed, preserved };
    }

    private processInlineComments(
        content: string, 
        pattern: CommentPattern, 
        callback: (removed: number, preserved: number) => void
    ): string {
        const regex = new RegExp(`${pattern.start}.*$`, 'gm');
        return content.replace(regex, (match) => {
            if (this.shouldPreserveComment(match)) {
                callback(0, 1);
                return match;
            }
            callback(1, 0);
            return '';
        });
    }

    private processBlockComments(
        content: string, 
        pattern: CommentPattern, 
        callback: (removed: number, preserved: number) => void
    ): string {
        const regex = new RegExp(`${pattern.start}[\\s\\S]*?${pattern.end}`, 'g');
        return content.replace(regex, (match) => {
            if (this.shouldPreserveComment(match)) {
                callback(0, 1);
                return match;
            }
            callback(1, 0);
            return '';
        });
    }

    private shouldPreserveComment(comment: string): boolean {
        return this.keepPatterns.length > 0 && 
               this.keepPatterns.some(pattern => pattern.test(comment));
    }

    private getLanguagePatterns(extension: string): CommentPattern[] {
        return this.languagePatterns.get(extension) || this.languagePatterns.get('default') || [];
    }

    private initializeLanguagePatterns(): Map<string, CommentPattern[]> {
        const patterns = new Map<string, CommentPattern[]>();

        
        const cStylePatterns: CommentPattern[] = [
            { start: '//', inline: true },
            { start: '/\\*', end: '\\*/' }
        ];

        
        const markupPatterns: CommentPattern[] = [
            { start: '<!--', end: '-->' }
        ];

        
        const cssPatterns: CommentPattern[] = [
            { start: '/\\*', end: '\\*/' }
        ];

        
        const hashPatterns: CommentPattern[] = [
            { start: '#', inline: true }
        ];

        
        const languageMap: Record<string, CommentPattern[]> = {
            
            'js': cStylePatterns,
            'jsx': cStylePatterns,  
            'ts': cStylePatterns,
            'tsx': cStylePatterns,
            'mjs': cStylePatterns,
            'cjs': cStylePatterns,
            
            
            'c': cStylePatterns,
            'cpp': cStylePatterns,
            'cc': cStylePatterns,
            'cxx': cStylePatterns,
            'h': cStylePatterns,
            'hpp': cStylePatterns,
            'java': cStylePatterns,
            'cs': cStylePatterns,
            'php': cStylePatterns,
            
            
            'html': markupPatterns,
            'htm': markupPatterns,
            'xml': markupPatterns,
            'svg': markupPatterns,
            
            
            'vue': [...cStylePatterns, ...markupPatterns],
            'svelte': [...cStylePatterns, ...markupPatterns],
            
            
            'css': cssPatterns,
            'scss': [...cssPatterns, { start: '//', inline: true }],
            'sass': cssPatterns,
            'less': cssPatterns,
            
            
            'py': hashPatterns,
            'sh': hashPatterns,
            'bash': hashPatterns,
            'zsh': hashPatterns,
            'fish': hashPatterns,
            'rb': hashPatterns,
            'pl': hashPatterns,
            'yaml': hashPatterns,
            'yml': hashPatterns,
            
            
            'default': cStylePatterns
        };

        Object.entries(languageMap).forEach(([ext, commentPatterns]) => {
            patterns.set(ext, commentPatterns);
        });

        return patterns;
    }
}