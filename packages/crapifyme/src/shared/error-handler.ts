import { Logger } from './logger';

export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

export enum ErrorCategory {
    PARSING = 'parsing',
    TOKENIZATION = 'tokenization',
    REGEX = 'regex',
    STRING_HANDLING = 'string_handling',
    TEMPLATE_LITERAL = 'template_literal',
    COMMENT_DETECTION = 'comment_detection',
    PRESERVATION = 'preservation',
    FILE_PROCESSING = 'file_processing'
}

export interface ParseError {
    category: ErrorCategory;
    severity: ErrorSeverity;
    message: string;
    position?: number;
    line?: number;
    column?: number;
    context?: string;
    recoveryAction?: string;
    originalError?: Error;
}

export interface ErrorRecoveryResult {
    recovered: boolean;
    fallbackUsed: boolean;
    errors: ParseError[];
    warnings: string[];
}

export class ErrorHandler {
    private errors: ParseError[] = [];
    private warnings: string[] = [];
    private logger: Logger;
    private enableRecovery: boolean;

    constructor(logger?: Logger, enableRecovery: boolean = true) {
        this.logger = logger || new Logger(false, false, false);
        this.enableRecovery = enableRecovery;
    }

    recordError(error: Partial<ParseError> & { category: ErrorCategory; message: string }): void {
        const fullError: ParseError = {
            severity: ErrorSeverity.MEDIUM,
            position: undefined,
            line: undefined,
            column: undefined,
            context: undefined,
            recoveryAction: undefined,
            originalError: undefined,
            ...error
        };

        this.errors.push(fullError);
        
        switch (fullError.severity) {
            case ErrorSeverity.CRITICAL:
                this.logger.error(`CRITICAL ${fullError.category}: ${fullError.message}`, fullError.originalError);
                break;
            case ErrorSeverity.HIGH:
                this.logger.error(`${fullError.category}: ${fullError.message}`, fullError.originalError);
                break;
            case ErrorSeverity.MEDIUM:
                this.logger.warn(`${fullError.category}: ${fullError.message}`);
                break;
            case ErrorSeverity.LOW:
                this.logger.info(`${fullError.category}: ${fullError.message}`);
                break;
        }
    }

    recordWarning(message: string): void {
        this.warnings.push(message);
        this.logger.warn(message);
    }

    attemptRecovery(error: ParseError, content: string, position: number): ErrorRecoveryResult {
        if (!this.enableRecovery) {
            return {
                recovered: false,
                fallbackUsed: false,
                errors: [error],
                warnings: []
            };
        }

        const recoveryResult: ErrorRecoveryResult = {
            recovered: false,
            fallbackUsed: false,
            errors: [],
            warnings: []
        };

        try {
            switch (error.category) {
                case ErrorCategory.STRING_HANDLING:
                    return this.recoverFromStringError(error, content, position);
                
                case ErrorCategory.TEMPLATE_LITERAL:
                    return this.recoverFromTemplateError(error, content, position);
                
                case ErrorCategory.REGEX:
                    return this.recoverFromRegexError(error, content, position);
                
                case ErrorCategory.COMMENT_DETECTION:
                    return this.recoverFromCommentError(error, content, position);
                
                case ErrorCategory.TOKENIZATION:
                    return this.recoverFromTokenizationError(error, content, position);
                
                default:
                    return this.recoverFromGenericError(error, content, position);
            }
        } catch (recoveryError) {
            recoveryResult.errors.push({
                category: ErrorCategory.PARSING,
                severity: ErrorSeverity.HIGH,
                message: `Recovery attempt failed: ${recoveryError instanceof Error ? recoveryError.message : 'Unknown error'}`,
                position,
                originalError: recoveryError instanceof Error ? recoveryError : undefined
            });
            return recoveryResult;
        }
    }

