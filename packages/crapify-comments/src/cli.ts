#!/usr/bin/env node
import { Command } from 'commander';
import { CrapifyComments } from './index';
import { showBanner } from '@kafked/shared';
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
    .action(async (paths, options) => {
        // Convert legacy-tokenizer flag to useEnhancedTokenizer option
        const toolOptions = {
            ...options,
            useEnhancedTokenizer: !options.legacyTokenizer,
            // Parse custom rule priority
            rulePriority: parseInt(options.rulePriority, 10) || 100
        };
        
        const tool = new CrapifyComments(toolOptions);
        const exitCode = await tool.execute(paths);
        process.exit(exitCode);
    });

program.parse();