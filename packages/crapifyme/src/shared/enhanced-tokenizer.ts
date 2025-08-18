import { EnhancedToken, TokenContext, LexerState } from './types';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from './error-handler';
import { Logger } from './logger';
import { PerformanceMonitor } from './performance-monitor';

export class EnhancedTokenizer {
    private static readonly WHITESPACE = /\s/;
    
    private content: string = '';
    private position: number = 0;
    private contextStack: TokenContext[] = [];
    private errorHandler: ErrorHandler;
    private logger: Logger;
    private performanceMonitor: PerformanceMonitor;

    constructor(logger?: Logger) {
        this.logger = logger || new Logger(false, false, false);
        this.errorHandler = new ErrorHandler(this.logger, true);
        this.performanceMonitor = new PerformanceMonitor(this.logger);
    }

    tokenize(content: string): EnhancedToken[] {
        this.content = content;
        this.position = 0;
        this.contextStack = [];
        this.errorHandler.clear();
        
        const tokens: EnhancedToken[] = [];
        let iterations = 0;
        const maxIterations = content.length * 2; 
        const originalLength = content.length;

        try {
            while (this.position < this.content.length && iterations < maxIterations) {
                const startPos = this.position;
                
                try {
                    const token = this.nextTokenOptimized();
                    
                    if (token) {
                        tokens.push(token);
                        
                        if (this.position <= startPos) {
                            this.errorHandler.recordError({
                                category: ErrorCategory.TOKENIZATION,
                                severity: ErrorSeverity.HIGH,
                                message: `Forced position advancement to prevent infinite loop`,
                                position: this.position
                            });
                            this.position = startPos + 1;
                        }
                    } else {
                        break;
                    }
                } catch (tokenError) {
                    this.errorHandler.recordError({
                        category: ErrorCategory.TOKENIZATION,
                        severity: ErrorSeverity.MEDIUM,
                        message: `Token parsing error: ${tokenError instanceof Error ? tokenError.message : 'Unknown error'}`,
                        position: this.position,
                        originalError: tokenError instanceof Error ? tokenError : undefined
                    });
                    
                    this.position = Math.min(startPos + 1, this.content.length);
                }
                
                iterations++;
            }

            if (iterations >= maxIterations) {
                this.errorHandler.recordError({
                    category: ErrorCategory.TOKENIZATION,
                    severity: ErrorSeverity.CRITICAL,
                    message: `Maximum iteration limit reached (${maxIterations}), possible infinite loop`,
                    position: this.position
                });
            }

            const processedLength = tokens.reduce((sum, token) => sum + token.value.length, 0);
            this.errorHandler.validateParsingCompletion(originalLength, processedLength, tokens.length);

            return tokens;
        } catch (error) {
            this.errorHandler.recordError({
                category: ErrorCategory.TOKENIZATION,
                severity: ErrorSeverity.CRITICAL,
                message: `Critical tokenization error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                position: this.position,
                originalError: error instanceof Error ? error : undefined
            });
            throw error;
        }
    }

    private nextTokenOptimized(): EnhancedToken | null {
        if (this.position >= this.content.length) {
            return null;
        }

        const startPos = this.position;
        const char = this.content[this.position];
        
        const hasNext = this.position + 1 < this.content.length;
        const next = hasNext ? this.content[this.position + 1] : '';

        const currentContext = this.getCurrentContext();
        if (currentContext && (currentContext.type === 'string' || currentContext.type === 'template')) {
            return this.parseCodeSequenceOptimized(startPos);
        }

        switch (char) {
            case "'":
                return this.parseStringTokenWithRecovery(startPos, "'");
            case '"':
                return this.parseStringTokenWithRecovery(startPos, '"');
            case '`':
                return this.parseTemplateStringTokenWithRecovery(startPos);
            case '/':
                if (next === '*') {
                    return this.parseBlockCommentToken(startPos);
                } else if (next === '/') {
                    return this.parseLineCommentToken(startPos);
                } else if (this.couldBeRegexOptimized()) {
                    return this.parseRegexTokenWithRecovery(startPos);
                }
                break;
            case '<':
                if (hasNext && this.content.substring(this.position, this.position + 4) === '<!--') {
                    return this.parseHtmlCommentToken(startPos);
                }
                break;
        }

        return this.parseCodeSequenceOptimized(startPos);
    }

    private parseCodeSequenceOptimized(startPos: number): EnhancedToken {
        const initialPosition = this.position;
        let endPos = this.position;

        while (endPos < this.content.length) {
            const char = this.content[endPos];
            
            switch (char) {
                case "'":
                case '"':
                case '`':
                    this.position = endPos;
                    return this.createCodeToken(startPos, endPos);
                case '/':
                    const next = endPos + 1 < this.content.length ? this.content[endPos + 1] : '';
                    if (next === '/' || next === '*' || this.couldBeRegexAtPosition(endPos)) {
                        this.position = endPos;
                        return this.createCodeToken(startPos, endPos);
                    }
                    break;
                case '<':
                    if (this.content.substring(endPos, endPos + 4) === '<!--') {
                        this.position = endPos;
                        return this.createCodeToken(startPos, endPos);
                    }
                    break;
            }

            endPos++;

            if (EnhancedTokenizer.WHITESPACE.test(char)) {
                break;
            }
        }

        if (endPos === initialPosition && endPos < this.content.length) {
            endPos++;
        }

        this.position = endPos;
        return this.createCodeToken(startPos, endPos);
    }

    private createCodeToken(startPos: number, endPos: number): EnhancedToken {
        return {
            type: 'code',
            value: this.content.substring(startPos, endPos),
            context: { type: 'code' },
            startPos,
            endPos
        };
    }

    private couldBeRegexAtPosition(pos: number): boolean {
        const savedPosition = this.position;
        this.position = pos;
        const result = this.couldBeRegexOptimized();
        this.position = savedPosition;
        return result;
    }

    private parseStringTokenWithRecovery(startPos: number, quote: string): EnhancedToken {
        let value = '';
        
        value += this.content[this.position];
        this.position++;

        while (this.position < this.content.length) {
            const char = this.content[this.position];
            
            if (char === '\\') {
                value += char;
                this.position++;
                if (this.position < this.content.length) {
                    value += this.content[this.position];
                    this.position++;
                }
            } else if (char === quote) {
                value += char;
                this.position++;
                break;
            } else if (char === '\n' && quote !== '`') {
                this.errorHandler.recordError({
                    category: ErrorCategory.STRING_HANDLING,
                    severity: ErrorSeverity.MEDIUM,
                    message: `Unterminated string literal at line ${this.errorHandler.calculateLineColumn(this.content, startPos).line}, column ${this.errorHandler.calculateLineColumn(this.content, startPos).column}`,
                    position: startPos
                });
                break;
            } else {
                value += char;
                this.position++;
            }
        }

        return {
            type: 'string',
            value,
            context: { type: 'string', quote },
            startPos,
            endPos: this.position
        };
    }

    private parseTemplateStringTokenWithRecovery(startPos: number): EnhancedToken {
        let value = '';
        let interpolationDepth = 0;
        
        value += this.content[this.position];
        this.position++;

        while (this.position < this.content.length) {
            const char = this.content[this.position];
            
            if (char === '\\') {
                value += char;
                this.position++;
                if (this.position < this.content.length) {
                    value += this.content[this.position];
                    this.position++;
                }
            } else if (char === '$' && this.position + 1 < this.content.length && this.content[this.position + 1] === '{') {
                value += char;
                this.position++;
                value += this.content[this.position];
                this.position++;
                interpolationDepth++;
            } else if (char === '}' && interpolationDepth > 0) {
                value += char;
                this.position++;
                interpolationDepth--;
            } else if (char === '`' && interpolationDepth === 0) {
                value += char;
                this.position++;
                break;
            } else {
                value += char;
                this.position++;
            }
        }

        return {
            type: 'string',
            value,
            context: { type: 'template', interpolationDepth },
            startPos,
            endPos: this.position
        };
    }

    private parseRegexTokenWithRecovery(startPos: number): EnhancedToken {
        let value = '';
        
        value += this.content[this.position];
        this.position++;

        while (this.position < this.content.length) {
            const char = this.content[this.position];
            
            if (char === '\\') {
                value += char;
                this.position++;
                if (this.position < this.content.length) {
                    value += this.content[this.position];
                    this.position++;
                }
            } else if (char === '/') {
                value += char;
                this.position++;
                
                while (this.position < this.content.length && /[gimuy]/.test(this.content[this.position])) {
                    value += this.content[this.position];
                    this.position++;
                }
                break;
            } else if (char === '\n') {
                this.errorHandler.recordError({
                    category: ErrorCategory.REGEX,
                    severity: ErrorSeverity.MEDIUM,
                    message: `Unterminated regex literal at line ${this.errorHandler.calculateLineColumn(this.content, startPos).line}, column ${this.errorHandler.calculateLineColumn(this.content, startPos).column}`,
                    position: startPos
                });
                break;
            } else {
                value += char;
                this.position++;
            }
        }

        return {
            type: 'regex',
            value,
            context: { type: 'regex' },
            startPos,
            endPos: this.position
        };
    }

    private parseLineCommentToken(startPos: number): EnhancedToken {
        let value = '';

        while (this.position < this.content.length && this.content[this.position] !== '\n') {
            value += this.content[this.position];
            this.position++;
        }

        return {
            type: 'comment',
            value,
            context: { type: 'comment' },
            startPos,
            endPos: this.position
        };
    }

    private parseBlockCommentToken(startPos: number): EnhancedToken {
        let value = '';

        value += this.content[this.position] + this.content[this.position + 1];
        this.position += 2;

        while (this.position < this.content.length - 1) {
            if (this.content[this.position] === '*' && this.content[this.position + 1] === '/') {
                value += '*/';
                this.position += 2;
                break;
            }
            value += this.content[this.position];
            this.position++;
        }

        return {
            type: 'comment',
            value,
            context: { type: 'comment' },
            startPos,
            endPos: this.position
        };
    }

    private parseHtmlCommentToken(startPos: number): EnhancedToken {
        let value = '';

        value += this.content.substring(this.position, this.position + 4);
        this.position += 4;

        while (this.position < this.content.length - 2) {
            if (this.content.substring(this.position, this.position + 3) === '-->') {
                value += '-->';
                this.position += 3;
                break;
            }
            value += this.content[this.position];
            this.position++;
        }

        return {
            type: 'comment',
            value,
            context: { type: 'comment' },
            startPos,
            endPos: this.position
        };
    }

    private couldBeRegexOptimized(): boolean {
        let i = this.position - 1;
        
        while (i >= 0 && /\s/.test(this.content[i])) {
            i--;
        }
        
        if (i < 0) return true;
        
        const prevChar = this.content[i];
        const regexPrecedingChars = new Set(['=', '(', '[', ',', ':', ';', '!', '&', '|', '?', '+', '-', '*', '/', '%', '{', '}', '\n']);
        
        return regexPrecedingChars.has(prevChar);
    }

    private getCurrentContext(): TokenContext | undefined {
        return this.contextStack[this.contextStack.length - 1];
    }

    getErrorHandler(): ErrorHandler {
        return this.errorHandler;
    }

    getErrorSummary() {
        return this.errorHandler.getErrorSummary();
    }
}