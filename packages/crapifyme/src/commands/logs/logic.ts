import { SimpleTokenizer } from '../../shared/tokenizer';
import { ProcessResult } from '../../shared/types';

export interface LogsOptions {
    keep?: string[];
    preserveDebug?: boolean;
    preserveError?: boolean;
    preserveWarn?: boolean;
}

export class LogsProcessor {
    private keepPatterns: string[];
    private preserveDebug: boolean;
    private preserveError: boolean;
    private preserveWarn: boolean;

    constructor(options: LogsOptions = {}) {
        this.keepPatterns = options.keep || [];
        this.preserveDebug = options.preserveDebug !== false;
        this.preserveError = options.preserveError !== false;
        this.preserveWarn = options.preserveWarn !== false;
    }

    processFile(content: string): ProcessResult {
        const tokenizer = new SimpleTokenizer();
        const tokens = tokenizer.tokenize(content);
        
        const result: string[] = [];
        let removed = 0;
        let preserved = 0;

        for (const token of tokens) {
            if (token.type === 'console-log') {
                if (this.shouldPreserveLog(token.value)) {
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

    private shouldPreserveLog(logStatement: string): boolean {
        const lowerLog = logStatement.toLowerCase();

        
        for (const pattern of this.keepPatterns) {
            if (lowerLog.includes(pattern.toLowerCase())) {
                return true;
            }
        }

        
        if (this.preserveError && lowerLog.includes('console.error')) {
            return true;
        }

        // Preserve console.warn by default
        if (this.preserveWarn && lowerLog.includes('console.warn')) {
            return true;
        }

        
        if (this.preserveDebug && lowerLog.includes('console.debug')) {
            return true;
        }

        
        const importantMethods = ['console.assert', 'console.trace', 'console.time', 'console.timeEnd'];
        for (const method of importantMethods) {
            if (lowerLog.includes(method)) {
                return true;
            }
        }

        return false;
    }
}