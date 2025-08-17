import { ExitCode, Logger, loadConfig, findFiles, readFile, writeFile, createFilePatterns } from '@kafked/shared';
import { CommentRemover } from './comment-remover';
import { CommentStats } from './types';


export { 
    BasePreservationRule,
    FrameworkPreservationRule,
    DevelopmentPreservationRule,
    ToolingPreservationRule,
    DocumentationPreservationRule,
    CustomPreservationRule
} from './preservation-rules';
export { PreservationRuleManager, CommentClassification } from './rule-manager';
export { CommentCategory, PreservationRule } from './types';

export interface CrapifyCommentsOptions {
    keep?: string;
    extensions?: string;
    exclude?: string;
    dryRun?: boolean;
    verbose?: boolean;
    quiet?: boolean;
    json?: boolean;
    useEnhancedTokenizer?: boolean;
    
    preserveFramework?: boolean;
    preserveDevelopment?: boolean;
    preserveTooling?: boolean;
    preserveDocumentation?: boolean;
    customRules?: string;
    rulePriority?: number;
}

export class CrapifyComments {
    private logger: Logger;
    private remover: CommentRemover;
    private options: CrapifyCommentsOptions;
    private stats: CommentStats = {
        filesProcessed: 0,
        commentsRemoved: 0,
        commentsPreserved: 0,
        errors: []
    };

    constructor(options: CrapifyCommentsOptions) {
        const config = loadConfig('comments');
        const mergedOptions = { ...config, ...options };
        if (Array.isArray(mergedOptions.exclude)) {
            mergedOptions.exclude = mergedOptions.exclude.join(',');
        }
        this.options = mergedOptions as CrapifyCommentsOptions;
        this.logger = new Logger(
            this.options.verbose,
            this.options.quiet,
            this.options.json
        );

        const keepPatterns = this.options.keep?.split(',').map(p => p.trim()) || [];
        const customRules = this.options.customRules?.split(',').map(p => p.trim()).filter(Boolean) || [];
        
        this.remover = new CommentRemover(keepPatterns, {
            useEnhancedTokenizer: this.options.useEnhancedTokenizer,
            preserveFramework: this.options.preserveFramework,
            preserveDevelopment: this.options.preserveDevelopment,
            preserveTooling: this.options.preserveTooling,
            preserveDocumentation: this.options.preserveDocumentation,
            customRules,
            rulePriority: this.options.rulePriority
        });
    }

    async execute(paths: string[]): Promise<ExitCode> {
        try {
            const extensions = this.options.extensions?.split(',').map(e => e.trim()) || [];
            const patterns = createFilePatterns(paths, extensions);
            const excludePatterns = this.options.exclude?.split(',').map(p => p.trim()).filter(Boolean) || [];
            
            if (this.options.verbose) {
                this.logger.info(`Search patterns: ${patterns.join(', ')}`);
                if (excludePatterns.length > 0) {
                    this.logger.info(`Exclude patterns: ${excludePatterns.join(', ')}`);
                }
            }
            
            const files = await findFiles(patterns, excludePatterns);

            if (files.length === 0) {
                this.logger.warn('No files found to process');
                this.logger.info(`Searched in: ${paths.join(', ')}`);
                this.logger.info(`Extensions: ${extensions.join(', ')}`);
                return ExitCode.Success;
            }

            if (!this.options.quiet) {
                this.logger.info(`Found ${files.length} file${files.length === 1 ? '' : 's'} to process`);
                
                
                const preservationInfo = this.getPreservationInfo();
                this.logger.info(`Preservation rules: ${preservationInfo}`);
                
                if (this.options.keep) {
                    this.logger.info(`Legacy keep patterns: ${this.options.keep}`);
                }
                
                if (this.options.dryRun) {
                    this.logger.info('DRY RUN - No files will be modified');
                }
                console.log('');
            }

            for (const file of files) {
                await this.processFile(file);
            }

            this.outputResults();

            return this.determineExitCode();
        } catch (error) {
            this.logger.error('Fatal error', error as Error);
            return ExitCode.Error;
        }
    }

    private async processFile(filePath: string): Promise<void> {
        try {
            const content = await readFile(filePath);
            const result = this.remover.removeComments(content, filePath);

            if (result.modified && !this.options.dryRun) {
                await writeFile(filePath, result.content);
            }

            this.stats.filesProcessed++;
            this.stats.commentsRemoved += result.removed;
            this.stats.commentsPreserved += result.preserved;

            if (!this.options.quiet) {
                if (result.modified) {
                    this.logger.success(`${filePath}`);
                    console.log(`  ┣ Comments removed: ${result.removed}`);
                    console.log(`  ┣ Comments preserved: ${result.preserved}`);
                    if (this.options.dryRun) {
                        console.log(`  ┗ Status: DRY RUN - would be modified`);
                    } else {
                        console.log(`  ┗ Status: Modified`);
                    }
                } else if (this.options.verbose) {
                    this.logger.info(`${filePath} - No comments found`);
                }
            }
        } catch (error) {
            this.stats.errors.push({ file: filePath, error: (error as Error).message });
            this.logger.error(`Failed to process ${filePath}`, error as Error);
            if (this.options.verbose) {
                console.log(`  ┗ Error: ${(error as Error).message}`);
            }
        }
    }

    private outputResults(): void {
        if (this.options.json) {
            this.logger.json(this.stats);
            return;
        }

        if (this.options.quiet) return;

        console.log('');
        console.log('█▀▀ █▀█ █▀▄▀█ █▀█ █   █▀▀ ▀█▀ █▀▀');
        console.log('█▄▄ █▄█ █░▀░█ █▀▀ █▄▄ ██▄ ░█░ ██▄');
        console.log('');

        if (this.stats.errors.length > 0) {
            this.logger.error(`Processing completed with ${this.stats.errors.length} error${this.stats.errors.length === 1 ? '' : 's'}`);
            if (this.options.verbose) {
                this.stats.errors.forEach(err => {
                    console.log(`  • ${err.file}: ${err.error}`);
                });
            }
        } else {
            this.logger.success('Processing completed successfully');
        }

        const filesModified = this.stats.commentsRemoved > 0 ? 'with changes' : 'no changes needed';
        this.logger.info(`Files processed: ${this.stats.filesProcessed} (${filesModified})`);
        this.logger.info(`Comments removed: ${this.stats.commentsRemoved}`);
        this.logger.info(`Comments preserved: ${this.stats.commentsPreserved}`);

        if (this.options.dryRun && this.stats.commentsRemoved > 0) {
            this.logger.warn('DRY RUN MODE - No files were actually modified');
            this.logger.info('Remove --dry-run to apply changes');
        }
    }

    private getPreservationInfo(): string {
        const activeCategories = [];
        
        if (this.options.preserveFramework !== false) {
            activeCategories.push('Framework');
        }
        if (this.options.preserveDevelopment !== false) {
            activeCategories.push('Development');
        }
        if (this.options.preserveTooling !== false) {
            activeCategories.push('Tooling');
        }
        if (this.options.preserveDocumentation !== false) {
            activeCategories.push('Documentation');
        }
        
        if (this.options.customRules) {
            const customCount = this.options.customRules.split(',').filter(Boolean).length;
            if (customCount > 0) {
                activeCategories.push(`Custom (${customCount})`);
            }
        }
        
        return activeCategories.length > 0 ? activeCategories.join(', ') : 'None';
    }

    private determineExitCode(): ExitCode {
        if (this.stats.errors.length > 0) return ExitCode.Error;
        if (this.stats.commentsRemoved > 0) return ExitCode.IssuesFound;
        return ExitCode.Success;
    }
}