# crapify.me

A toolkit of oddly specific CLI utilities for developers and vibecoders

## Quick Start

```bash
npx crapifyme comments
# Remove noisy comments, keep critical ones

npx crapifyme logs  
# Clean up console logs with preservation

npx crapifyme imports --style=absolute
# Optimize and standardize import statements

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

Optimize and standardize import statements with intelligent analysis and transformation.

```bash
# Convert to absolute imports with auto-detection
crapifyme imports --style=absolute src/

# Full import optimization
crapifyme imports --sort --group --remove-unused --merge-duplicates src/

# Framework-specific optimization
crapifyme imports --framework=nextjs --alias="@/*:./src/*" src/

# Convert relative imports with custom aliases
crapifyme imports --style=relative --alias="@components/*:./src/components/*" src/
```

**Import Features:**
- Convert relative ↔ absolute paths with intelligent resolution
- Sort imports alphabetically and group by type (external → internal → relative)
- Remove unused imports via AST analysis and scope detection
- Merge duplicate imports from same source automatically
- Apply consistent import styles (named vs default, multiline formatting)
- Support for path aliases (@/, ~/, custom patterns)
- Framework-specific optimizations (Next.js, Vite, Svelte, Vue, React, Angular, Nuxt)

**Import Groups:**
- External packages (npm modules)
- Internal modules (alias imports like @/, ~/)
- Relative imports (./file, ../directory)

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
| Option | Description |
|--------|-------------|
| `--style <type>` | Import path style (absolute/relative/mixed) |
| `--sort` | Sort imports alphabetically |
| `--group` | Group imports by type (external → internal → relative) |
| `--remove-unused` | Remove unused imports via AST analysis |
| `--merge-duplicates` | Merge duplicate imports from same source |
| `--alias <mapping>` | Path alias configuration (e.g., "@/*:./src/*") |
| `--framework <name>` | Framework optimizations (nextjs/vite/svelte/vue/react/angular/nuxt) |
| `--multiline-threshold <n>` | Threshold for multiline imports (default: 3) |
| `-e, --extensions <ext>` | File extensions to process (default: js,ts,jsx,tsx,vue,svelte) |
| `-x, --exclude <patterns>` | Glob exclusion patterns |
| `--no-preserve-comments` | Remove comments from import statements |

## Use Cases

```bash
# Production preparation
crapifyme comments --no-preserve-development src/
crapifyme logs src/
crapifyme imports --remove-unused --merge-duplicates src/

# Legacy cleanup
crapifyme comments --keep "@author,@copyright" legacy/
crapifyme imports --style=absolute --sort --group legacy/

# Performance optimization
crapifyme logs --no-preserve-error --no-preserve-warn dist/
crapifyme imports --remove-unused --framework=react src/

# CI/CD integration
crapifyme comments --json --force src/
crapifyme imports --dry-run --json src/

# Pre-commit hook
crapifyme comments --dry-run $(git diff --cached --name-only)
crapifyme imports --dry-run --sort --remove-unused $(git diff --cached --name-only)

# Framework migration
crapifyme imports --framework=nextjs --alias="@/*:./src/*" src/
crapifyme imports --style=absolute --group --sort components/
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

## Development

```bash
git clone https://github.com/kafk3d/crapify.git
cd crapify-tools
npm install
npm run build
node packages/crapifyme/dist/cli.js --help
```

## Architecture

- Enhanced tokenizer with multi-pass parsing and error recovery
- Rule-based preservation with priority evaluation (900 → 50 scale)
- Three-tier fallback system (Enhanced → Legacy → Failsafe)
- Version control detection with bypass option
- Performance monitoring and memory optimization

## License

MIT