# crapify.me

A toolkit of oddly specific CLI utilities for developers and vibecoders

- [Installation](#installation)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Configuration & Options](#configuration--options)
  - [Global Options](#global-options)
  - [Base64 Tool](#base64-tool)
  - [Chars Tool](#chars-tool)
  - [Comments Tool](#comments-tool)
  - [Logs Tool](#logs-tool)
  - [Imports Tool](#imports-tool)
  - [SVG Tool](#svg-tool)
  - [Deps Tool](#deps-tool)
- [Usage Examples](#usage-examples)

## Installation

```bash
npm install -g crapifyme

# or use it without installation:
npx crapifyme
```

## Quick Start

```bash
# Base64 encoding (data URL + CSS formats)
crapifyme base64 image.png

# Unicode character detection and cleanup
crapifyme chars --fix src/

# Comment cleanup with preservation rules
crapifyme comments src/

# Console log cleanup
crapifyme logs src/

# Import optimization
crapifyme imports src/

# SVG optimization
crapifyme svg assets/

# Dependency analysis
crapifyme deps
```

## How It Works

Smart CLI tools with rule-based preservation systems, AST analysis, and multi-pass optimization. Each tool uses professional-grade libraries and includes safety features like version control detection and dry-run modes.

## Configuration & Options

### Global Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run` | Preview changes without file modification | false |
| `--force` | Bypass version control requirement | false |
| `--verbose` | Detailed processing information | false |
| `--quiet` | Suppress all output except errors | false |
| `--json` | Machine-readable JSON output | false |

### Base64 Tool

**Image encoding and decoding with multiple output formats**

| Option | Description | Default |
|--------|-------------|---------|
| `--css-only` | Output only CSS background-image format | false |
| `--data-url-only` | Output only data URL format | false |
| `--raw` | Output raw base64 string without data URL wrapper | false |
| `--size-info` | Show detailed size analysis (original, base64, overhead) | false |
| `-o, --output <path>` | Output file path for decode command | auto-generated |

**Supported formats**: PNG, JPG, JPEG, SVG, GIF, WebP, BMP, ICO, TIFF, AVIF

### Chars Tool

**Unicode-to-ASCII transliteration and character detection**

| Option | Description | Default |
|--------|-------------|---------|
| `--fix` | Automatically fix detected characters with ASCII replacements | false |
| `--strict` | Enable strict mode (flag all non-ASCII characters) | false |
| `--interactive` | Prompt for each replacement (requires --fix) | false |
| `--severity <level>` | Minimum severity to report (low/medium/high/critical) | low |
| `--show-context <number>` | Number of characters to show around each issue | 40 |
| `--ignore-strings` | Ignore characters inside string literals | false |
| `--ignore-comments` | Ignore characters inside comments | false |
| `-e, --extensions <ext>` | File extensions to process | js,ts,jsx,tsx,vue,py |
| `-x, --exclude <patterns>` | Glob exclusion patterns | none |

### Comments Tool

**Rule-based comment preservation and cleanup**

| Option | Description | Default |
|--------|-------------|---------|
| `-k, --keep <patterns>` | Custom preservation patterns (comma-separated) | none |
| `-e, --extensions <ext>` | Target file extensions | js,ts,jsx,tsx,vue,svelte,astro,html,css,scss,less,sass |
| `-x, --exclude <patterns>` | Glob exclusion patterns | none |
| `--no-preserve-framework` | Disable framework directive preservation | false |
| `--no-preserve-development` | Disable development keyword preservation | false |
| `--no-preserve-tooling` | Disable tooling directive preservation | false |
| `--no-preserve-documentation` | Disable JSDoc preservation | false |

**Preserved patterns**: `TODO`, `FIXME`, `HACK`, `NOTE`, `@ts-ignore`, `eslint-disable`, JSDoc, framework directives

### Logs Tool

**Console log cleanup with selective preservation**

| Option | Description | Default |
|--------|-------------|---------|
| `-k, --keep <patterns>` | Custom preservation patterns | none |
| `-e, --extensions <ext>` | Target file extensions | js,ts,jsx,tsx,vue,svelte,astro |
| `-x, --exclude <patterns>` | Glob exclusion patterns | none |
| `--no-preserve-debug` | Remove console.debug statements | false |
| `--no-preserve-error` | Remove console.error statements | false |
| `--no-preserve-warn` | Remove console.warn statements | false |

**Removed by default**: `console.log()`, `console.info()`  
**Preserved by default**: `console.error()`, `console.warn()`, `console.debug()`, `console.assert()`, `console.trace()`, `console.time()`

### Imports Tool

**AST-based import optimization and organization**

| Option | Description | Default |
|--------|-------------|---------|
| `--sort` / `--no-sort` | Sort imports alphabetically within groups | true |
| `--group` / `--no-group` | Group imports by type (external → internal → relative) | true |
| `--remove-unused` / `--no-remove-unused` | Remove unused imports via AST analysis | true |
| `--merge-duplicates` / `--no-merge-duplicates` | Merge duplicate imports from same source | true |
| `--style <type>` | Import path style (absolute/relative/mixed) | mixed |
| `--alias <mapping>` | Path alias configuration (e.g., "@/*:./src/*") | auto-detect |
| `--framework <name>` | Framework optimizations (nextjs/vite/svelte/vue/react/angular/nuxt) | auto-detect |
| `--multiline-threshold <n>` | Threshold for multiline imports | 3 |
| `-e, --extensions <ext>` | File extensions to process | js,ts,jsx,tsx,vue,svelte |
| `-x, --exclude <patterns>` | Glob exclusion patterns | none |
| `--no-preserve-comments` | Remove comments from import statements | false |

### SVG Tool

**SVGO-powered SVG optimization with presets and advanced options**

**Core Options**

| Option | Description | Default |
|--------|-------------|---------|
| `--preset <preset>` | Optimization preset (minimal/balanced/aggressive) | balanced |
| `--config <path>` | Path to custom SVGO configuration file | none |
| `--plugins <plugins>` | Comma-separated list of SVGO plugins to enable | preset-default |
| `--precision <number>` | Floating point precision for coordinates | 2 |
| `--multipass` | Run optimization multiple times for better results | false |

**File Processing**

| Option | Description | Default |
|--------|-------------|---------|
| `--glob <pattern>` | Glob pattern for files (e.g., "**/*.svg") | none |
| `-e, --extensions <ext>` | File extensions to process | svg |
| `-x, --exclude <patterns>` | Comma-separated exclusion patterns | none |
| `--parallel` | Process files in parallel | true |
| `--max-concurrency <number>` | Maximum number of concurrent operations | 4 |

**Output Modes**

| Option | Description | Default |
|--------|-------------|---------|
| `--in-place` | Overwrite original files (with confirmation) | true |
| `--copy` | Create optimized copies with .optimized.svg suffix | false |
| `--backup` | Create .original.svg backup before optimizing | false |
| `--stdout` | Output optimized SVG to console (single files only) | false |
| `--output-dir <dir>` | Save optimized files to different directory | none |

**Advanced Features**

| Option | Description | Default |
|--------|-------------|---------|
| `--keep-ids` | Preserve ID attributes | false |
| `--keep-titles` | Preserve title and desc elements for accessibility | false |
| `--watch` | Watch mode for continuous optimization during development | false |
| `--size-info` / `--no-size-info` | Show detailed size analysis and compression ratios | true |
| `--report <format>` | Export report (json, csv) | none |
| `--validate-input` | Validate SVG structure before optimization | true |
| `--validate-output` | Validate SVG structure after optimization | true |

### Deps Tool

**Comprehensive dependency analysis for security, size, and maintenance**

**Analysis Types**

| Option | Description | Default |
|--------|-------------|---------|
| `--security-only` | Only perform security vulnerability analysis | false |
| `--size-only` | Only perform bundle size analysis | false |
| `--outdated-only` | Only check for outdated dependencies | false |
| `--unused-only` | Only check for unused dependencies | false |
| `--duplicates-only` | Only check for duplicate dependencies | false |

**Scope & Dependencies**

| Option | Description | Default |
|--------|-------------|---------|
| `--include-gzip` / `--no-include-gzip` | Include gzipped size information | true |
| `--include-dev` / `--no-include-dev` | Include development dependencies in analysis | true |
| `--include-peer` | Include peer dependencies in analysis | false |
| `--include-optional` | Include optional dependencies in analysis | false |
| `--workspaces` | Analyze workspaces if available | false |

**Output & Performance**

| Option | Description | Default |
|--------|-------------|---------|
| `--pm <manager>` | Package manager to use (npm/yarn/pnpm/auto) | auto |
| `--timeout <ms>` | Request timeout in milliseconds | 120000 |
| `--output <format>` | Output format (table/json/tree/summary) | table |
| `--no-security` | Skip security vulnerability checks | false |
| `--no-bundle-size` | Skip bundle size analysis | false |

## Usage Examples

### Production Optimization
```bash
# Prepare assets for deployment
crapifyme base64 logo.png --css-only
crapifyme svg --preset=aggressive assets/
crapifyme chars --fix --strict src/
crapifyme comments --no-preserve-development src/
crapifyme logs src/
crapifyme imports src/
crapifyme deps --security-only --output=json
```

### Development Workflow
```bash
# Quick SVG optimization from clipboard
crapifyme svg '<svg>...</svg>'

# Watch mode for continuous optimization
crapifyme svg --watch src/icons/

# Interactive character fixing
crapifyme chars --fix --interactive src/

# Import organization with framework settings
crapifyme imports --framework=nextjs --alias="@/*:./src/*" src/
```

### Security & Maintenance
```bash
# Security audit
crapifyme deps --security-only

# Bundle size analysis
crapifyme deps --size-only --include-gzip

# Find unused dependencies
crapifyme deps --unused-only

# Legacy cleanup
crapifyme chars --fix legacy/
crapifyme comments --keep "@author,@copyright" legacy/
```

### CI/CD Integration
```bash
# Pipeline-friendly commands
crapifyme chars --severity=high --json --quiet src/
crapifyme deps --security-only --output=json --quiet
crapifyme svg --report=json --quiet build/assets/
```

---

## License

MIT
