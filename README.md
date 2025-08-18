# crapify.me

A toolkit of oddly specific CLI utilities for developers and vibecoders

## Quick Start

```bash
npx crapifyme comments
# Remove noisy comments, keep critical ones

npx crapifyme logs  
# Clean up console logs with preservation

npx crapifyme comments --dry-run
# Preview changes without modifying files
```

**ℹ Run with --help for all options**  
**⚡ Use --dry-run to preview changes**

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

## Language Support

| Language | Extensions | Comment Syntax |
|----------|------------|----------------|
| JavaScript/TypeScript | `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs` | `//`, `/* */` |
| Modern Frameworks | `.vue`, `.svelte`, `.astro` | Mixed syntax |
| Web | `.html`, `.css`, `.scss`, `.less`, `.sass` | `<!-- -->`, `/* */` |
| Markdown | `.md`, `.mdx` | `<!-- -->` |
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
| `-e, --extensions <ext>` | Target file extensions (default: js,ts,jsx,tsx,vue,svelte,astro,html,css,scss,less,sass,md,mdx) |
| `-x, --exclude <patterns>` | Glob exclusion patterns |
| `--no-preserve-framework` | Disable framework directive preservation |
| `--no-preserve-development` | Disable development keyword preservation |
| `--no-preserve-tooling` | Disable tooling directive preservation |
| `--no-preserve-documentation` | Disable JSDoc preservation |

## Use Cases

```bash
# Production preparation
crapifyme comments --no-preserve-development src/
crapifyme logs src/

# Legacy cleanup
crapifyme comments --keep "@author,@copyright" legacy/

# Performance optimization
crapifyme logs --no-preserve-error --no-preserve-warn dist/

# CI/CD integration
crapifyme comments --json --force src/

# Pre-commit hook
crapifyme comments --dry-run $(git diff --cached --name-only)
```

## API

```typescript
import { AdvancedCommentRemover, LogsProcessor } from 'crapifyme';

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