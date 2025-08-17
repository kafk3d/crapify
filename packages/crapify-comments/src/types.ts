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
}

export interface CommentPattern {
    start: string | RegExp;
    end?: string | RegExp;
    inline?: boolean;
}