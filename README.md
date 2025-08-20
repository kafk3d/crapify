# crapify.me

A toolkit of oddly specific CLI utilities for developers and vibecoders

## Quick Start

```bash
npx crapifyme base64 image.png
# Encode images to base64 (data URL + CSS formats)

npx crapifyme chars
# Detect and fix non-Latin characters (Cyrillic, Greek, CJK, Arabic)

npx crapifyme comments
# Remove noisy comments, keep critical ones

npx crapifyme logs
# Clean up console logs with preservation

npx crapifyme imports
# Optimize imports: sort, group, remove unused, merge duplicates

npx crapifyme deps
# Analyze dependencies: security, size, unused

npx crapifyme svg
# Optimize SVG files or direct SVG code using SVGO

npx crapifyme comments --dry-run
# Preview changes without modifying files
```

**Run with --help for all options**  
**Use --dry-run to preview changes**

## Global Install

```bash
npm install -g crapifyme
# Install globally for frequent use

crapifyme base64 icon.svg --css-only
# Generate CSS background-image format only

crapifyme chars --fix src/
# Fix non-Latin characters in src directory

crapifyme comments src/
# Process specific directory with comments tool

crapifyme logs --help
# View all available options for logs tool

crapifyme imports src/
# Optimize all imports in src directory

crapifyme deps
# Analyze project dependencies for security and optimization

crapifyme svg assets/
# Optimize all SVG files in assets directory with balanced preset

crapifyme svg '<svg>...</svg>'
# Optimize SVG code directly from clipboard (outputs to console)
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

### Base64 Tool

Professional image-to-base64 encoding and decoding with multiple output formats for web development.

```bash
# Basic encoding (outputs both data URL and CSS formats)
crapifyme base64 image.png

# Explicit encoding with size analysis
crapifyme base64 encode photo.jpg --size-info

# Specific output formats
crapifyme base64 icon.svg --css-only
crapifyme base64 logo.png --data-url-only
crapifyme base64 banner.jpg --raw

# Decoding base64 to files
crapifyme base64 decode "data:image/png;base64,iVBORw0KGgo..." -o output.png
crapifyme base64 decode "iVBORw0KGgoAAAA..." # Auto-generates filename
```

**Supported Image Formats:**
- **PNG, JPG, JPEG**: Standard web image formats
- **SVG**: Vector graphics with proper MIME type handling
- **GIF, WebP**: Modern web formats with optimization
- **BMP, ICO**: Legacy formats for compatibility
- **TIFF, AVIF**: High-quality and next-gen formats

**Output Formats:**
- **Data URL**: `data:image/png;base64,iVBORw0KGgo...` (for HTML/CSS)
- **CSS Background**: `background-image: url("data:image/...")` (ready-to-use CSS)
- **Raw Base64**: Plain base64 string without MIME wrapper

**Features:**
- **MIME Type Detection**: Automatic detection from file extensions
- **Size Analysis**: Original vs base64 size with overhead percentage
- **Memory Efficient**: Handles files up to 100MB without memory issues
- **Error Validation**: File existence, format support, base64 validation
- **Cross-platform**: Works on Windows, macOS, and Linux

**Example Output:**
```
✔ Encoded: logo.png
  ┣ Original size: 15.3 KB
  ┣ Base64 size: 20.4 KB
  ┣ Overhead: 33.3%
  ┗ MIME type: image/png

Data URL:
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA...

CSS Background Image:
background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA...");
```

### Chars Tool

Enterprise-grade Unicode-to-ASCII transliteration for cleaning non-Latin characters from codebases.

```bash
# Detect non-Latin characters (detection mode)
crapifyme chars

# Automatically fix detected issues
crapifyme chars --fix src/

# Strict mode - flag all non-ASCII characters
crapifyme chars --strict --fix src/

# Ignore characters in strings and comments
crapifyme chars --ignore-strings --ignore-comments src/

# Filter by severity level
crapifyme chars --severity=high src/

