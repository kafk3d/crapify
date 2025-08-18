# crapify.me

A toolkit of oddly specific CLI utilities for developers and vibecoders

## Quick Start

```bash
npx crapifyme comments
# Remove noisy comments, keep critical ones

npx crapifyme logs  
# Clean up console logs with preservation

npx crapifyme imports
# Optimize imports: sort, group, remove unused, merge duplicates

npx crapifyme comments --dry-run
# Preview changes without modifying files
```

**Run with --help for all options**  
**Use --dry-run to preview changes**

## Global Install

```bash
npm install -g crapifyme
# Install globally for frequent use

crapifyme comments src/
# Process specific directory with comments tool

crapifyme logs --help
# View all available options for logs tool
```

## Tools

### Comment Processing

Removes comments while preserving critical ones using rule-based analysis.

```bash
# Basic usage
crapifyme comments

# Disable preservation categories  
crapifyme comments --no-preserve-framework src/
crapifyme comments --no-preserve-development src/

# Custom patterns
crapifyme comments --keep "copyright,license,@author" src/

# File filtering
crapifyme comments --extensions "ts,tsx,vue" --exclude "**/node_modules/**" src/
```

**Preserved by default:**
- Framework directives (@ts-ignore, eslint-disable, webpack comments)
- Development keywords (TODO, FIXME, HACK, NOTE, XXX, BUG)
- Tooling directives (Prettier, TypeScript, coverage)
- Documentation (JSDoc with @annotations)

### Console Log Cleanup

Removes console statements with selective preservation.

```bash
# Remove console.log, preserve error/warn/debug
crapifyme logs src/

# Remove all console methods
crapifyme logs --no-preserve-error --no-preserve-warn --no-preserve-debug src/

# Custom preservation
crapifyme logs --keep "performance,benchmark,trace" src/
```

**Console Methods:**
- Removed: `console.log()`, `console.info()`
- Preserved: `console.error()`, `console.warn()`, `console.debug()`
- Always preserved: `console.assert()`, `console.trace()`, `console.time()`, `console.timeEnd()`

### Import Optimization

Intelligent import optimization with AST analysis - **all features enabled by default**.

```bash
# Complete optimization (default behavior)
crapifyme imports src/

# Framework-specific optimization with aliases  
crapifyme imports --framework=nextjs --alias="@/*:./src/*" src/

# Convert import path styles
crapifyme imports --style=absolute src/
crapifyme imports --style=relative src/

# Disable specific features if needed
crapifyme imports --no-remove-unused src/
crapifyme imports --no-sort --no-group src/
```

**Import Features (All Enabled by Default):**
- **Sort imports alphabetically** within each group
- **Group imports by type**: external → internal (@/, ~/) → relative (./,../) 
- **Remove unused imports** via comprehensive AST analysis and scope detection
- **Merge duplicate imports** from same source automatically
- **Preserve original formatting** when only reordering (no unnecessary changes)
- **Intelligent multiline formatting** with original indentation detection
- **Framework auto-detection** (Next.js, Vite, Svelte, Vue, React, Angular, Nuxt)
- **Path alias support** (@/, ~/, custom patterns with tsconfig.json integration)
- **Mixed import handling** (default + named: `import React, { useState }`)

**Import Processing:**
- **AST-based parsing** using Babel for 100% accuracy
- **Scope analysis** for precise unused import detection  
- **Character-level replacement** preserves all formatting
- **Three-tier optimization**: content changes → structure changes → untouched
- **TypeScript support** with proper type import handling

## Language Support

| Language | Extensions | Comment Syntax |
|----------|------------|----------------|
| JavaScript/TypeScript | `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs` | `//`, `/* */` |
| Modern Frameworks | `.vue`, `.svelte`, `.astro` | Mixed syntax |
| Web | `.html`, `.css`, `.scss`, `.less`, `.sass` | `<!-- -->`, `/* */` |
| Python/Shell | `.py`, `.sh`, `.bash` | `#` |
| Config | `.yaml`, `.yml`, `.toml`, `.conf`, `.env` | `#` |

