import { EnhancedToken, TokenContext, LexerState } from './types';
import { ErrorHandler, ErrorCategory, ErrorSeverity, ParseError } from './error-handler';
import { Logger } from '@kafked/shared';
import { PerformanceMonitor, OptimizedStringBuilder } from './performance-monitor';

/**
 * Enhanced tokenizer that provides context-aware parsing for JavaScript/TypeScript code.
 * Properly handles regex literals, string contexts, and nested template literals.
 */
export class EnhancedTokenizer {
    private content: string = '';
    private position: number = 0;
    private contextStack: TokenContext[] = [];
    private errorHandler: ErrorHandler;
    private enableFallback: boolean;
    private performanceMonitor: PerformanceMonitor;
    
    // Performance optimization: pre-compiled regex patterns
    private static readonly REGEX_FLAGS = /[gimsuyvd]/;
    private static readonly HEX_CHAR = /[0-9a-fA-F]/;
    private static readonly WHITESPACE = /\s/;
    private static readonly KEYWORD_PATTERN = /\b(return|throw|case|in|of|delete|void|typeof|new|instanceof|yield|await)\s*$/;
    private static readonly ASSIGNMENT_PATTERN = /[+\-*/%&|^]=?\s*$/;
    
    // Memory optimization: reusable objects
    private readonly tokenBuffer: EnhancedToken[] = [];

    constructor(logger?: Logger, enableFallback: boolean = true) {
        this.errorHandler = new ErrorHandler(logger, true);
        this.enableFallback = enableFallback;
        this.performanceMonitor = new PerformanceMonitor(logger);
    }

    /**
     * Tokenizes the input content with context awareness and comprehensive error handling
     */
    tokenize(content: string): EnhancedToken[] {
        // Start performance monitoring
        this.performanceMonitor.startMonitoring();
        
        this.content = content;
        this.position = 0;
        this.contextStack = [];
        this.errorHandler.clear();

        // Pre-allocate token array with estimated size for better memory performance
        const estimatedTokens = Math.ceil(content.length / 50); // Rough estimate
        const tokens: EnhancedToken[] = [];
        tokens.length = 0; // Ensure it starts empty but has capacity
        
        let iterations = 0;
        const maxIterations = content.length * 2; // Safety limit
        const originalLength = content.length;
        
        // Memory monitoring
        let lastMemoryCheck = 0;
        const memoryCheckInterval = Math.max(1000, Math.ceil(content.length / 100));

        try {
            while (this.position < this.content.length && iterations < maxIterations) {
                const startPos = this.position;
                
                // Periodic memory usage check for large files
                if (iterations - lastMemoryCheck > memoryCheckInterval) {
                    const currentMemory = this.performanceMonitor.getMemoryUsage();
                    if (!this.performanceMonitor.isMemoryUsageAcceptable(currentMemory, content.length)) {
                        this.errorHandler.recordError({
                            category: ErrorCategory.TOKENIZATION,
                            severity: ErrorSeverity.HIGH,
                            message: `High memory usage detected: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB for ${(content.length / 1024).toFixed(2)}KB file`,
                            position: this.position
                        });
                    }
                    lastMemoryCheck = iterations;
                }
                
                try {
                    const token = this.nextTokenOptimized();
                    
                    if (token) {
                        tokens.push(token);
                    }

                    // Safety check to prevent infinite loops
                    if (this.position === startPos) {
                        this.handleInfiniteLoopPrevention(startPos);
                    }

                } catch (tokenError) {
                    this.handleTokenizationError(tokenError, startPos, tokens);
                }

                iterations++;
            }

            // Check for iteration limit exceeded
            if (iterations >= maxIterations) {
                this.errorHandler.recordError({
                    category: ErrorCategory.TOKENIZATION,
                    severity: ErrorSeverity.HIGH,
                    message: `Tokenization stopped due to iteration limit (${maxIterations}) to prevent infinite loop`,
                    position: this.position
                });
            }

            // Validate parsing completion
            this.validateTokenizationResult(originalLength, tokens);

        } catch (criticalError) {
            this.handleCriticalError(criticalError, tokens);
        }

        // Stop performance monitoring and log metrics
        const metrics = this.performanceMonitor.stopMonitoring(tokens.length, content.length);
        
        return tokens;
    }