    private recoverFromStringError(error: ParseError, content: string, position: number): ErrorRecoveryResult {
        const result: ErrorRecoveryResult = {
            recovered: false,
            fallbackUsed: true,
            errors: [],
            warnings: ['Attempting string parsing recovery']
        };

        const quote = this.detectQuoteType(content, position);
        if (quote) {
            const nextQuote = content.indexOf(quote, position + 1);
            if (nextQuote !== -1) {
                result.recovered = true;
                result.warnings.push(`Recovered unterminated string by finding next ${quote} at position ${nextQuote}`);
                return result;
            }
        }

        const nextNewline = content.indexOf('\n', position);
        if (nextNewline !== -1) {
            result.recovered = true;
            result.warnings.push(`Recovered unterminated string by ending at line break at position ${nextNewline}`);
            return result;
        }

        result.recovered = true;
        result.warnings.push('Recovered unterminated string by ending at end of content');
        return result;
    }

    private recoverFromTemplateError(error: ParseError, content: string, position: number): ErrorRecoveryResult {
        const result: ErrorRecoveryResult = {
            recovered: false,
            fallbackUsed: true,
            errors: [],
            warnings: ['Attempting template literal recovery']
        };

        const nextBacktick = content.indexOf('`', position + 1);
        if (nextBacktick !== -1) {
            result.recovered = true;
            result.warnings.push(`Recovered unterminated template literal by finding next backtick at position ${nextBacktick}`);
            return result;
        }

        const nextQuote = this.findNextQuote(content, position + 1);
        if (nextQuote !== -1) {
            result.recovered = true;
            result.warnings.push(`Recovered template literal by treating as string ending at position ${nextQuote}`);
            return result;
        }

        result.recovered = true;
        result.warnings.push('Recovered template literal by ending at end of content');
        return result;
    }