## Options

### Global
| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without file modification |
| `--force` | Bypass version control requirement |
| `--verbose` | Detailed processing information |
| `--quiet` | Suppress all output except errors |
| `--json` | Machine-readable JSON output |

### Comments Tool
| Option | Description |
|--------|-------------|
| `-k, --keep <patterns>` | Custom preservation patterns (comma-separated) |
| `-e, --extensions <ext>` | Target file extensions (default: js,ts,jsx,tsx,vue,svelte,astro,html,css,scss,less,sass) |
| `-x, --exclude <patterns>` | Glob exclusion patterns |
| `--no-preserve-framework` | Disable framework directive preservation |
| `--no-preserve-development` | Disable development keyword preservation |
| `--no-preserve-tooling` | Disable tooling directive preservation |
| `--no-preserve-documentation` | Disable JSDoc preservation |

### Imports Tool
| Option | Default | Description |
|--------|---------|-------------|
| `--sort` | **true** | Sort imports alphabetically within groups |
| `--group` | **true** | Group imports by type (external → internal → relative) |
| `--remove-unused` | **true** | Remove unused imports via AST analysis |
| `--merge-duplicates` | **true** | Merge duplicate imports from same source |
| `--no-sort` | - | Disable sorting imports |
| `--no-group` | - | Disable grouping imports |
| `--no-remove-unused` | - | Disable removing unused imports |
| `--no-merge-duplicates` | - | Disable merging duplicate imports |
| `--style <type>` | mixed | Import path style (absolute/relative/mixed) |
| `--alias <mapping>` | - | Path alias configuration (e.g., "@/*:./src/*") |
| `--framework <name>` | auto | Framework optimizations (nextjs/vite/svelte/vue/react/angular/nuxt) |
| `--multiline-threshold <n>` | 3 | Threshold for multiline imports |
| `-e, --extensions <ext>` | js,ts,jsx,tsx,vue,svelte | File extensions to process |
| `-x, --exclude <patterns>` | - | Glob exclusion patterns |
| `--no-preserve-comments` | - | Remove comments from import statements |

## Use Cases

```bash
# Production preparation
crapifyme comments --no-preserve-development src/
crapifyme logs src/
crapifyme imports src/

# Legacy cleanup
crapifyme comments --keep "@author,@copyright" legacy/
crapifyme imports --style=absolute legacy/

# Performance optimization  
crapifyme logs --no-preserve-error --no-preserve-warn dist/
crapifyme imports --framework=react src/

# CI/CD integration
crapifyme comments --json --force src/
crapifyme imports --dry-run --json src/

# Pre-commit hook
crapifyme comments --dry-run $(git diff --cached --name-only)
crapifyme imports --dry-run $(git diff --cached --name-only)

# Framework migration
crapifyme imports --framework=nextjs --alias="@/*:./src/*" src/
crapifyme imports --style=absolute components/

# Selective optimization
crapifyme imports --no-remove-unused src/  # Keep unused imports
crapifyme imports --no-sort --framework=vue src/  # Group only, no sorting
```

## API

```typescript
import { AdvancedCommentRemover, LogsProcessor, ImportsProcessor } from 'crapifyme';

// Comment processing
const processor = new AdvancedCommentRemover(['todo', 'fixme'], {
  useEnhancedTokenizer: true,
  preserveFramework: true,
  customRules: ['@copyright', '@license']
});

const result = processor.removeComments(sourceCode, filePath);

// Console log processing
const logsProcessor = new LogsProcessor({
  preserveError: true,
  preserveWarn: true,
  preserveDebug: false
});

const logsResult = logsProcessor.processFile(sourceCode);

// Import optimization
const importsProcessor = new ImportsProcessor({
  style: 'absolute',
  sort: true,
  group: true,
  removeUnused: true,
  mergeDuplicates: true,
  framework: 'nextjs',
  aliases: [{ pattern: '@/*', replacement: './src/*' }]
});

const importsResult = importsProcessor.processFile(sourceCode, filePath);
```

## License

MIT