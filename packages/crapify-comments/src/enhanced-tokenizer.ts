import { EnhancedToken, TokenContext, LexerState } from './types';
import { ErrorHandler, ErrorCategory, ErrorSeverity, ParseError } from './error-handler';
import { Logger } from '@kafked/shared';
import { PerformanceMonitor, OptimizedStringBuilder } from './performance-monitor';


export class EnhancedTokenizer {
    private content: string = '';
    private position: number = 0;
    private contextStack: TokenContext[] = [];
    private errorHandler: ErrorHandler;
    private enableFallback: boolean;
    private performanceMonitor: PerformanceMonitor;
    
    
    private static readonly REGEX_FLAGS = /[gimsuyvd]/;
    private static readonly HEX_CHAR = /[0-9a-fA-F]/;
    private static readonly WHITESPACE = /\s/;
    private static readonly KEYWORD_PATTERN = /\b(return|throw|case|in|of|delete|void|typeof|new|instanceof|yield|await)\s*$/;
    private static readonly ASSIGNMENT_PATTERN = /[+\-*/%&|^]=?\s*$/;
    
    
    private readonly tokenBuffer: EnhancedToken[] = [];

    constructor(logger?: Logger, enableFallback: boolean = true) {
        this.errorHandler = new ErrorHandler(logger, true);
        this.enableFallback = enableFallback;
        this.performanceMonitor = new PerformanceMonitor(logger);
    }

    
    tokenize(content: string): EnhancedToken[] {
        
        this.performanceMonitor.startMonitoring();
        
        this.content = content;
        this.position = 0;
        this.contextStack = [];
        this.errorHandler.clear();

        
        const estimatedTokens = Math.ceil(content.length / 50); 
        const tokens: EnhancedToken[] = [];
        tokens.length = 0; 
        
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
                    }

                    
                    if (this.position === startPos) {
                        this.handleInfiniteLoopPrevention(startPos);
                    }

                } catch (tokenError) {
                    this.handleTokenizationError(tokenError, startPos, tokens);
                }

                iterations++;
            }

            
            if (iterations >= maxIterations) {
                this.errorHandler.recordError({
                    category: ErrorCategory.TOKENIZATION,
                    severity: ErrorSeverity.HIGH,
                    message: `Tokenization stopped due to iteration limit (${maxIterations}) to prevent infinite loop`,
                    position: this.position
                });
            }

            
            this.validateTokenizationResult(originalLength, tokens);

        } catch (criticalError) {
            this.handleCriticalError(criticalError, tokens);
        }

        
        const metrics = this.performanceMonitor.stopMonitoring(tokens.length, content.length);
        
        return tokens;
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

    
    private nextToken(): EnhancedToken | null {
        if (this.position >= this.content.length) {
            return null;
        }

        const startPos = this.position;
        const char = this.content[this.position];
        const next = this.position + 1 < this.content.length ? this.content[this.position + 1] : '';

        
        
        const currentContext = this.getCurrentContext();
        if (currentContext && (currentContext.type === 'string' || currentContext.type === 'template')) {
            
            return this.parseCodeSequence(startPos);
        }

        
        if (char === "'") {
            return this.parseStringTokenWithRecovery(startPos, "'");
        }

        if (char === '"') {
            return this.parseStringTokenWithRecovery(startPos, '"');
        }

        if (char === '`') {
            return this.parseTemplateStringTokenWithRecovery(startPos);
        }

        
        if (char === '/' && next === '*') {
            return this.parseBlockCommentToken(startPos);
        }

        if (char === '/' && next === '/') {
            return this.parseLineCommentToken(startPos);
        }

        
        if (char === '<' && this.content.substring(this.position, this.position + 4) === '<!--') {
            return this.parseHtmlCommentToken(startPos);
        }

        
        if (char === '/' && this.couldBeRegex()) {
            return this.parseRegexTokenWithRecovery(startPos);
        }

        
        return this.parseCodeSequence(startPos);
    }



    
    private parseStringToken(startPos: number, quote: string): EnhancedToken {
        let value = '';
        
        
        this.pushContext({ type: 'string', quote });
        
        
        if (this.position < this.content.length && this.content[this.position] === quote) {
            value += this.content[this.position];
            this.position++;
        }

        while (this.position < this.content.length) {
            const char = this.content[this.position];
            
            if (char === '\\') {
                
                value += char;
                this.position++;
                
                if (this.position < this.content.length) {
                    const escapedChar = this.content[this.position];
                    value += escapedChar;
                    this.position++;
                    
                    
                    
                    if (escapedChar === 'x' && this.position + 1 < this.content.length) {
                        
                        for (let i = 0; i < 2 && this.position < this.content.length; i++) {
                            if (/[0-9a-fA-F]/.test(this.content[this.position])) {
                                value += this.content[this.position];
                                this.position++;
                            } else {
                                break;
                            }
                        }
                    } else if (escapedChar === 'u' && this.position < this.content.length) {
                        
                        if (this.content[this.position] === '{') {
                            
                            value += this.content[this.position];
                            this.position++;
                            while (this.position < this.content.length && this.content[this.position] !== '}') {
                                if (/[0-9a-fA-F]/.test(this.content[this.position])) {
                                    value += this.content[this.position];
                                    this.position++;
                                } else {
                                    break;
                                }
                            }
                            if (this.position < this.content.length && this.content[this.position] === '}') {
                                value += this.content[this.position];
                                this.position++;
                            }
                        } else {
                            
                            for (let i = 0; i < 4 && this.position < this.content.length; i++) {
                                if (/[0-9a-fA-F]/.test(this.content[this.position])) {
                                    value += this.content[this.position];
                                    this.position++;
                                } else {
                                    break;
                                }
                            }
                        }
                    }
                }
            } else if (char === quote) {
                
                value += char;
                this.position++;
                break;
            } else if (char === '\n' || char === '\r') {
                
                
                if (this.errorHandler) {
                    const { line, column } = this.errorHandler.calculateLineColumn(this.content, startPos);
                    this.errorHandler.recordError({
                        category: ErrorCategory.STRING_HANDLING,
                        severity: ErrorSeverity.MEDIUM,
                        message: `Unterminated string literal at line ${line}, column ${column}`,
                        position: startPos,
                        line,
                        column,
                        context: this.errorHandler.getContext(this.content, startPos)
                    });
                }
                
                break;
            } else {
                value += char;
                this.position++;
            }
        }

        
        this.popContext();

        return {
            type: 'string',
            value,
            context: { type: 'string', quote },
            startPos,
            endPos: this.position
        };
    }

    
    private parseTemplateStringToken(startPos: number): EnhancedToken {
        let value = '';
        let interpolationDepth = 0;
        let braceDepth = 0;

        
        this.pushContext({ type: 'template', interpolationDepth: 0 });

        
        if (this.position < this.content.length && this.content[this.position] === '`') {
            value += this.content[this.position];
            this.position++;
        }

        while (this.position < this.content.length) {
            const char = this.content[this.position];
            const next = this.position + 1 < this.content.length ? this.content[this.position + 1] : '';

            if (char === '\\') {
                
                value += char;
                this.position++;
                
                if (this.position < this.content.length) {
                    const escapedChar = this.content[this.position];
                    value += escapedChar;
                    this.position++;
                    
                    
                    if (escapedChar === 'x' && this.position + 1 < this.content.length) {
                        
                        for (let i = 0; i < 2 && this.position < this.content.length; i++) {
                            if (/[0-9a-fA-F]/.test(this.content[this.position])) {
                                value += this.content[this.position];
                                this.position++;
                            } else {
                                break;
                            }
                        }
                    } else if (escapedChar === 'u' && this.position < this.content.length) {
                        
                        if (this.content[this.position] === '{') {
                            
                            value += this.content[this.position];
                            this.position++;
                            while (this.position < this.content.length && this.content[this.position] !== '}') {
                                if (/[0-9a-fA-F]/.test(this.content[this.position])) {
                                    value += this.content[this.position];
                                    this.position++;
                                } else {
                                    break;
                                }
                            }
                            if (this.position < this.content.length && this.content[this.position] === '}') {
                                value += this.content[this.position];
                                this.position++;
                            }
                        } else {
                            
                            for (let i = 0; i < 4 && this.position < this.content.length; i++) {
                                if (/[0-9a-fA-F]/.test(this.content[this.position])) {
                                    value += this.content[this.position];
                                    this.position++;
                                } else {
                                    break;
                                }
                            }
                        }
                    }
                }
            } else if (char === '$' && next === '{') {
                
                interpolationDepth++;
                braceDepth = 1; 
                value += char + next;
                this.position += 2;
                
                
                if (this.contextStack.length > 0) {
                    this.contextStack[this.contextStack.length - 1].interpolationDepth = interpolationDepth;
                }
                
                
                while (this.position < this.content.length && braceDepth > 0) {
                    const interpolationChar = this.content[this.position];
                    value += interpolationChar;
                    
                    if (interpolationChar === '{') {
                        braceDepth++;
                    } else if (interpolationChar === '}') {
                        braceDepth--;
                        if (braceDepth === 0) {
                            interpolationDepth--;
                        }
                    } else if (interpolationChar === '\\') {
                        
                        this.position++;
                        if (this.position < this.content.length) {
                            value += this.content[this.position];
                        }
                    } else if (interpolationChar === '"' || interpolationChar === "'" || interpolationChar === '`') {
                        
                        const nestedStringStart = this.position;
                        this.position++; 
                        
                        
                        while (this.position < this.content.length) {
                            const nestedChar = this.content[this.position];
                            value += nestedChar;
                            
                            if (nestedChar === '\\') {
                                this.position++;
                                if (this.position < this.content.length) {
                                    value += this.content[this.position];
                                }
                            } else if (nestedChar === interpolationChar) {
                                break;
                            }
                            this.position++;
                        }
                    }
                    
                    this.position++;
                }
                
                
                if (this.contextStack.length > 0) {
                    this.contextStack[this.contextStack.length - 1].interpolationDepth = interpolationDepth;
                }
            } else if (char === '`' && interpolationDepth === 0) {
                
                value += char;
                this.position++;
                break;
            } else {
                value += char;
                this.position++;
            }
        }

        
        if (this.position >= this.content.length && !value.endsWith('`')) {
            
            if (this.errorHandler) {
                const { line, column } = this.errorHandler.calculateLineColumn(this.content, startPos);
                this.errorHandler.recordError({
                    category: ErrorCategory.TEMPLATE_LITERAL,
                    severity: ErrorSeverity.MEDIUM,
                    message: `Unterminated template literal at line ${line}, column ${column}`,
                    position: startPos,
                    line,
                    column,
                    context: this.errorHandler.getContext(this.content, startPos)
                });
            }
        }

        
        this.popContext();

        return {
            type: 'string',
            value,
            context: { type: 'template', interpolationDepth },
            startPos,
            endPos: this.position
        };
    }

    
    private parseRegexToken(startPos: number): EnhancedToken {
        let value = '';
        let inCharacterClass = false;

        
        if (this.position < this.content.length && this.content[this.position] === '/') {
            value += this.content[this.position];
            this.position++;
        }

        while (this.position < this.content.length) {
            const char = this.content[this.position];

            if (char === '\n' || char === '\r') {
                
                
                if (this.errorHandler) {
                    const { line, column } = this.errorHandler.calculateLineColumn(this.content, startPos);
                    this.errorHandler.recordError({
                        category: ErrorCategory.REGEX,
                        severity: ErrorSeverity.MEDIUM,
                        message: `Unterminated regex literal at line ${line}, column ${column}`,
                        position: startPos,
                        line,
                        column,
                        context: this.errorHandler.getContext(this.content, startPos)
                    });
                }
                
                break;
            }

            value += char;

            if (char === '\\') {
                
                this.position++;
                if (this.position < this.content.length) {
                    value += this.content[this.position];
                    this.position++;
                }
            } else if (char === '[' && !inCharacterClass) {
                
                inCharacterClass = true;
                this.position++;
            } else if (char === ']' && inCharacterClass) {
                
                inCharacterClass = false;
                this.position++;
            } else if (char === '/' && !inCharacterClass) {
                
                this.position++;
                
                
                while (this.position < this.content.length && 
                       EnhancedTokenizer.REGEX_FLAGS.test(this.content[this.position])) {
                    value += this.content[this.position];
                    this.position++;
                }
                break;
            } else {
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

        
        if (this.position + 1 < this.content.length && 
            this.content[this.position] === '/' && 
            this.content[this.position + 1] === '*') {
            value += '/*';
            this.position += 2;
        }

        while (this.position < this.content.length) {
            const char = this.content[this.position];
            
            if (char === '*' && this.position + 1 < this.content.length && this.content[this.position + 1] === '/') {
                value += '*/';
                this.position += 2;
                break;
            } else {
                value += char;
                this.position++;
            }
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

        
        if (this.content.substring(this.position, this.position + 4) === '<!--') {
            value += '<!--';
            this.position += 4;
        }

        while (this.position < this.content.length) {
            if (this.position + 2 < this.content.length && this.content.substring(this.position, this.position + 3) === '-->') {
                value += '-->';
                this.position += 3;
                break;
            } else {
                value += this.content[this.position];
                this.position++;
            }
        }

        return {
            type: 'comment',
            value,
            context: { type: 'comment' },
            startPos,
            endPos: this.position
        };
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

    
    private parseCodeSequence(startPos: number): EnhancedToken {
        let value = '';
        const initialPosition = this.position;

        
        while (this.position < this.content.length) {
            const char = this.content[this.position];
            const next = this.position + 1 < this.content.length ? this.content[this.position + 1] : '';

            
            if (char === "'" || char === '"' || char === '`' ||
                (char === '/' && (next === '/' || next === '*')) ||
                (char === '<' && this.content.substring(this.position, this.position + 4) === '<!--')) {
                break;
            }

            
            if (char === '/' && this.couldBeRegex()) {
                break;
            }

            value += char;
            this.position++;

            
            if (/\s/.test(char)) {
                break;
            }
        }

        
        if (value === '' && this.position < this.content.length) {
            value = this.content[this.position];
            this.position++;
        }

        
        if (this.position === initialPosition && this.position < this.content.length) {
            value = this.content[this.position];
            this.position++;
        }

        return {
            type: 'code',
            value,
            context: { type: 'code' },
            startPos,
            endPos: this.position
        };
    }

    
    private couldBeRegexOptimized(): boolean {
        
        const next = this.position + 1 < this.content.length ? this.content[this.position + 1] : '';
        if (next === '/' || next === '*') {
            return false;
        }

        
        let i = this.position - 1;
        
        
        let whitespaceCount = 0;
        while (i >= 0 && EnhancedTokenizer.WHITESPACE.test(this.content[i]) && whitespaceCount < 10) {
            i--;
            whitespaceCount++;
        }

        if (i < 0) return true; 

        const prevChar = this.content[i];
        
        
        if (/[)\]}\w$]/.test(prevChar)) {
            return false;
        }
        
        
        if (/[=,({\[;:!&|?+\-*/%^~<>]/.test(prevChar)) {
            return true;
        }

        
        const keywordStart = Math.max(0, this.position - 30); 
        const beforeContext = this.content.substring(keywordStart, this.position);
        
        if (EnhancedTokenizer.KEYWORD_PATTERN.test(beforeContext)) {
            return true;
        }
        
        
        if (EnhancedTokenizer.ASSIGNMENT_PATTERN.test(beforeContext)) {
            return true;
        }

        
        return false;
    }

    
    private couldBeRegex(): boolean {
        
        const next = this.position + 1 < this.content.length ? this.content[this.position + 1] : '';
        if (next === '/' || next === '*') {
            return false;
        }

        
        let i = this.position - 1;
        
        
        while (i >= 0 && /\s/.test(this.content[i])) {
            i--;
        }

        if (i < 0) return true; 

        const prevChar = this.content[i];
        
        
        
        let keywordStart = Math.max(0, this.position - 50);
        const beforeContext = this.content.substring(keywordStart, this.position);
        const keywordPattern = /\b(return|throw|case|in|of|delete|void|typeof|new|instanceof|yield|await)\s*$/;
        
        if (keywordPattern.test(beforeContext)) {
            return true;
        }
        
        
        if (/[)\]}\w$]/.test(prevChar)) {
            return false;
        }
        
        
        if (/[=,({\[;:!&|?+\-*/%^~<>]/.test(prevChar)) {
            return true;
        }

        
        const assignmentPattern = /[+\-*/%&|^]=?\s*$/;
        if (assignmentPattern.test(beforeContext)) {
            return true;
        }

        
        return false;
    }

    
    private pushContext(context: TokenContext): void {
        this.contextStack.push(context);
    }

    
    private popContext(): TokenContext | undefined {
        return this.contextStack.pop();
    }

    
    private getCurrentContext(): TokenContext | null {
        return this.contextStack.length > 0 ? this.contextStack[this.contextStack.length - 1] : null;
    }

    
    private isInStringContext(): boolean {
        const context = this.getCurrentContext();
        return context !== null && (context.type === 'string' || context.type === 'template');
    }

    
    private isInTemplateInterpolation(): boolean {
        const context = this.getCurrentContext();
        return context !== null && context.type === 'template' && (context.interpolationDepth || 0) > 0;
    }

    
    private handleInfiniteLoopPrevention(startPos: number): void {
        const { line, column } = this.errorHandler.calculateLineColumn(this.content, startPos);
        const context = this.errorHandler.getContext(this.content, startPos);
        
        this.errorHandler.recordError({
            category: ErrorCategory.TOKENIZATION,
            severity: ErrorSeverity.MEDIUM,
            message: 'Forced position advancement to prevent infinite loop',
            position: startPos,
            line,
            column,
            context,
            recoveryAction: 'Advanced position by 1 character'
        });

        
        this.position++;
    }

    
    private handleTokenizationError(error: unknown, startPos: number, tokens: EnhancedToken[]): void {
        const { line, column } = this.errorHandler.calculateLineColumn(this.content, startPos);
        const context = this.errorHandler.getContext(this.content, startPos);
        
        const parseError: ParseError = {
            category: ErrorCategory.TOKENIZATION,
            severity: ErrorSeverity.MEDIUM,
            message: `Tokenization error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            position: startPos,
            line,
            column,
            context,
            originalError: error instanceof Error ? error : undefined
        };

        this.errorHandler.recordError(parseError);

        if (this.enableFallback) {
            const recoveryResult = this.errorHandler.attemptRecovery(parseError, this.content, startPos);
            
            if (recoveryResult.recovered) {
                
                const fallbackToken: EnhancedToken = {
                    type: 'code',
                    value: this.content[startPos] || '',
                    context: { type: 'code' },
                    startPos,
                    endPos: startPos + 1
                };
                
                tokens.push(fallbackToken);
                this.position = Math.max(this.position, startPos + 1);
            } else {
                
                this.position = startPos + 1;
            }
        } else {
            
            this.position = startPos + 1;
        }
    }

    
    private handleCriticalError(error: unknown, tokens: EnhancedToken[]): void {
        this.errorHandler.recordError({
            category: ErrorCategory.TOKENIZATION,
            severity: ErrorSeverity.CRITICAL,
            message: `Critical tokenization error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            position: this.position,
            originalError: error instanceof Error ? error : undefined,
            recoveryAction: 'Tokenization terminated early'
        });

        
        if (tokens.length === 0 && this.content.length > 0) {
            
            tokens.push({
                type: 'code',
                value: this.content,
                context: { type: 'code' },
                startPos: 0,
                endPos: this.content.length
            });
        }
    }

    
    private parseStringTokenWithRecovery(startPos: number, quote: string): EnhancedToken {
        try {
            return this.parseStringToken(startPos, quote);
        } catch (error) {
            const { line, column } = this.errorHandler.calculateLineColumn(this.content, startPos);
            const context = this.errorHandler.getContext(this.content, startPos);
            
            const parseError: ParseError = {
                category: ErrorCategory.STRING_HANDLING,
                severity: ErrorSeverity.MEDIUM,
                message: `String parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                position: startPos,
                line,
                column,
                context,
                originalError: error instanceof Error ? error : undefined
            };

            this.errorHandler.recordError(parseError);

            if (this.enableFallback) {
                const recoveryResult = this.errorHandler.attemptRecovery(parseError, this.content, startPos);
                
                if (recoveryResult.recovered) {
                    
                    const endPos = this.findStringEnd(startPos, quote);
                    const value = this.content.substring(startPos, endPos);
                    
                    this.position = endPos;
                    return {
                        type: 'string',
                        value,
                        context: { type: 'string', quote },
                        startPos,
                        endPos
                    };
                }
            }

            
            this.position = startPos + 1;
            return {
                type: 'code',
                value: this.content[startPos],
                context: { type: 'code' },
                startPos,
                endPos: startPos + 1
            };
        }
    }

    
    private parseTemplateStringTokenWithRecovery(startPos: number): EnhancedToken {
        try {
            return this.parseTemplateStringToken(startPos);
        } catch (error) {
            const { line, column } = this.errorHandler.calculateLineColumn(this.content, startPos);
            const context = this.errorHandler.getContext(this.content, startPos);
            
            const parseError: ParseError = {
                category: ErrorCategory.TEMPLATE_LITERAL,
                severity: ErrorSeverity.MEDIUM,
                message: `Template literal parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                position: startPos,
                line,
                column,
                context,
                originalError: error instanceof Error ? error : undefined
            };

            this.errorHandler.recordError(parseError);

            if (this.enableFallback) {
                const recoveryResult = this.errorHandler.attemptRecovery(parseError, this.content, startPos);
                
                if (recoveryResult.recovered) {
                    
                    const endPos = this.findTemplateEnd(startPos);
                    const value = this.content.substring(startPos, endPos);
                    
                    this.position = endPos;
                    return {
                        type: 'string',
                        value,
                        context: { type: 'template' },
                        startPos,
                        endPos
                    };
                }
            }

            
            this.position = startPos + 1;
            return {
                type: 'code',
                value: this.content[startPos],
                context: { type: 'code' },
                startPos,
                endPos: startPos + 1
            };
        }
    }

    
    private parseRegexTokenWithRecovery(startPos: number): EnhancedToken {
        try {
            return this.parseRegexToken(startPos);
        } catch (error) {
            const { line, column } = this.errorHandler.calculateLineColumn(this.content, startPos);
            const context = this.errorHandler.getContext(this.content, startPos);
            
            const parseError: ParseError = {
                category: ErrorCategory.REGEX,
                severity: ErrorSeverity.MEDIUM,
                message: `Regex parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                position: startPos,
                line,
                column,
                context,
                originalError: error instanceof Error ? error : undefined
            };

            this.errorHandler.recordError(parseError);

            if (this.enableFallback) {
                const recoveryResult = this.errorHandler.attemptRecovery(parseError, this.content, startPos);
                
                if (recoveryResult.recovered) {
                    
                    const endPos = this.findRegexEnd(startPos);
                    const value = this.content.substring(startPos, endPos);
                    
                    this.position = endPos;
                    return {
                        type: 'regex',
                        value,
                        context: { type: 'regex' },
                        startPos,
                        endPos
                    };
                }
            }

            
            this.position = startPos + 1;
            return {
                type: 'code',
                value: this.content[startPos],
                context: { type: 'code' },
                startPos,
                endPos: startPos + 1
            };
        }
    }

    
    private findStringEnd(startPos: number, quote: string): number {
        let pos = startPos + 1;
        while (pos < this.content.length) {
            const char = this.content[pos];
            if (char === quote) {
                return pos + 1;
            }
            if (char === '\n') {
                return pos; 
            }
            if (char === '\\') {
                pos += 2; 
            } else {
                pos++;
            }
        }
        return this.content.length;
    }

    
    private findTemplateEnd(startPos: number): number {
        let pos = startPos + 1;
        while (pos < this.content.length) {
            const char = this.content[pos];
            if (char === '`') {
                return pos + 1;
            }
            if (char === '\\') {
                pos += 2; 
            } else {
                pos++;
            }
        }
        return this.content.length;
    }

    
    private findRegexEnd(startPos: number): number {
        let pos = startPos + 1;
        let inCharClass = false;
        
        while (pos < this.content.length) {
            const char = this.content[pos];
            
            if (char === '\n') {
                return pos; 
            }
            
            if (char === '\\') {
                pos += 2; 
                continue;
            }
            
            if (char === '[' && !inCharClass) {
                inCharClass = true;
            } else if (char === ']' && inCharClass) {
                inCharClass = false;
            } else if (char === '/' && !inCharClass) {
                
                pos++;
                while (pos < this.content.length && /[gimsuyvd]/.test(this.content[pos])) {
                    pos++;
                }
                return pos;
            }
            
            pos++;
        }
        
        return this.content.length;
    }

    
    private validateTokenizationResult(originalLength: number, tokens: EnhancedToken[]): void {
        
        let processedLength = 0;
        let lastEndPos = 0;
        
        for (const token of tokens) {
            processedLength += token.value.length;
            
            
            if (token.startPos < lastEndPos) {
                this.errorHandler.recordError({
                    category: ErrorCategory.TOKENIZATION,
                    severity: ErrorSeverity.MEDIUM,
                    message: `Token overlap detected: token starts at ${token.startPos} but previous ended at ${lastEndPos}`,
                    position: token.startPos
                });
            } else if (token.startPos > lastEndPos) {
                this.errorHandler.recordError({
                    category: ErrorCategory.TOKENIZATION,
                    severity: ErrorSeverity.MEDIUM,
                    message: `Gap in tokenization: gap from ${lastEndPos} to ${token.startPos}`,
                    position: lastEndPos
                });
            }
            
            lastEndPos = token.endPos;
        }

        
        this.errorHandler.validateParsingCompletion(originalLength, processedLength, tokens.length);
        
        
        if (tokens.length > 0) {
            const avgTokenLength = processedLength / tokens.length;
            if (avgTokenLength < 1) {
                this.errorHandler.recordError({
                    category: ErrorCategory.TOKENIZATION,
                    severity: ErrorSeverity.LOW,
                    message: `Very small average token length (${avgTokenLength.toFixed(2)}), may indicate over-tokenization`,
                    position: 0
                });
            } else if (avgTokenLength > 1000) {
                this.errorHandler.recordError({
                    category: ErrorCategory.TOKENIZATION,
                    severity: ErrorSeverity.LOW,
                    message: `Very large average token length (${avgTokenLength.toFixed(2)}), may indicate under-tokenization`,
                    position: 0
                });
            }
        }
    }

    
    public getPerformanceMetrics(): PerformanceMonitor {
        return this.performanceMonitor;
    }

    
    getErrorHandler(): ErrorHandler {
        return this.errorHandler;
    }

    
    setEnableFallback(enabled: boolean): void {
        this.enableFallback = enabled;
    }
}