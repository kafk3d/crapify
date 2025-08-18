export enum ExitCode {
    Success = 0,
    IssuesFound = 1,
    Error = 2
}

export interface CrapifyConfig {
    dryRun?: boolean;
    verbose?: boolean;
    quiet?: boolean;
    json?: boolean;
    exclude?: string[];
    include?: string[];
    force?: boolean;
}

export interface ToolConfig extends CrapifyConfig {
    [key: string]: any;
}

export interface FileStats {
    filesProcessed: number;
    itemsRemoved: number;
    itemsPreserved: number;
    errors: Array<{ file: string; error: string }>;
}

// Sophisticated types from original package
export interface CommentStats {
    filesProcessed: number;
    commentsRemoved: number;
    commentsPreserved: number;
    errors: Array<{ file: string; error: string }>;
}

export interface ProcessResult {
    content: string;
    modified: boolean;
    removed: number;
    preserved: number;
    errors?: any[];
    warnings?: string[];
    hasErrors?: boolean;
    hasCriticalErrors?: boolean;
    performanceMetrics?: any; 
}

export interface CommentPattern {
    start: string | RegExp;
    end?: string | RegExp;
    inline?: boolean;
}

export interface TokenContext {
    type: 'code' | 'string' | 'regex' | 'comment' | 'template';
    quote?: string;
    depth?: number;
    interpolationDepth?: number;
}

export interface EnhancedToken {
    type: 'string' | 'regex' | 'comment' | 'code';
    value: string;
    context: TokenContext;
    startPos: number;
    endPos: number;
}

export enum LexerState {
    CODE = 'code',
    SINGLE_STRING = 'single_string',
    DOUBLE_STRING = 'double_string',
    TEMPLATE_STRING = 'template_string',
    REGEX = 'regex',
    LINE_COMMENT = 'line_comment',
    BLOCK_COMMENT = 'block_comment',
    HTML_COMMENT = 'html_comment'
}

export enum CommentCategory {
    DEVELOPMENT = 'development',
    FRAMEWORK = 'framework', 
    TOOLING = 'tooling',
    DOCUMENTATION = 'documentation',
    CUSTOM = 'custom',
    REGULAR = 'regular'
}

export interface PreservationRule {
    name: string;
    pattern: RegExp;
    priority: number;
    description: string;
    category?: CommentCategory;
}