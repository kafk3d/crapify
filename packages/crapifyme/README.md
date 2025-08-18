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

## Preservation System

Rule-based engine that preserves critical comments while removing noise.

### Framework Directives
```typescript
// @ts-ignore: Type assertion needed for compatibility
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
/// <reference path="./types.d.ts" />
/* webpackChunkName: "async-component" */
```

### Development Keywords
```javascript
// TODO: Refactor this method for better performance
// FIXME: Handle edge case when data is null
// HACK: Temporary workaround until API is fixed
// NOTE: This assumes the array is already sorted
```

### Tooling Directives
```javascript
/* eslint-disable no-console */
// prettier-ignore
/* @ts-expect-error - Third-party library types */
/* istanbul ignore next */
```

### Documentation Comments
```typescript
/**
 * Calculates the optimal route between two points
 * @param start - Starting coordinates
 * @param end - Destination coordinates  
 * @returns Promise resolving to optimized route
 */
```

## Architecture

### Enhanced Tokenizer
- Multi-pass parsing with context awareness
- Error recovery for malformed syntax  
- Template literal and regex literal support
- Performance monitoring with throughput metrics

### Rule-Based Preservation
- Priority-based rule evaluation (900 → 50 priority scale)
- Category-based rule management (Framework, Development, Tooling, Documentation)
- Custom regex patterns with user-defined priorities

### Safety & Recovery
- Version control detection (Git, SVN, Mercurial, Bazaar)
- Three-tier fallback system (Enhanced → Legacy → Failsafe)
- Validation to prevent excessive content removal

## Commands

### Comments Tool

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

### Logs Tool

```bash
# Remove console.log, preserve error/warn/debug
crapifyme logs src/

# Remove all console methods
crapifyme logs --no-preserve-error --no-preserve-warn --no-preserve-debug src/

# Selective preservation  
crapifyme logs --keep "performance,benchmark,trace" src/
```

**Console Methods:**
- Removed: `console.log()`, `console.info()`
- Preserved: `console.error()`, `console.warn()`, `console.debug()`
- Always Preserved: `console.assert()`, `console.trace()`, `console.time()`, `console.timeEnd()`

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

### Logs Tool
| Option | Description |
|--------|-------------|
| `-k, --keep <patterns>` | Custom preservation patterns |
| `-e, --extensions <ext>` | Target file extensions (default: js,ts,jsx,tsx,vue,svelte,astro) |
| `-x, --exclude <patterns>` | Glob exclusion patterns |
| `--no-preserve-debug` | Remove console.debug statements |
| `--no-preserve-error` | Remove console.error statements |
| `--no-preserve-warn` | Remove console.warn statements |

## Language Support

| Language | Extensions | Comment Syntax |
|----------|------------|----------------|
| JavaScript/TypeScript | `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs` | `//`, `/* */` |
| Modern Frameworks | `.vue`, `.svelte`, `.astro` | Mixed syntax |
| Web | `.html`, `.css`, `.scss`, `.less`, `.sass` | `<!-- -->`, `/* */` |
| Markdown | `.md`, `.mdx` | `<!-- -->` |
| Python/Shell | `.py`, `.sh`, `.bash` | `#` |
| Config | `.yaml`, `.yml`, `.toml`, `.conf`, `.env` | `#` |

## API

```typescript
import { AdvancedCommentRemover, LogsProcessor } from 'crapifyme';

// Comment processing
const processor = new AdvancedCommentRemover(['todo', 'fixme'], {
  useEnhancedTokenizer: true,
  preserveFramework: true,
  preserveDevelopment: true,
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

## Use Cases

```bash
# Production preparation
crapifyme comments --no-preserve-development src/
crapifyme logs src/

# Legacy cleanup
crapifyme comments --keep "@author,@copyright" legacy/

# Performance optimization
crapifyme logs --no-preserve-error --no-preserve-warn dist/
```

## Installation

```bash
npm install -g crapifyme
```

## License

MIT