import { ErrorHandler, ErrorCategory, ErrorSeverity, ParseError } from '../error-handler';
import { Logger } from '@kafked/shared';

describe('ErrorHandler', () => {
    let errorHandler: ErrorHandler;
    let mockLogger: jest.Mocked<Logger>;

    beforeEach(() => {
        mockLogger = new Logger(false, false, false) as jest.Mocked<Logger>;
        mockLogger.info = jest.fn();
        mockLogger.success = jest.fn();
        mockLogger.error = jest.fn();
        mockLogger.warn = jest.fn();
        mockLogger.json = jest.fn();
        
        errorHandler = new ErrorHandler(mockLogger, true);
    });

    afterEach(() => {
        errorHandler.clear();
    });

    describe('Error Recording', () => {
        it('should record errors with all severity levels', () => {
            errorHandler.recordError({
                category: ErrorCategory.PARSING,
                severity: ErrorSeverity.LOW,
                message: 'Low severity error'
            });

            errorHandler.recordError({
                category: ErrorCategory.TOKENIZATION,
                severity: ErrorSeverity.CRITICAL,
                message: 'Critical error'
            });

            const errors = errorHandler.getErrors();
            expect(errors).toHaveLength(2);
            expect(errors[0].severity).toBe(ErrorSeverity.LOW);
            expect(errors[1].severity).toBe(ErrorSeverity.CRITICAL);
        });

        it('should log errors based on severity', () => {
            errorHandler.recordError({
                category: ErrorCategory.PARSING,
                severity: ErrorSeverity.CRITICAL,
                message: 'Critical error'
            });

            errorHandler.recordError({
                category: ErrorCategory.PARSING,
                severity: ErrorSeverity.MEDIUM,
                message: 'Medium error'
            });

            expect(mockLogger.error).toHaveBeenCalledWith('CRITICAL parsing: Critical error', undefined);
            expect(mockLogger.warn).toHaveBeenCalledWith('parsing: Medium error');
        });

        it('should record warnings', () => {
            errorHandler.recordWarning('Test warning');
            
            const warnings = errorHandler.getWarnings();
            expect(warnings).toContain('Test warning');
            expect(mockLogger.warn).toHaveBeenCalledWith('Test warning');
        });
    });

    describe('Error Recovery', () => {
        it('should recover from string parsing errors', () => {
            const content = 'const str = "unterminated string\nconst next = "complete";';
            const error: ParseError = {
                category: ErrorCategory.STRING_HANDLING,
                severity: ErrorSeverity.MEDIUM,
                message: 'Unterminated string',
                position: 12
            };

            const result = errorHandler.attemptRecovery(error, content, 12);
            
            expect(result.recovered).toBe(true);
            expect(result.fallbackUsed).toBe(true);
            expect(result.warnings).toContain('Attempting string parsing recovery');
        });

        it('should recover from template literal errors', () => {
            const content = 'const tmpl = `unterminated template\nconst next = `complete`;';
            const error: ParseError = {
                category: ErrorCategory.TEMPLATE_LITERAL,
                severity: ErrorSeverity.MEDIUM,
                message: 'Unterminated template',
                position: 13
            };

            const result = errorHandler.attemptRecovery(error, content, 13);
            
            expect(result.recovered).toBe(true);
            expect(result.fallbackUsed).toBe(true);
        });

        it('should recover from regex parsing errors', () => {
            const content = 'const regex = /unterminated[regex\nconst next = /complete/g;';
            const error: ParseError = {
                category: ErrorCategory.REGEX,
                severity: ErrorSeverity.MEDIUM,
                message: 'Unterminated regex',
                position: 14
            };

            const result = errorHandler.attemptRecovery(error, content, 14);
            
            expect(result.recovered).toBe(true);
            expect(result.fallbackUsed).toBe(true);
        });

        it('should recover from comment parsing errors', () => {
            const content = '/* unterminated comment\nconst code = true;';
            const error: ParseError = {
                category: ErrorCategory.COMMENT_DETECTION,
                severity: ErrorSeverity.MEDIUM,
                message: 'Unterminated comment',
                position: 0
            };

            const result = errorHandler.attemptRecovery(error, content, 0);
            
            expect(result.recovered).toBe(true);
            expect(result.fallbackUsed).toBe(true);
        });

        it('should handle recovery failures gracefully', () => {
            const errorHandler = new ErrorHandler(mockLogger, false); // Disable recovery
            
            const error: ParseError = {
                category: ErrorCategory.PARSING,
                severity: ErrorSeverity.MEDIUM,
                message: 'Test error',
                position: 0
            };

            const result = errorHandler.attemptRecovery(error, 'content', 0);
            
            expect(result.recovered).toBe(false);
            expect(result.fallbackUsed).toBe(false);
            expect(result.errors).toContain(error);
        });
    });

    describe('Utility Functions', () => {
        it('should calculate line and column correctly', () => {
            const content = 'line 1\nline 2\nline 3';
            const position = 10; // Position of 'e' in 'line 2'
            
            const { line, column } = errorHandler.calculateLineColumn(content, position);
            
            expect(line).toBe(2);
            expect(column).toBe(4);
        });

        it('should provide context around error position', () => {
            const content = 'This is a long piece of content with an error in the middle somewhere';
            const position = 35; // Position of 'error'
            
            const context = errorHandler.getContext(content, position, 10);
            
            expect(context).toContain('<<<ERROR>>>');
            expect(context).toContain('error');
        });

        it('should validate parsing completion', () => {
            // Valid scenario
            expect(errorHandler.validateParsingCompletion(100, 80, 10)).toBe(true);
            
            // Invalid scenario - too much content lost
            expect(errorHandler.validateParsingCompletion(100, 10, 5)).toBe(false);
            
            // Invalid scenario - no tokens processed
            expect(errorHandler.validateParsingCompletion(100, 100, 0)).toBe(false);
        });
    });

    describe('Error Analysis', () => {
        beforeEach(() => {
            // Add various errors for testing
            errorHandler.recordError({
                category: ErrorCategory.PARSING,
                severity: ErrorSeverity.LOW,
                message: 'Low parsing error'
            });
            
            errorHandler.recordError({
                category: ErrorCategory.PARSING,
                severity: ErrorSeverity.HIGH,
                message: 'High parsing error'
            });
            
            errorHandler.recordError({
                category: ErrorCategory.TOKENIZATION,
                severity: ErrorSeverity.CRITICAL,
                message: 'Critical tokenization error'
            });
        });

        it('should detect critical errors', () => {
            expect(errorHandler.hasCriticalErrors()).toBe(true);
        });

        it('should provide error summary', () => {
            const summary = errorHandler.getErrorSummary();
            
            expect(summary.total).toBe(3);
            expect(summary.bySeverity[ErrorSeverity.LOW]).toBe(1);
            expect(summary.bySeverity[ErrorSeverity.HIGH]).toBe(1);
            expect(summary.bySeverity[ErrorSeverity.CRITICAL]).toBe(1);
            expect(summary.byCategory[ErrorCategory.PARSING]).toBe(2);
            expect(summary.byCategory[ErrorCategory.TOKENIZATION]).toBe(1);
        });

        it('should clear errors and warnings', () => {
            errorHandler.recordWarning('Test warning');
            
            expect(errorHandler.getErrors()).toHaveLength(3);
            expect(errorHandler.getWarnings()).toHaveLength(1);
            
            errorHandler.clear();
            
            expect(errorHandler.getErrors()).toHaveLength(0);
            expect(errorHandler.getWarnings()).toHaveLength(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty content gracefully', () => {
            const { line, column } = errorHandler.calculateLineColumn('', 0);
            expect(line).toBe(1);
            expect(column).toBe(1);
        });

        it('should handle position beyond content length', () => {
            const content = 'short';
            const { line, column } = errorHandler.calculateLineColumn(content, 100);
            expect(line).toBe(1);
            expect(column).toBe(6); // After the last character
        });

        it('should handle context at content boundaries', () => {
            const content = 'short';
            
            // Context at start
            const startContext = errorHandler.getContext(content, 0, 10);
            expect(startContext).toContain('<<<ERROR>>>');
            
            // Context at end
            const endContext = errorHandler.getContext(content, content.length - 1, 10);
            expect(endContext).toContain('<<<ERROR>>>');
        });
    });
});