# Custom file extensions
crapifyme chars --extensions "js,ts,py,go" --fix src/
```

**Character Detection:**

- **Cyrillic**: `Привет` → `Privet` (Russian, Ukrainian, Bulgarian)
- **Greek**: `α β γ δ` → `a v g d` (Mathematical symbols, Greek text)
- **CJK**: `你好世界` → `NiHaoShiJie` (Chinese, Japanese, Korean)
- **Arabic**: `مرحبا` → `mrhb` (Arabic script)
- **Accented**: `résumé café` → `resume cafe` (Latin with diacritics)
- **Invisible**: Zero-width spaces, byte order marks

**Features:**
- Uses `any-ascii` library for professional-grade transliteration
- Context display showing surrounding code
- Severity-based filtering (low, medium, high, critical)
- Comprehensive Unicode range detection
- Safe mode with version control detection

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

### Imports Tool

Intelligent import optimization with comprehensive AST analysis and formatting preservation.

```bash
# Complete optimization (all features enabled by default)
crapifyme imports src/

# Framework-specific optimization  
crapifyme imports --framework=nextjs --alias="@/*:./src/*" src/

# Convert import path styles
crapifyme imports --style=absolute src/
crapifyme imports --style=relative src/

# Disable specific features
crapifyme imports --no-remove-unused src/
crapifyme imports --no-sort --no-group src/
```

**Import Features (All Enabled by Default):**

- **Sort imports alphabetically** within each group
- **Group imports by type**: external → internal (@/, ~/) → relative (./,..)
- **Remove unused imports** via comprehensive AST analysis and scope detection
- **Merge duplicate imports** from same source automatically
- **Preserve original formatting** when only reordering (no unnecessary changes)
- **Framework auto-detection** (Next.js, Vite, Svelte, Vue, React, Angular, Nuxt)
- **Path alias support** (@/, ~/, custom patterns with tsconfig.json integration)
- **Mixed import handling** (default + named: `import React, { useState }`)

**Import Processing:**

- **AST-based parsing** using Babel for 100% accuracy
- **Scope analysis** for precise unused import detection
- **Character-level replacement** preserves all formatting
- **TypeScript support** with proper type import handling

### SVG Tool

Professional SVG optimization using SVGO - with intelligent presets, advanced configuration options, and direct code processing.

```bash
# Basic optimization (balanced preset by default)
crapifyme svg

# Optimize specific file or directory
crapifyme svg logo.svg
crapifyme svg assets/icons/

# Direct SVG code optimization (copy-paste workflow)
crapifyme svg '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">...</svg>'
crapifyme svg --preset=aggressive '<svg>...</svg>'  # With custom preset
crapifyme svg --quiet '<svg>...</svg>'              # Clean output for piping

# Different optimization presets
crapifyme svg --preset=minimal assets/     # Light optimization, preserves structure
crapifyme svg --preset=balanced assets/    # Balanced compression (default)
crapifyme svg --preset=aggressive assets/  # Maximum compression

# Advanced output modes
crapifyme svg --copy icons/                # Create .optimized.svg copies
crapifyme svg --backup --in-place icons/   # Create .original.svg backups
crapifyme svg --stdout logo.svg            # Output to console
crapifyme svg --output-dir=optimized/ src/ # Save to different directory

# Performance and processing options
crapifyme svg --parallel --max-concurrency=8 large-dir/  # High-performance batch
crapifyme svg --multipass --precision=1 icons/           # Multiple optimization passes
crapifyme svg --glob "**/*.svg" --exclude="**/node_modules/**" # Advanced file matching

# Preservation options
crapifyme svg --keep-ids --keep-titles components/       # Preserve accessibility
crapifyme svg --plugins="cleanupAttrs,removeComments" logo.svg  # Custom plugins

# Advanced optimization features
crapifyme svg --convert-colors --sort-attrs --minify-styles assets/  # Color & style optimization
crapifyme svg --remove-viewbox --remove-xmlns standalone-icons/     # Aggressive cleanup