    /**
     * Optimized version of nextToken with better performance characteristics
     */
    private nextTokenOptimized(): EnhancedToken | null {
        if (this.position >= this.content.length) {
            return null;
        }

        const startPos = this.position;
        const char = this.content[this.position];
        
        // Fast path for common characters - avoid string concatenation for next char
        const hasNext = this.position + 1 < this.content.length;
        const next = hasNext ? this.content[this.position + 1] : '';

        // If we're inside a string context, we should not parse other token types
        const currentContext = this.getCurrentContext();
        if (currentContext && (currentContext.type === 'string' || currentContext.type === 'template')) {
            return this.parseCodeSequenceOptimized(startPos);
        }

        // Optimized character matching using switch for better performance
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

        // Parse regular code
        return this.parseCodeSequenceOptimized(startPos);
    }

    /**
     * Gets the next token from the input stream with context awareness (legacy method)
     */
    private nextToken(): EnhancedToken | null {
        if (this.position >= this.content.length) {
            return null;
        }

        const startPos = this.position;
        const char = this.content[this.position];
        const next = this.position + 1 < this.content.length ? this.content[this.position + 1] : '';

        // If we're inside a string context, we should not parse other token types
        // This prevents treating comment-like patterns inside strings as actual comments
        const currentContext = this.getCurrentContext();
        if (currentContext && (currentContext.type === 'string' || currentContext.type === 'template')) {
            // We're inside a string, continue parsing as code until we exit the string context
            return this.parseCodeSequence(startPos);
        }

        // Check for string literals
        if (char === "'") {
            return this.parseStringTokenWithRecovery(startPos, "'");
        }

        if (char === '"') {
            return this.parseStringTokenWithRecovery(startPos, '"');
        }

        if (char === '`') {
            return this.parseTemplateStringTokenWithRecovery(startPos);
        }

        // Check for comments first (only if not in string context)
        if (char === '/' && next === '*') {
            return this.parseBlockCommentToken(startPos);
        }

        if (char === '/' && next === '/') {
            return this.parseLineCommentToken(startPos);
        }

        // Check for HTML comments
        if (char === '<' && this.content.substring(this.position, this.position + 4) === '<!--') {
            return this.parseHtmlCommentToken(startPos);
        }

        // Check for regex literals - must come before parseCodeSequence
        if (char === '/' && this.couldBeRegex()) {
            return this.parseRegexTokenWithRecovery(startPos);
        }

        // Parse regular code
        return this.parseCodeSequence(startPos);
    }



