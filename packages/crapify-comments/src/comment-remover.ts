import path from 'path';
import { ProcessResult, CommentCategory } from './types';
import { EnhancedTokenizer } from './enhanced-tokenizer';
import { PreservationRuleManager } from './rule-manager';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from './error-handler';
import { Logger } from '@kafked/shared';
import { PerformanceMonitor, OptimizedStringBuilder } from './performance-monitor';

interface Token {
    type: 'string' | 'comment' | 'code';
    value: string;
}

interface CommentRemoverOptions {
    useEnhancedTokenizer?: boolean;
    logger?: Logger;
    preserveFramework?: boolean;
    preserveDevelopment?: boolean;
    preserveTooling?: boolean;
    preserveDocumentation?: boolean;
    customRules?: string[];
    rulePriority?: number;
}

export class CommentRemover {
    private readonly keepPatterns: string[];
    private readonly enhancedTokenizer: EnhancedTokenizer;
    private readonly ruleManager: PreservationRuleManager;
    private readonly useEnhancedTokenizer: boolean;
    private readonly errorHandler: ErrorHandler;
    private readonly logger: Logger;
    private readonly performanceMonitor: PerformanceMonitor;

    constructor(keepPatterns: string[], options: CommentRemoverOptions = {}) {
        this.keepPatterns = keepPatterns.filter(p => p.trim().length > 0);
        this.logger = options.logger || new Logger(false, false, false);
        this.errorHandler = new ErrorHandler(this.logger, true);
        this.enhancedTokenizer = new EnhancedTokenizer(this.logger);
        this.ruleManager = new PreservationRuleManager();
        this.useEnhancedTokenizer = options.useEnhancedTokenizer !== false; 
        this.performanceMonitor = new PerformanceMonitor(this.logger);
        
        
        this.configurePreservationRules(options);
        
        
        this.addCustomPatterns();
    }


