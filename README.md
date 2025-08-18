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

npx crapifyme deps
# Analyze dependencies: security, size, unused

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

crapifyme imports src/
# Optimize all imports in src directory

crapifyme deps
# Analyze project dependencies for security and optimization
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
crapifyme comments --no-preserve-development src/
crapifyme logs src/
crapifyme imports src/
crapifyme deps --no-include-dev

# Security audit
crapifyme deps --security-only
crapifyme deps --security-only --output=json  # For CI/CD

# Bundle size optimization
crapifyme deps --size-only --include-gzip

# Dependency maintenance
crapifyme deps --outdated-only
crapifyme deps --unused-only
crapifyme deps --duplicates-only

# Legacy cleanup
crapifyme comments --keep "@author,@copyright" legacy/
crapifyme imports --style=absolute legacy/
crapifyme deps --output=summary  # Quick overview

# Framework migration
crapifyme imports --framework=nextjs --alias="@/*:./src/*" src/
crapifyme deps --pm=yarn --workspaces  # Monorepo support

# Performance optimization  
crapifyme logs --no-preserve-error --no-preserve-warn dist/
crapifyme imports --framework=react src/
crapifyme deps --size-only

# CI/CD Integration
crapifyme deps --security-only --output=json --quiet  # Security check
crapifyme deps --output=summary --no-bundle-size      # Quick health check

# Selective optimization
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
