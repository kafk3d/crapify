#!/usr/bin/env node
import { Command } from 'commander';
import { showBanner } from './shared';
import { commentsCommand } from './commands/comments';
import { logsCommand } from './commands/logs';

const pkg = require('../package.json');

showBanner();

const program = new Command();

program
	.name('crapifyme')
	.description('Ultra-fast developer productivity CLI tools')
	.version(pkg.version)
	.addHelpText(
		'after',
		`
Examples:
  $ crapifyme comments                  # Remove comments from current directory
  $ crapifyme logs                      # Remove console.log from current directory
  $ crapifyme comments --dry-run .          # Preview comment changes
  $ crapifyme logs --force                  # Remove logs without VCS check
  $ crapifyme comments --no-preserve-framework # Disable framework preservation

Global Options:
  --dry-run                Preview changes without modifying files
  --force                  Proceed without version control detection
  --verbose                Detailed output
  --quiet                  Suppress output
  --json                   Output as JSON

Visit https://crapify.me for more information and documentation.
`
	);

program
	.option('--dry-run', 'Preview changes without modifying files')
	.option('--force', 'Proceed without version control detection')
	.option('-v, --verbose', 'Detailed output')
	.option('-q, --quiet', 'Suppress output')
	.option('--json', 'Output as JSON');

program.addCommand(commentsCommand);
program.addCommand(logsCommand);

if (process.argv.length <= 2) {
	program.help();
}

program.parse();