    /**
     * Parses a string token with proper escape handling
     */
    private parseStringToken(startPos: number, quote: string): EnhancedToken {
        let value = '';
        
        // Push string context onto stack
        this.pushContext({ type: 'string', quote });
        
        // Include opening quote
        if (this.position < this.content.length && this.content[this.position] === quote) {
            value += this.content[this.position];
            this.position++;
        }

        while (this.position < this.content.length) {
            const char = this.content[this.position];
            
            if (char === '\\') {
                // Handle escape sequences - always consume the backslash and next character
                value += char;
                this.position++;
                
                if (this.position < this.content.length) {
                    const escapedChar = this.content[this.position];
                    value += escapedChar;
                    this.position++;
                    
                    // Handle special escape sequences that might affect parsing
                    // \x, \u, \U sequences need special handling for completeness
                    if (escapedChar === 'x' && this.position + 1 < this.content.length) {
                        // Hexadecimal escape sequence \xHH
                        for (let i = 0; i < 2 && this.position < this.content.length; i++) {
                            if (/[0-9a-fA-F]/.test(this.content[this.position])) {
                                value += this.content[this.position];
                                this.position++;
                            } else {
                                break;
                            }
                        }
                    } else if (escapedChar === 'u' && this.position < this.content.length) {
                        // Unicode escape sequence \uHHHH or \u{H...}
                        if (this.content[this.position] === '{') {
                            // \u{H...} format
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
                            // \uHHHH format
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
                // End of string - include closing quote
                value += char;
                this.position++;
                break;
            } else if (char === '\n' || char === '\r') {
                // Unterminated string - strings cannot span lines (except template literals)
                // Record error for unterminated string
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
                // Don't include the newline in the string value
                break;
            } else {
                value += char;
                this.position++;
            }
        }

        // Pop string context from stack
        this.popContext();

        return {
            type: 'string',
            value,
            context: { type: 'string', quote },
            startPos,
            endPos: this.position
        };
    }

    /**
     * Parses a template string token with proper interpolation and nested context tracking
     */
    private parseTemplateStringToken(startPos: number): EnhancedToken {
        let value = '';
        let interpolationDepth = 0;
        let braceDepth = 0;

        // Push template context onto stack
        this.pushContext({ type: 'template', interpolationDepth: 0 });

        // Include opening backtick
        if (this.position < this.content.length && this.content[this.position] === '`') {
            value += this.content[this.position];
            this.position++;
        }

        while (this.position < this.content.length) {
            const char = this.content[this.position];
            const next = this.position + 1 < this.content.length ? this.content[this.position + 1] : '';

            if (char === '\\') {
                // Handle escape sequences in template literals
                value += char;
                this.position++;
                
                if (this.position < this.content.length) {
                    const escapedChar = this.content[this.position];
                    value += escapedChar;
                    this.position++;
                    
                    // Handle special escape sequences similar to regular strings
                    if (escapedChar === 'x' && this.position + 1 < this.content.length) {
                        // Hexadecimal escape sequence \xHH
                        for (let i = 0; i < 2 && this.position < this.content.length; i++) {
                            if (/[0-9a-fA-F]/.test(this.content[this.position])) {
                                value += this.content[this.position];
                                this.position++;
                            } else {
                                break;
                            }
                        }
                    } else if (escapedChar === 'u' && this.position < this.content.length) {
                        // Unicode escape sequence \uHHHH or \u{H...}
                        if (this.content[this.position] === '{') {
                            // \u{H...} format
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
                            // \uHHHH format
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
                // Start of interpolation - enter nested context
                interpolationDepth++;
                braceDepth = 1; // Track brace depth within interpolation
                value += char + next;
                this.position += 2;
                
                // Update context with current interpolation depth
                if (this.contextStack.length > 0) {
                    this.contextStack[this.contextStack.length - 1].interpolationDepth = interpolationDepth;
                }
                
                // Parse the interpolated expression
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
                        // Handle escapes within interpolation
                        this.position++;
                        if (this.position < this.content.length) {
                            value += this.content[this.position];
                        }
                    } else if (interpolationChar === '"' || interpolationChar === "'" || interpolationChar === '`') {
                        // Handle nested strings within interpolation
                        const nestedStringStart = this.position;
                        this.position++; // Move past the quote
                        
                        // Parse the nested string without creating a separate token
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
                
                // Update context after interpolation ends
                if (this.contextStack.length > 0) {
                    this.contextStack[this.contextStack.length - 1].interpolationDepth = interpolationDepth;
                }
            } else if (char === '`' && interpolationDepth === 0) {
                // End of template string - include closing backtick
                value += char;
                this.position++;
                break;
            } else {
                value += char;
                this.position++;
            }
        }

        // Check if template literal was properly terminated
        if (this.position >= this.content.length && !value.endsWith('`')) {
            // Unterminated template literal
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

        // Pop template context from stack
        this.popContext();

        return {
            type: 'string',
            value,
            context: { type: 'template', interpolationDepth },
            startPos,
            endPos: this.position
        };
    }

    /**
     * Parses a regex token with proper handling of complex patterns and flags
     */
    private parseRegexToken(startPos: number): EnhancedToken {
        let value = '';
        let inCharacterClass = false;

        // Include opening slash
        if (this.position < this.content.length && this.content[this.position] === '/') {
            value += this.content[this.position];
            this.position++;
        }

        while (this.position < this.content.length) {
            const char = this.content[this.position];

            if (char === '\n' || char === '\r') {
                // Unterminated regex - regex literals cannot span lines
                // Record error for unterminated regex
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
                // Don't include the newline in the regex value
                break;
            }

            value += char;

            if (char === '\\') {
                // Handle escape sequences - always consume the next character
                this.position++;
                if (this.position < this.content.length) {
                    value += this.content[this.position];
                    this.position++;
                }
            } else if (char === '[' && !inCharacterClass) {
                // Start of character class
                inCharacterClass = true;
                this.position++;
            } else if (char === ']' && inCharacterClass) {
                // End of character class
                inCharacterClass = false;
                this.position++;
            } else if (char === '/' && !inCharacterClass) {
                // End of regex pattern, now parse flags
                this.position++;
                
                // Parse regex flags (g, i, m, s, u, v, y, d) - optimized
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

    /**
     * Parses a line comment token
     */
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

    /**
     * Parses a block comment token
     */
    private parseBlockCommentToken(startPos: number): EnhancedToken {
        let value = '';

        // Include opening /*
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

    /**
     * Parses an HTML comment token
     */
    private parseHtmlCommentToken(startPos: number): EnhancedToken {
        let value = '';

        // Include opening <!--
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

    /**
     * Optimized version of parseCodeSequence with better memory usage
     */
    private parseCodeSequenceOptimized(startPos: number): EnhancedToken {
        const initialPosition = this.position;
        let endPos = this.position;

        // Consume characters until we hit a special character - optimized loop
        while (endPos < this.content.length) {
            const char = this.content[endPos];
            
            // Fast character checks using switch
            switch (char) {
                case "'":
                case '"':
                case '`':
                    return this.createCodeToken(startPos, endPos);
                case '/':
                    const next = endPos + 1 < this.content.length ? this.content[endPos + 1] : '';
                    if (next === '/' || next === '*' || this.couldBeRegexAtPosition(endPos)) {
                        return this.createCodeToken(startPos, endPos);
                    }
                    break;
                case '<':
                    if (this.content.substring(endPos, endPos + 4) === '<!--') {
                        return this.createCodeToken(startPos, endPos);
                    }
                    break;
            }

            endPos++;

            // Break on whitespace for better granularity - but consume the whitespace
            if (EnhancedTokenizer.WHITESPACE.test(char)) {
                endPos++; // Include the whitespace
                break;
            }
        }

        // If we didn't consume anything, consume at least one character to avoid infinite loops
        if (endPos === initialPosition && endPos < this.content.length) {
            endPos++;
        }

        this.position = endPos;
        return this.createCodeToken(startPos, endPos);
    }

    /**
     * Creates a code token efficiently
     */
    private createCodeToken(startPos: number, endPos: number): EnhancedToken {
        return {
            type: 'code',
            value: this.content.substring(startPos, endPos),
            context: { type: 'code' },
            startPos,
            endPos
        };
    }

    /**
     * Check if position could be a regex without changing current position
     */
    private couldBeRegexAtPosition(pos: number): boolean {
        const savedPosition = this.position;
        this.position = pos;
        const result = this.couldBeRegexOptimized();
        this.position = savedPosition;
        return result;
    }

    /**
     * Parses a sequence of code characters
     */
    private parseCodeSequence(startPos: number): EnhancedToken {
        let value = '';
        const initialPosition = this.position;

        // Consume characters until we hit a special character
        while (this.position < this.content.length) {
            const char = this.content[this.position];
            const next = this.position + 1 < this.content.length ? this.content[this.position + 1] : '';

            // Stop at string delimiters, comment starts, or regex starts
            if (char === "'" || char === '"' || char === '`' ||
                (char === '/' && (next === '/' || next === '*')) ||
                (char === '<' && this.content.substring(this.position, this.position + 4) === '<!--')) {
                break;
            }

            // Special handling for '/' - check if it could be a regex
            if (char === '/' && this.couldBeRegex()) {
                break;
            }

            value += char;
            this.position++;

            // Don't consume too much at once - break on whitespace for better granularity
            if (/\s/.test(char)) {
                break;
            }
        }

        // If we didn't consume anything, consume at least one character to avoid infinite loops
        if (value === '' && this.position < this.content.length) {
            value = this.content[this.position];
            this.position++;
        }

        // Safety check to prevent infinite loops
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

    /**
     * Optimized version of couldBeRegex with better performance
     */
    private couldBeRegexOptimized(): boolean {
        // Check if the next character is also '/' or '*' (comments)
        const next = this.position + 1 < this.content.length ? this.content[this.position + 1] : '';
        if (next === '/' || next === '*') {
            return false;
        }

        // Look backwards to determine context - optimized version
        let i = this.position - 1;
        
        // Skip whitespace and newlines - limit lookback for performance
        let whitespaceCount = 0;
        while (i >= 0 && EnhancedTokenizer.WHITESPACE.test(this.content[i]) && whitespaceCount < 10) {
            i--;
            whitespaceCount++;
        }

        if (i < 0) return true; // Start of file

        const prevChar = this.content[i];
        
        // Quick check for common division contexts
        if (/[)\]}\w$]/.test(prevChar)) {
            return false;
        }
        
        // Quick check for common regex contexts
        if (/[=,({\[;:!&|?+\-*/%^~<>]/.test(prevChar)) {
            return true;
        }

        // Check for keywords that are followed by regex - limited lookback for performance
        const keywordStart = Math.max(0, this.position - 30); // Reduced from 50 for performance
        const beforeContext = this.content.substring(keywordStart, this.position);
        
        if (EnhancedTokenizer.KEYWORD_PATTERN.test(beforeContext)) {
            return true;
        }
        
        // Check for assignment operators
        if (EnhancedTokenizer.ASSIGNMENT_PATTERN.test(beforeContext)) {
            return true;
        }

        // Default to false for ambiguous cases (prefer division over regex)
        return false;
    }

    /**
     * Determines if a '/' character could start a regex literal
     * Uses improved heuristics to distinguish between division and regex
     */
    private couldBeRegex(): boolean {
        // Check if the next character is also '/' or '*' (comments)
        const next = this.position + 1 < this.content.length ? this.content[this.position + 1] : '';
        if (next === '/' || next === '*') {
            return false;
        }

        // Look backwards to determine context
        let i = this.position - 1;
        
        // Skip whitespace and newlines
        while (i >= 0 && /\s/.test(this.content[i])) {
            i--;
        }

        if (i < 0) return true; // Start of file

        const prevChar = this.content[i];
        
        // Check for keywords that are followed by regex FIRST
        // Look back further to find keywords
        let keywordStart = Math.max(0, this.position - 50);
        const beforeContext = this.content.substring(keywordStart, this.position);
        const keywordPattern = /\b(return|throw|case|in|of|delete|void|typeof|new|instanceof|yield|await)\s*$/;
        
        if (keywordPattern.test(beforeContext)) {
            return true;
        }
        
        // Regex is NOT likely after these characters (division context)
        if (/[)\]}\w$]/.test(prevChar)) {
            return false;
        }
        
        // Regex IS likely after these operators and keywords
        if (/[=,({\[;:!&|?+\-*/%^~<>]/.test(prevChar)) {
            return true;
        }

        // Check for assignment operators
        const assignmentPattern = /[+\-*/%&|^]=?\s*$/;
        if (assignmentPattern.test(beforeContext)) {
            return true;
        }

        // Default to false for ambiguous cases (prefer division over regex)
        return false;
    }

    /**
     * Pushes a new context onto the stack for nested context tracking
     */
    private pushContext(context: TokenContext): void {
        this.contextStack.push(context);
    }

    /**
     * Pops the current context from the stack
     */
    private popContext(): TokenContext | undefined {
        return this.contextStack.pop();
    }

    /**
     * Gets the current context for nested parsing decisions
     */
    private getCurrentContext(): TokenContext | null {
        return this.contextStack.length > 0 ? this.contextStack[this.contextStack.length - 1] : null;
    }

    /**
     * Checks if we're currently inside a string context
     */
    private isInStringContext(): boolean {
        const context = this.getCurrentContext();
        return context !== null && (context.type === 'string' || context.type === 'template');
    }

    /**
     * Checks if we're currently inside a template interpolation
     */
    private isInTemplateInterpolation(): boolean {
        const context = this.getCurrentContext();
        return context !== null && context.type === 'template' && (context.interpolationDepth || 0) > 0;
    }

    /**
     * Handles infinite loop prevention by forcing position advancement
     */
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

        // Force advance if we didn't move
        this.position++;
    }

    /**
     * Handles tokenization errors with recovery attempts
     */
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
                // Create a fallback token for the problematic content
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
                // If recovery failed, skip the problematic character
                this.position = startPos + 1;
            }
        } else {
            // Without fallback, just skip the problematic character
            this.position = startPos + 1;
        }
    }

    /**
     * Handles critical errors that prevent tokenization from continuing
     */
    private handleCriticalError(error: unknown, tokens: EnhancedToken[]): void {
        this.errorHandler.recordError({
            category: ErrorCategory.TOKENIZATION,
            severity: ErrorSeverity.CRITICAL,
            message: `Critical tokenization error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            position: this.position,
            originalError: error instanceof Error ? error : undefined,
            recoveryAction: 'Tokenization terminated early'
        });

        // If we have some tokens, return them; otherwise return empty array
        if (tokens.length === 0 && this.content.length > 0) {
            // Create a single fallback token containing all remaining content
            tokens.push({
                type: 'code',
                value: this.content,
                context: { type: 'code' },
                startPos: 0,
                endPos: this.content.length
            });
        }
    }

    /**
     * Enhanced string parsing with error recovery
     */
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
                    // Create a fallback string token
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

            // Fallback: treat as code token
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

    /**
     * Enhanced template string parsing with error recovery
     */
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
                    // Create a fallback template token
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

            // Fallback: treat as code token
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

    /**
     * Enhanced regex parsing with error recovery
     */
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
                    // Create a fallback regex token
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

            // Fallback: treat as code token (likely division operator)
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

    /**
     * Finds the end of a string using simple heuristics
     */
    private findStringEnd(startPos: number, quote: string): number {
        let pos = startPos + 1;
        while (pos < this.content.length) {
            const char = this.content[pos];
            if (char === quote) {
                return pos + 1;
            }
            if (char === '\n') {
                return pos; // Strings can't span lines
            }
            if (char === '\\') {
                pos += 2; // Skip escaped character
            } else {
                pos++;
            }
        }
        return this.content.length;
    }

    /**
     * Finds the end of a template literal using simple heuristics
     */
    private findTemplateEnd(startPos: number): number {
        let pos = startPos + 1;
        while (pos < this.content.length) {
            const char = this.content[pos];
            if (char === '`') {
                return pos + 1;
            }
            if (char === '\\') {
                pos += 2; // Skip escaped character
            } else {
                pos++;
            }
        }
        return this.content.length;
    }

    /**
     * Finds the end of a regex using simple heuristics
     */
    private findRegexEnd(startPos: number): number {
        let pos = startPos + 1;
        let inCharClass = false;
        
        while (pos < this.content.length) {
            const char = this.content[pos];
            
            if (char === '\n') {
                return pos; // Regex can't span lines
            }
            
            if (char === '\\') {
                pos += 2; // Skip escaped character
                continue;
            }
            
            if (char === '[' && !inCharClass) {
                inCharClass = true;
            } else if (char === ']' && inCharClass) {
                inCharClass = false;
            } else if (char === '/' && !inCharClass) {
                // Found end of regex, now consume flags
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

    /**
     * Validates tokenization result for accuracy and completeness
     */
    private validateTokenizationResult(originalLength: number, tokens: EnhancedToken[]): void {
        // Calculate total processed length
        let processedLength = 0;
        let lastEndPos = 0;
        
        for (const token of tokens) {
            processedLength += token.value.length;
            
            // Check for gaps or overlaps in token positions
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

        // Validate total length
        this.errorHandler.validateParsingCompletion(originalLength, processedLength, tokens.length);
        
        // Check for reasonable token distribution
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

    /**
     * Gets performance metrics from the last tokenization
     */
    public getPerformanceMetrics(): PerformanceMonitor {
        return this.performanceMonitor;
    }

    /**
     * Gets the error handler for external access to error information
     */
    getErrorHandler(): ErrorHandler {
        return this.errorHandler;
    }

    /**
     * Enables or disables fallback recovery mechanisms
     */
    setEnableFallback(enabled: boolean): void {
        this.enableFallback = enabled;
    }
}