# Development workflow
crapifyme svg --watch --preset=balanced src/             # Watch mode for development
crapifyme svg --report=json --size-info assets/          # Generate detailed reports
crapifyme svg --config=svgo.config.js assets/            # Use custom configuration
```

**Optimization Presets:**

- **Minimal**: 10-30% file size reduction, preserves most attributes and structure
- **Balanced**: 30-60% file size reduction with good compression while maintaining usability (default)
- **Aggressive**: 50-80% file size reduction with maximum compression

**Output Modes:**

- **In-place**: Overwrite original files (default, prompts for confirmation)
- **Copy**: Create `.optimized.svg` copies alongside originals
- **Backup**: Create `.original.svg` backups before optimization
- **Stdout**: Output optimized SVG to console (single files only)
- **Output Directory**: Save optimized files to specified directory

**Advanced Features:**

- **SVGO v3+ Engine**
- **Direct Code Processing**: Copy-paste SVG code directly from clipboard for instant optimization
- **Parallel Processing**: Process multiple files simultaneously with configurable concurrency
- **Progress Tracking**: Real-time progress bars and spinners for batch operations
- **Validation**: Input/output SVG structure validation to ensure integrity
- **Custom Configuration**: Support for SVGO configuration files and custom plugin selection
- **Watch Mode**: Continuous optimization during development
- **Detailed Reporting**: Export optimization reports in JSON/CSV formats with metrics

**Safety Features:**

- **Dry Run Mode**: Preview changes without modifying files (`--dry-run`)
- **Version Control Detection**: Requires VCS or `--force` flag for safety
- **Automatic Backups**: Optional backup creation before optimization
- **SVG Validation**: Validates SVG structure before and after optimization
- **Error Recovery**: Graceful handling of malformed or problematic SVG files

**Performance Optimizations:**

- **Smart File Detection**: Skips already optimized files based on content analysis
- **Memory Efficient**: Handles large SVG files (>10MB) with streaming support
- **Concurrent Processing**: Configurable worker pool for batch operations
- **Fast Glob Matching**: High-performance file pattern matching

**Integration Features:**

- **Build Tool Integration**: Exit codes optimized for CI/CD pipelines
- **Report Generation**: Detailed analytics with size reduction metrics
- **Configuration Inheritance**: Project-level and directory-specific settings
- **Custom Plugin System**: Extensible with SVGO's plugin ecosystem

**Example Output:**
```
✔ Processed 15 SVG files
  ┣ Original size: 45.2 KB
  ┣ Optimized size: 28.7 KB
  ┣ Bytes saved: 16.5 KB
  ┣ Compression: 36.5%
  ┣ Avg ratio: 1.58:1
  ┗ Processing time: 234.00ms
```

**Typical Use Cases:**

- **Copy-Paste Workflow**: Optimize SVG code directly from clipboard or code editors
- **Production Optimization**: Prepare SVG assets for web deployment with maximum compression
- **Development Workflow**: Continuous optimization during asset creation and modification
- **Asset Pipeline**: Integrate into build systems for automated SVG optimization
- **Legacy Cleanup**: Batch process existing SVG collections for size reduction
- **Quality Assurance**: Validate and standardize SVG files across projects

Uses SVGO v3+ with preset-default configuration system for reliable, predictable results.

### Deps Tool

Comprehensive dependency analysis and optimization for security, size, and maintainability.

```bash
# Complete dependency analysis (all features enabled by default)
crapifyme deps

# Security-focused analysis
crapifyme deps --security-only

# Bundle analysis
crapifyme deps --size-only --include-gzip

# Specific analysis types
crapifyme deps --outdated-only
crapifyme deps --unused-only
crapifyme deps --duplicates-only

# Different output formats
crapifyme deps --output=summary
crapifyme deps --output=json
crapifyme deps --output=tree

# Package manager specific
crapifyme deps --pm=yarn
crapifyme deps --pm=pnpm
```

**Analysis Features:**

- **Security Vulnerabilities**: Integration with npm/yarn/pnpm audit commands
- **Bundle Size Analysis**: Real-time size estimation using npmjs.org API
- **Outdated Dependencies**: Compare installed vs latest versions
- **Unused Dependencies**: Integration with depcheck for detection
- **Duplicate Detection**: Find multiple versions of same package
- **Package Manager Support**: Auto-detection for npm, yarn, pnpm

**Size Analysis:**

- **Total Bundle Size**: Raw and gzipped sizes with formatted output
- **Largest Packages**: Top contributors to bundle size with percentages
- **Tree-shakeable**: Packages that support ES modules and tree-shaking
- **Side Effects**: Packages that have side effects and can't be tree-shaken

**Output Formats:**

- **Table** (default): Clean formatted analysis with visual tables
- **Summary**: Concise overview of key metrics and issues
- **JSON**: Machine-readable output for CI/CD integration
- **Tree**: ASCII dependency tree with size information

**Example Output:**
```
📦 DEPENDENCY ANALYSIS
┌─────────────────────────────────────────────┐
│ Project: my-awesome-app                     │
│ Dependencies: 42 production, 18 dev         │
│ Total Bundle Size: 2.4MB (847KB gzipped)    │
│ Package Manager: npm v8.19.2                │
└─────────────────────────────────────────────┘

