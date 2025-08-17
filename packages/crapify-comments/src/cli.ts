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
    .argument('[paths...]', 'Files or directories to process', ['./src'])
    .option('-k, --keep <patterns>', 'Comma-separated patterns to preserve', 'todo,fixme,hack,ts-ignore,eslint-disable')
    .option('-e, --extensions <ext>', 'File extensions to process', 'js,ts,jsx,tsx,vue,svelte')
    .option('-x, --exclude <patterns>', 'Glob patterns to exclude')
    .option('--dry-run', 'Preview changes without modifying files')
    .option('-v, --verbose', 'Verbose output')
    .option('-q, --quiet', 'Suppress output')
    .option('--json', 'Output as JSON')
    .action(async (paths, options) => {
        const tool = new CrapifyComments(options);
        const exitCode = await tool.execute(paths);
        process.exit(exitCode);
    });

program.parse();