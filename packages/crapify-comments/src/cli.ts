#!/usr/bin/env node
import { Command } from 'commander';
import { CrapifyComments } from './index';
import { showBanner, detectVersionControl } from '@kafked/shared';
import * as pkg from '../package.json';

showBanner();

const program = new Command();

program
    .name('crapify-comments')
    .description('Remove code comments while preserving important ones')
    .version(pkg.version)
    .addHelpText('after', `
Examples:
  $ crapify-comments src/                    # Process all files in src/
  $ crapify-comments --dry-run .            # Preview changes without modifying files
  $ crapify-comments --force                # Proceed without version control
  $ crapify-comments --no-preserve-framework # Disable framework comment preservation
  $ crapify-comments --custom-rules "api,config" # Add custom preservation patterns
  $ crapify-comments --legacy-tokenizer     # Use legacy parsing (less accurate)

Preservation Categories:
  Framework:     Svelte, Vue, React, TypeScript, Webpack directives
  Development:   TODO, FIXME, HACK, NOTE, XXX, BUG, WARN keywords  
  Tooling:       ESLint, Prettier, TypeScript, Coverage directives
  Documentation: JSDoc comments with @ annotations

Note: The --keep option is legacy and works alongside the new preservation system.
`)
    .argument('[paths...]', 'Files or directories to process', ['.'])
    .option('-k, --keep <patterns>', 'Comma-separated patterns to preserve (legacy)', 'todo,fixme,hack,ts-ignore,eslint-disable')
    .option('-e, --extensions <ext>', 'File extensions to process', 'js,ts,jsx,tsx,vue,svelte')
    .option('-x, --exclude <patterns>', 'Glob patterns to exclude')
    .option('--dry-run', 'Preview changes without modifying files')
    .option('--legacy-tokenizer', 'Use legacy tokenizer instead of enhanced context-aware tokenizer')
    .option('--preserve-framework', 'Preserve framework-specific comments (Svelte, Vue, React, TypeScript, Webpack)', true)
    .option('--preserve-development', 'Preserve development keywords (TODO, FIXME, HACK, NOTE, XXX, BUG, WARN)', true)
    .option('--preserve-tooling', 'Preserve tooling directives (ESLint, Prettier, TypeScript, Coverage)', true)
    .option('--preserve-documentation', 'Preserve JSDoc and documentation comments', true)
    .option('--no-preserve-framework', 'Disable framework-specific comment preservation')
    .option('--no-preserve-development', 'Disable development keyword preservation')
    .option('--no-preserve-tooling', 'Disable tooling directive preservation')
    .option('--no-preserve-documentation', 'Disable documentation comment preservation')
    .option('--custom-rules <patterns>', 'Comma-separated custom regex patterns to preserve')
    .option('--rule-priority <number>', 'Priority for custom rules (higher = more important)', '100')
    .option('-v, --verbose', 'Verbose output')
    .option('-q, --quiet', 'Suppress output')
    .option('--json', 'Output as JSON')
    .option('--force', 'Proceed even without version control detected')
    .action(async (paths, options) => {
        if (!options.force) {
            const vcsResult = detectVersionControl();
            if (!vcsResult.detected) {
                console.error('❌ No version control system detected in this project or its parent directories.');
                console.error('');
                console.error('This tool removes comments from your code, which is a potentially');
                console.error('destructive operation. Version control is recommended to track changes.');
                console.error('');
                console.error('Supported version control systems:');
                console.error('  • Git (.git)');
                console.error('  • Subversion (.svn)');
                console.error('  • Mercurial (.hg)');
                console.error('  • Bazaar (.bzr)');
                console.error('');
                console.error('Use --force to proceed without version control.');
                process.exit(2);
            }
            
            if (options.verbose) {
                console.log(`✓ Version control detected: ${vcsResult.type} at ${vcsResult.path}`);
                console.log('');
            }
        }
        
        const toolOptions = {
            ...options,
            useEnhancedTokenizer: !options.legacyTokenizer,
            
            rulePriority: parseInt(options.rulePriority, 10) || 100
        };
        
        const tool = new CrapifyComments(toolOptions);
        const exitCode = await tool.execute(paths);
        process.exit(exitCode);
    });

program.parse();