    private recoverFromRegexError(error: ParseError, content: string, position: number): ErrorRecoveryResult {
        const result: ErrorRecoveryResult = {
            recovered: false,
            fallbackUsed: true,
            errors: [],
            warnings: ['Attempting regex parsing recovery']
        };

        let i = position + 1;
        while (i < content.length) {
            if (content[i] === '/' && (i === 0 || content[i - 1] !== '\\')) {
                result.recovered = true;
                result.warnings.push(`Recovered unterminated regex by finding next unescaped / at position ${i}`);
                return result;
            }
            i++;
        }

        i = position + 1;
        while (i < content.length && !/[\s;,)}]/.test(content[i])) {
            i++;
        }
        
        if (i < content.length) {
            result.recovered = true;
            result.warnings.push(`Recovered regex by ending at whitespace/operator at position ${i}`);
            return result;
        }

        result.recovered = true;
        result.warnings.push('Recovered regex by ending at end of content');
        return result;
    }

    private recoverFromCommentError(error: ParseError, content: string, position: number): ErrorRecoveryResult {
        const result: ErrorRecoveryResult = {
            recovered: false,
            fallbackUsed: true,
            errors: [],
            warnings: ['Attempting comment parsing recovery']
        };

        if (content.substring(position, position + 2) === '/*') {
            const endComment = content.indexOf('*/', position + 2);
            if (endComment !== -1) {
                result.recovered = true;
                result.warnings.push(`Recovered unterminated block comment by finding */ at position ${endComment}`);
                return result;
            }
        }

        if (content.substring(position, position + 2) === '//') {
            const nextNewline = content.indexOf('\n', position);
            if (nextNewline !== -1) {
                result.recovered = true;
                result.warnings.push(`Recovered line comment by finding newline at position ${nextNewline}`);
                return result;
            }
        }

        if (content.substring(position, position + 4) === '<!--') {
            const endComment = content.indexOf('-->', position + 4);
            if (endComment !== -1) {
                result.recovered = true;
                result.warnings.push(`Recovered unterminated HTML comment by finding --> at position ${endComment}`);
                return result;
            }
        }

        result.recovered = true;
        result.warnings.push('Recovered comment by ending at end of content');
        return result;
    }

    private recoverFromTokenizationError(error: ParseError, content: string, position: number): ErrorRecoveryResult {
        const result: ErrorRecoveryResult = {
            recovered: true,
            fallbackUsed: true,
            errors: [],
            warnings: ['Recovered from tokenization error by skipping problematic character']
        };

        return result;
    }

    private recoverFromGenericError(error: ParseError, content: string, position: number): ErrorRecoveryResult {
        const result: ErrorRecoveryResult = {
            recovered: true,
            fallbackUsed: true,
            errors: [],
            warnings: ['Applied generic recovery strategy']
        };

        return result;
    }

    private detectQuoteType(content: string, position: number): string | null {
        if (position >= content.length) return null;
        
        const char = content[position];
        if (char === '"' || char === "'" || char === '`') {
            return char;
        }
        
        return null;
    }

    private findNextQuote(content: string, startPosition: number): number {
        for (let i = startPosition; i < content.length; i++) {
            const char = content[i];
            if (char === '"' || char === "'" || char === '`') {
                return i;
            }
        }
        return -1;
    }

    calculateLineColumn(content: string, position: number): { line: number; column: number } {
        let line = 1;
        let column = 1;
        
        for (let i = 0; i < position && i < content.length; i++) {
            if (content[i] === '\n') {
                line++;
                column = 1;
            } else {
                column++;
            }
        }
        
        return { line, column };
    }

    getContext(content: string, position: number, contextSize: number = 50): string {
        const start = Math.max(0, position - contextSize);
        const end = Math.min(content.length, position + contextSize);
        const context = content.substring(start, end);
        
        const relativePos = position - start;
        return context.substring(0, relativePos) + '<<<ERROR>>>' + context.substring(relativePos);
    }

    validateParsingCompletion(originalLength: number, processedLength: number, tokensProcessed: number): boolean {
        const lengthDifference = Math.abs(originalLength - processedLength);
        const maxAllowedDifference = originalLength * 0.5; 
        
        if (lengthDifference > maxAllowedDifference) {
            this.recordError({
                category: ErrorCategory.PARSING,
                severity: ErrorSeverity.HIGH,
                message: `Significant content length difference detected: original=${originalLength}, processed=${processedLength}, difference=${lengthDifference}`
            });
            return false;
        }

        if (tokensProcessed === 0 && originalLength > 0) {
            this.recordError({
                category: ErrorCategory.TOKENIZATION,
                severity: ErrorSeverity.CRITICAL,
                message: 'No tokens were processed despite non-empty input'
            });
            return false;
        }

        return true;
    }

    getErrors(): ParseError[] {
        return [...this.errors];
    }

    getWarnings(): string[] {
        return [...this.warnings];
    }

    hasCriticalErrors(): boolean {
        return this.errors.some(error => error.severity === ErrorSeverity.CRITICAL);
    }

    getErrorSummary(): { total: number; bySeverity: Record<ErrorSeverity, number>; byCategory: Record<ErrorCategory, number> } {
        const bySeverity = {
            [ErrorSeverity.LOW]: 0,
            [ErrorSeverity.MEDIUM]: 0,
            [ErrorSeverity.HIGH]: 0,
            [ErrorSeverity.CRITICAL]: 0
        };

        const byCategory = {
            [ErrorCategory.PARSING]: 0,
            [ErrorCategory.TOKENIZATION]: 0,
            [ErrorCategory.REGEX]: 0,
            [ErrorCategory.STRING_HANDLING]: 0,
            [ErrorCategory.TEMPLATE_LITERAL]: 0,
            [ErrorCategory.COMMENT_DETECTION]: 0,
            [ErrorCategory.PRESERVATION]: 0,
            [ErrorCategory.FILE_PROCESSING]: 0
        };

        this.errors.forEach(error => {
            bySeverity[error.severity]++;
            byCategory[error.category]++;
        });

        return {
            total: this.errors.length,
            bySeverity,
            byCategory
        };
    }

    clear(): void {
        this.errors = [];
        this.warnings = [];
    }
}