🚨 SECURITY ISSUES (2)
┌─────────────────────┬──────────┬────────────────┐
│ Package             │ Severity │ Recommendation │
├─────────────────────┼──────────┼────────────────┤
│ moment@2.29.1       │ HIGH     │ Update to 2.30 │
│ lodash@4.17.20      │ MODERATE │ Use lodash-es  │
└─────────────────────┴──────────┴────────────────┘

📊 PACKAGE SIZES
┌─────────────────────┬──────────┬──────────┬─────────┐
│ Package             │ Raw      │ Gzipped  │ % Total │
├─────────────────────┼──────────┼──────────┼─────────┤
│ react               │ 2.1MB    │ 628.3KB  │ 45.2%   │
│ @types/node         │ 1.7MB    │ 510.1KB  │ 36.7%   │
│ lodash              │ 287.5KB  │ 86.2KB   │ 6.2%    │
│ axios               │ 213.4KB  │ 64.0KB   │ 4.6%    │
│ moment              │ 168.9KB  │ 50.7KB   │ 4.1%    │
│ uuid                │ 45.2KB   │ 13.6KB   │ 1.0%    │
│ chalk               │ 38.7KB   │ 11.6KB   │ 0.9%    │
│ debug               │ 28.3KB   │ 8.5KB    │ 0.6%    │
│ classnames          │ 15.1KB   │ 4.5KB    │ 0.3%    │
│ tiny-invariant      │ 2.8KB    │ 841B     │ 0.1%    │
└─────────────────────┴──────────┴──────────┴─────────┘
```

## Options

### Global

| Option      | Description                               |
| ----------- | ----------------------------------------- |
| `--dry-run` | Preview changes without file modification |
| `--force`   | Bypass version control requirement        |
| `--verbose` | Detailed processing information           |
| `--quiet`   | Suppress all output except errors         |
| `--json`    | Machine-readable JSON output              |

### Base64 Tool

| Option | Description |
|--------|-------------|
| `--css-only` | Output only CSS background-image format |
| `--data-url-only` | Output only data URL format |
| `--raw` | Output raw base64 string without data URL wrapper |
| `--size-info` | Show detailed size analysis (original, base64, overhead) |
| `-o, --output <path>` | Output file path for decode command |

### Chars Tool

| Option                     | Description                                                      |
| -------------------------- | ---------------------------------------------------------------- |
| `--fix`                    | Automatically fix detected characters with ASCII replacements    |
| `--strict`                 | Enable strict mode (flag all non-ASCII characters)              |
| `--interactive`            | Prompt for each replacement (requires --fix)                    |
| `--severity <level>`       | Minimum severity to report (low/medium/high/critical)           |
| `--show-context <number>`  | Number of characters to show around each issue (default: 40)    |
| `--ignore-strings`         | Ignore characters inside string literals                        |
| `--ignore-comments`        | Ignore characters inside comments                               |
| `-e, --extensions <ext>`   | File extensions to process (default: js,ts,jsx,tsx,vue,py,etc.) |
| `-x, --exclude <patterns>` | Glob exclusion patterns                                          |

### Comments Tool

| Option                        | Description                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `-k, --keep <patterns>`       | Custom preservation patterns (comma-separated)                                           |
| `-e, --extensions <ext>`      | Target file extensions (default: js,ts,jsx,tsx,vue,svelte,astro,html,css,scss,less,sass) |
| `-x, --exclude <patterns>`    | Glob exclusion patterns                                                                  |
| `--no-preserve-framework`     | Disable framework directive preservation                                                 |
| `--no-preserve-development`   | Disable development keyword preservation                                                 |
| `--no-preserve-tooling`       | Disable tooling directive preservation                                                   |
| `--no-preserve-documentation` | Disable JSDoc preservation                                                               |

### Logs Tool

| Option                     | Description                                                      |
| -------------------------- | ---------------------------------------------------------------- |
| `-k, --keep <patterns>`    | Custom preservation patterns                                     |
| `-e, --extensions <ext>`   | Target file extensions (default: js,ts,jsx,tsx,vue,svelte,astro) |
| `-x, --exclude <patterns>` | Glob exclusion patterns                                          |
| `--no-preserve-debug`      | Remove console.debug statements                                  |
| `--no-preserve-error`      | Remove console.error statements                                  |
| `--no-preserve-warn`       | Remove console.warn statements                                   |

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

### Deps Tool

| Option | Default | Description |
|--------|---------|-------------|
| `--security-only` | **false** | Only perform security vulnerability analysis |
| `--size-only` | **false** | Only perform bundle size analysis |
| `--outdated-only` | **false** | Only check for outdated dependencies |
| `--unused-only` | **false** | Only check for unused dependencies |
| `--duplicates-only` | **false** | Only check for duplicate dependencies |
| `--include-gzip` | **true** | Include gzipped size information |
| `--no-include-gzip` | - | Exclude gzipped size information |
| `--include-dev` | **true** | Include development dependencies in analysis |
| `--no-include-dev` | - | Exclude development dependencies from analysis |
| `--include-peer` | **false** | Include peer dependencies in analysis |
| `--include-optional` | **false** | Include optional dependencies in analysis |
| `--pm <manager>` | auto | Package manager to use (npm/yarn/pnpm/auto) |
| `--workspaces` | **false** | Analyze workspaces if available |
| `--timeout <ms>` | 120000 | Request timeout in milliseconds |
| `--output <format>` | table | Output format (table/json/tree/summary) |
| `--no-security` | - | Skip security vulnerability checks |
| `--no-bundle-size` | - | Skip bundle size analysis |

### SVG Tool

| Option | Default | Description |
|--------|---------|-------------|
| `--preset <preset>` | **balanced** | Optimization preset (minimal/balanced/aggressive) |
| `--config <path>` | - | Path to custom SVGO configuration file |
| `--plugins <plugins>` | - | Comma-separated list of SVGO plugins to enable |
| `--precision <number>` | 2 | Floating point precision for coordinates |
| `--keep-ids` | **false** | Preserve ID attributes |
| `--keep-titles` | **false** | Preserve title and desc elements for accessibility |
| `--multipass` | **false** | Run optimization multiple times for better results |
| `--glob <pattern>` | - | Glob pattern for files (e.g., "**/*.svg") |
| `-e, --extensions <ext>` | svg | File extensions to process |
| `-x, --exclude <patterns>` | - | Comma-separated exclusion patterns |
| `--in-place` | **true** | Overwrite original files (default with confirmation) |
| `--copy` | **false** | Create optimized copies with .optimized.svg suffix |
| `--backup` | **false** | Create .original.svg backup before optimizing |
| `--stdout` | **false** | Output optimized SVG to console (single files only) |
| `--output-dir <dir>` | - | Save optimized files to different directory |
| `--parallel` | **true** | Process files in parallel |
| `--max-concurrency <number>` | 4 | Maximum number of concurrent operations |
| `--watch` | **false** | Watch mode for continuous optimization during development |
| `--size-info` | **true** | Show detailed size analysis and compression ratios |
| `--no-size-info` | **false** | Hide size analysis |
| `--report <format>` | - | Export report (json, csv) |
| `--inline-styles` | **false** | Convert style attributes to inline styles |
| `--remove-viewbox` | **false** | Remove viewBox when not needed |
| `--sort-attrs` | **false** | Sort attributes alphabetically |
| `--remove-xmlns` | **false** | Remove xmlns when not needed for standalone SVGs |
| `--minify-styles` | **false** | Minify CSS within SVG |
| `--convert-colors` | **false** | Optimize color representations (hex, named, etc.) |
| `--validate-input` | **true** | Validate SVG structure before optimization |
| `--validate-output` | **true** | Validate SVG structure after optimization |
| `--skip-validation` | **false** | Skip all validation checks |

## Language Support

| Language              | Extensions                                 | Comment Syntax      |
| --------------------- | ------------------------------------------ | ------------------- |
| JavaScript/TypeScript | `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs`       | `//`, `/* */`       |
| Modern Frameworks     | `.vue`, `.svelte`, `.astro`                | Mixed syntax        |
| Web                   | `.html`, `.css`, `.scss`, `.less`, `.sass` | `<!-- -->`, `/* */` |
| Python/Shell          | `.py`, `.sh`, `.bash`                      | `#`                 |
| Config                | `.yaml`, `.yml`, `.toml`, `.conf`, `.env`  | `#`                 |