    removeComments(content: string, filePath: string): ProcessResult {
        const extension = this.getFileExtension(filePath);
        this.errorHandler.clear();
        
        try {
            
            if (this.useEnhancedTokenizer) {
                const result = this.removeCommentsWithEnhancedTokenizer(content, filePath);
                return this.enhanceResultWithErrorInfo(result, filePath);
            } else {
                const result = this.removeCommentsWithLegacyTokenizer(content, extension);
                return this.enhanceResultWithErrorInfo(result, filePath);
            }
        } catch (error) {
            
            this.errorHandler.recordError({
                category: ErrorCategory.FILE_PROCESSING,
                severity: ErrorSeverity.CRITICAL,
                message: `Critical error processing file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                originalError: error instanceof Error ? error : undefined
            });

            
            this.logger.warn(`Enhanced tokenizer failed for ${filePath}, falling back to legacy tokenizer`);
            
            try {
                const result = this.removeCommentsWithLegacyTokenizer(content, extension);
                return this.enhanceResultWithErrorInfo(result, filePath);
            } catch (fallbackError) {
                
                this.errorHandler.recordError({
                    category: ErrorCategory.FILE_PROCESSING,
                    severity: ErrorSeverity.CRITICAL,
                    message: `Fallback tokenizer also failed for ${filePath}: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`,
                    originalError: fallbackError instanceof Error ? fallbackError : undefined
                });

                return this.createFailsafeResult(content, filePath);
            }
        }
    }

    
    private removeCommentsWithEnhancedTokenizer(content: string, filePath: string): ProcessResult {
        try {
            
            this.performanceMonitor.startMonitoring();
            
            const tokens = this.enhancedTokenizer.tokenize(content);
            
            
            const useOptimizedBuilder = content.length > 100000; 
            const result = useOptimizedBuilder ? new OptimizedStringBuilder() : [];
            let removed = 0;
            let preserved = 0;

            for (const token of tokens) {
                if (token.type === 'comment') {
                    try {
                        if (this.shouldPreserveCommentEnhanced(token.value)) {
                            if (useOptimizedBuilder) {
                                (result as OptimizedStringBuilder).append(token.value);
                            } else {
                                (result as string[]).push(token.value);
                            }
                            preserved++;
                        } else {
                            removed++;
                            
                        }
                    } catch (preservationError) {
                        
                        this.errorHandler.recordError({
                            category: ErrorCategory.PRESERVATION,
                            severity: ErrorSeverity.MEDIUM,
                            message: `Error in comment preservation logic: ${preservationError instanceof Error ? preservationError.message : 'Unknown error'}`,
                            position: token.startPos,
                            originalError: preservationError instanceof Error ? preservationError : undefined
                        });
                        
                        if (useOptimizedBuilder) {
                            (result as OptimizedStringBuilder).append(token.value);
                        } else {
                            (result as string[]).push(token.value);
                        }
                        preserved++;
                    }
                } else {
                    if (useOptimizedBuilder) {
                        (result as OptimizedStringBuilder).append(token.value);
                    } else {
                        (result as string[]).push(token.value);
                    }
                }
            }

            const processedContent = useOptimizedBuilder 
                ? (result as OptimizedStringBuilder).toString()
                : (result as string[]).join('');
            
            
            const metrics = this.performanceMonitor.stopMonitoring(tokens.length, content.length);
            
            
            this.validateProcessingResult(content, processedContent, tokens.length, filePath);
            
            return {
                content: processedContent,
                modified: content !== processedContent,
                removed,
                preserved,
                performanceMetrics: metrics
            };
        } catch (error) {
            this.errorHandler.recordError({
                category: ErrorCategory.FILE_PROCESSING,
                severity: ErrorSeverity.HIGH,
                message: `Enhanced tokenizer processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                originalError: error instanceof Error ? error : undefined
            });
            throw error; 
        }
    }

    
    private removeCommentsWithLegacyTokenizer(content: string, extension: string): ProcessResult {
        try {
            const tokens = this.tokenizeWithErrorHandling(content, extension);
            const result: string[] = [];
            let removed = 0;
            let preserved = 0;

            for (const token of tokens) {
                if (token.type === 'comment') {
                    try {
                        if (this.shouldPreserveComment(token.value)) {
                            result.push(token.value);
                            preserved++;
                        } else {
                            removed++;
                            
                        }
                    } catch (preservationError) {
                        
                        this.errorHandler.recordError({
                            category: ErrorCategory.PRESERVATION,
                            severity: ErrorSeverity.MEDIUM,
                            message: `Error in legacy comment preservation logic: ${preservationError instanceof Error ? preservationError.message : 'Unknown error'}`,
                            originalError: preservationError instanceof Error ? preservationError : undefined
                        });
                        
                        result.push(token.value);
                        preserved++;
                    }
                } else {
                    result.push(token.value);
                }
            }

            const processedContent = result.join('');
            
            
            this.validateProcessingResult(content, processedContent, tokens.length, extension);
            
            return {
                content: processedContent,
                modified: content !== processedContent,
                removed,
                preserved
            };
        } catch (error) {
            this.errorHandler.recordError({
                category: ErrorCategory.FILE_PROCESSING,
                severity: ErrorSeverity.HIGH,
                message: `Legacy tokenizer processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                originalError: error instanceof Error ? error : undefined
            });
            throw error; 
        }
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

    
    private shouldPreserveCommentEnhanced(comment: string): boolean {
        
        if (this.ruleManager.shouldPreserveComment(comment)) {
            return true;
        }

        
        return this.shouldPreserveComment(comment);
    }

    
    private shouldPreserveComment(comment: string): boolean {
        if (this.keepPatterns.length === 0) return false;
        
        return this.keepPatterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            return regex.test(comment);
        });
    }

    
    private configurePreservationRules(options: CommentRemoverOptions): void {
        
        if (options.preserveFramework === false) {
            this.ruleManager.getRulesByCategory(CommentCategory.FRAMEWORK).forEach(rule => {
                this.ruleManager.removeRule(rule.name);
            });
        }
        
        if (options.preserveDevelopment === false) {
            this.ruleManager.getRulesByCategory(CommentCategory.DEVELOPMENT).forEach(rule => {
                this.ruleManager.removeRule(rule.name);
            });
        }
        
        if (options.preserveTooling === false) {
            this.ruleManager.getRulesByCategory(CommentCategory.TOOLING).forEach(rule => {
                this.ruleManager.removeRule(rule.name);
            });
        }
        
        if (options.preserveDocumentation === false) {
            this.ruleManager.getRulesByCategory(CommentCategory.DOCUMENTATION).forEach(rule => {
                this.ruleManager.removeRule(rule.name);
            });
        }
        
        
        if (options.customRules && options.customRules.length > 0) {
            const priority = options.rulePriority || 100;
            options.customRules.forEach((pattern, index) => {
                try {
                    this.ruleManager.addCustomPattern(
                        `cli-custom-pattern-${index}`,
                        pattern,
                        priority
                    );
                } catch (error) {
                    console.warn(`Invalid custom regex pattern ignored: ${pattern}`);
                }
            });
        }
    }

    
    private addCustomPatterns(): void {
        this.keepPatterns.forEach((pattern, index) => {
            try {
                this.ruleManager.addCustomPattern(
                    `custom-pattern-${index}`,
                    pattern,
                    50 
                );
            } catch (error) {
                
                console.warn(`Invalid regex pattern ignored: ${pattern}`);
            }
        });
    }

    
    public getRuleManager(): PreservationRuleManager {
        return this.ruleManager;
    }

    
    public setUseEnhancedTokenizer(enabled: boolean): void {
        (this as any).useEnhancedTokenizer = enabled;
    }

    
    private enhanceResultWithErrorInfo(result: ProcessResult, filePath: string): ProcessResult {
        const tokenizerErrors = this.enhancedTokenizer.getErrorHandler().getErrors();
        const allErrors = [...this.errorHandler.getErrors(), ...tokenizerErrors];
        
        
        const enhancedResult = {
            ...result,
            errors: allErrors,
            warnings: [...this.errorHandler.getWarnings(), ...this.enhancedTokenizer.getErrorHandler().getWarnings()],
            hasErrors: allErrors.length > 0,
            hasCriticalErrors: allErrors.some(error => error.severity === ErrorSeverity.CRITICAL)
        };

        
        if (allErrors.length > 0) {
            const errorSummary = this.getErrorSummary(allErrors);
            this.logger.warn(`File ${filePath} processed with ${errorSummary.total} errors: ${JSON.stringify(errorSummary.bySeverity)}`);
        }

        return enhancedResult;
    }

    
    private createFailsafeResult(content: string, filePath: string): ProcessResult {
        this.logger.error(`All parsing methods failed for ${filePath}, returning original content`);
        
        return {
            content,
            modified: false,
            removed: 0,
            preserved: 0,
            errors: this.errorHandler.getErrors(),
            warnings: this.errorHandler.getWarnings(),
            hasErrors: true,
            hasCriticalErrors: this.errorHandler.hasCriticalErrors()
        };
    }





    
    private tokenizeWithErrorHandling(content: string, extension: string): Token[] {
        try {
            return this.tokenize(content, extension);
        } catch (error) {
            this.errorHandler.recordError({
                category: ErrorCategory.TOKENIZATION,
                severity: ErrorSeverity.HIGH,
                message: `Legacy tokenization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                originalError: error instanceof Error ? error : undefined
            });

            
            return [{
                type: 'code',
                value: content
            }];
        }
    }

    
    private validateProcessingResult(originalContent: string, processedContent: string, tokensProcessed: number, context: string): void {
        
        const originalLength = originalContent.length;
        const processedLength = processedContent.length;
        const lengthDifference = originalLength - processedLength;
        
        
        const maxAllowedRemoval = originalLength * 0.8;
        
        if (lengthDifference > maxAllowedRemoval) {
            this.errorHandler.recordError({
                category: ErrorCategory.FILE_PROCESSING,
                severity: ErrorSeverity.HIGH,
                message: `Excessive content removal detected in ${context}: removed ${lengthDifference}/${originalLength} characters (${Math.round(lengthDifference/originalLength*100)}%)`,
            });
        }

        
        if (tokensProcessed === 0 && originalLength > 0) {
            this.errorHandler.recordError({
                category: ErrorCategory.TOKENIZATION,
                severity: ErrorSeverity.HIGH,
                message: `No tokens processed for non-empty content in ${context}`,
            });
        }

        
        if (processedContent.includes('\uFFFD')) {
            this.errorHandler.recordError({
                category: ErrorCategory.FILE_PROCESSING,
                severity: ErrorSeverity.MEDIUM,
                message: `Potential encoding issues detected in processed content for ${context}`,
            });
        }
    }

    
    private getErrorSummary(errors: any[]): { total: number; bySeverity: Record<string, number> } {
        const bySeverity: Record<string, number> = {
            [ErrorSeverity.LOW]: 0,
            [ErrorSeverity.MEDIUM]: 0,
            [ErrorSeverity.HIGH]: 0,
            [ErrorSeverity.CRITICAL]: 0
        };

        errors.forEach(error => {
            if (error.severity && bySeverity.hasOwnProperty(error.severity)) {
                bySeverity[error.severity]++;
            }
        });

        return {
            total: errors.length,
            bySeverity
        };
    }

    
    public getErrorHandler(): ErrorHandler {
        return this.errorHandler;
    }

    
    public getProcessingStats(): {
        errors: any[];
        warnings: string[];
        errorSummary: { total: number; bySeverity: Record<string, number>; byCategory: Record<string, number> };
        hasErrors: boolean;
        hasCriticalErrors: boolean;
    } {
        const tokenizerErrors = this.enhancedTokenizer.getErrorHandler().getErrors();
        const allErrors = [...this.errorHandler.getErrors(), ...tokenizerErrors];
        const allWarnings = [...this.errorHandler.getWarnings(), ...this.enhancedTokenizer.getErrorHandler().getWarnings()];
        
        return {
            errors: allErrors,
            warnings: allWarnings,
            errorSummary: this.getErrorSummaryDetailed(allErrors),
            hasErrors: allErrors.length > 0,
            hasCriticalErrors: allErrors.some(error => error.severity === ErrorSeverity.CRITICAL)
        };
    }

    
    private getErrorSummaryDetailed(errors: any[]): { total: number; bySeverity: Record<string, number>; byCategory: Record<string, number> } {
        const bySeverity: Record<string, number> = {
            [ErrorSeverity.LOW]: 0,
            [ErrorSeverity.MEDIUM]: 0,
            [ErrorSeverity.HIGH]: 0,
            [ErrorSeverity.CRITICAL]: 0
        };

        const byCategory: Record<string, number> = {
            [ErrorCategory.PARSING]: 0,
            [ErrorCategory.TOKENIZATION]: 0,
            [ErrorCategory.REGEX]: 0,
            [ErrorCategory.STRING_HANDLING]: 0,
            [ErrorCategory.TEMPLATE_LITERAL]: 0,
            [ErrorCategory.COMMENT_DETECTION]: 0,
            [ErrorCategory.PRESERVATION]: 0,
            [ErrorCategory.FILE_PROCESSING]: 0
        };

        errors.forEach(error => {
            if (error.severity && bySeverity.hasOwnProperty(error.severity)) {
                bySeverity[error.severity]++;
            }
            if (error.category && byCategory.hasOwnProperty(error.category)) {
                byCategory[error.category]++;
            }
        });

        return {
            total: errors.length,
            bySeverity,
            byCategory
        };
    }
}