## Use Cases

```bash
# Production preparation
crapifyme base64 logo.png --css-only           # Generate CSS-ready assets
crapifyme chars --fix --strict src/             # Remove non-ASCII chars
crapifyme svg --preset=aggressive assets/icons/ # Maximize SVG compression for production
crapifyme comments --no-preserve-development src/
crapifyme logs src/
crapifyme imports src/
crapifyme deps --no-include-dev

# Web development workflow
crapifyme svg '<svg>...</svg>'                       # Quick copy-paste SVG optimization
crapifyme svg --watch --preset=balanced src/icons/  # Continuous SVG optimization during development
crapifyme base64 icons/sprite.svg --data-url-only    # For HTML embedding
crapifyme base64 images/ --size-info --verbose       # Batch process with analysis
crapifyme base64 decode "data:image/..." -o recovered.png  # Extract embedded images

# Unicode text cleanup
crapifyme chars --severity=high src/            # Detect high-priority issues only
crapifyme chars --fix --ignore-strings src/     # Fix code, preserve strings
crapifyme chars --strict --extensions="js,ts" src/  # ASCII-only for specific files

# Security audit
crapifyme deps --security-only
crapifyme deps --security-only --output=json  # For CI/CD

# Bundle size optimization
crapifyme svg --preset=aggressive '<svg>...</svg>'  # Maximum compression for inline SVG
crapifyme svg --preset=aggressive --multipass assets/ # Maximum SVG compression
crapifyme base64 assets/ --raw --quiet | wc -c     # Calculate base64 impact
crapifyme deps --size-only --include-gzip

# Dependency maintenance
crapifyme deps --outdated-only
crapifyme deps --unused-only
crapifyme deps --duplicates-only

# Legacy cleanup
crapifyme svg --backup --preset=balanced legacy/icons/ # Optimize legacy SVGs with backups
crapifyme base64 old-images/ --size-info        # Analyze legacy assets
crapifyme chars --fix legacy/                   # Fix encoding issues
crapifyme comments --keep "@author,@copyright" legacy/
crapifyme imports --style=absolute legacy/
crapifyme deps --output=summary  # Quick overview

# Framework migration
crapifyme imports --framework=nextjs --alias="@/*:./src/*" src/
crapifyme deps --pm=yarn --workspaces  # Monorepo support

# Performance optimization  
crapifyme svg --parallel --max-concurrency=8 assets/ # High-performance SVG optimization
crapifyme base64 sprites/ --css-only            # Optimize sprite assets
crapifyme logs --no-preserve-error --no-preserve-warn dist/
crapifyme imports --framework=react src/
crapifyme deps --size-only

# CI/CD Integration
crapifyme svg --report=json --quiet build/assets/     # SVG optimization pipeline with reports
crapifyme base64 build/assets/ --json --quiet   # Asset processing pipeline
crapifyme chars --severity=high --json --quiet src/   # Character encoding check
crapifyme deps --security-only --output=json --quiet  # Security check
crapifyme deps --output=summary --no-bundle-size      # Quick health check

# Quick SVG optimization workflow
crapifyme svg --quiet '<svg>...</svg>' > optimized.svg  # Save optimized SVG to file
crapifyme svg '<svg>...</svg>' | pbcopy              # Copy optimized SVG to clipboard (macOS)

# Selective optimization
crapifyme svg --keep-ids --keep-titles components/ # Preserve accessibility elements
crapifyme imports --no-remove-unused src/  # Keep unused imports
crapifyme imports --no-sort --framework=vue src/  # Group only
crapifyme deps --no-security   # Focus on size
```

## Installation

```bash
npm install -g crapifyme
```

## License

MIT
