# Crapify Tools

```
█▀▀ █▀█ ▄▀█ █▀█ █ █▀▀ █▄█   ▀█▀ █▀█ █▀█ █   █▀
█▄▄ █▀▄ █▀█ █▀▀ █ █▀░ ░█░   ░█░ █▄█ █▄█ █▄▄ ▄█
```

> **Ultra-fast, intelligent developer productivity CLI tools of questionable usefulness**

## Quick Start

```bash
# Run from any directory (processes current directory by default)
npx crapify-comments

# Preview changes before applying
npx crapify-comments --dry-run

# Process specific directory
npx crapify-comments src/
```

## Tools

### `crapify-comments` - Smart Comment Removal

Intelligently removes code comments while preserving the important ones (TODO, FIXME, HACK, etc.).

```bash
# Process current directory (default behavior)
npx crapify-comments

# Preview changes without modifying files
npx crapify-comments --dry-run

# Process specific directory
npx crapify-comments src/

# Keep specific patterns
npx crapify-comments --keep "todo,fixme,hack,copyright"

# Process single file
npx crapify-comments file.js
```

#### Features

- **Smart Preservation** - Keeps TODO, FIXME, HACK, eslint-disable, ts-ignore
- **Multi-Language** - Supports 20+ programming languages
- **Dry Run Mode** - Preview changes before applying
- **Detailed Reports** - See exactly what was processed
- **Ultra Fast** - Processes thousands of files in seconds
- **Beautiful Output** - Clean, informative CLI interface

#### Supported Languages

| Language | Extensions | Comment Types |
|----------|------------|---------------|
| **JavaScript/TypeScript** | `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs`, `.cjs` | `//` and `/* */` |
| **C/C++** | `.c`, `.cpp`, `.h`, `.hpp` | `//` and `/* */` |
| **Java/C#** | `.java`, `.cs` | `//` and `/* */` |
| **HTML/XML** | `.html`, `.xml`, `.svg` | `<!-- -->` |
| **CSS/SCSS** | `.css`, `.scss`, `.sass`, `.less` | `/* */` and `//` |
| **Vue/Svelte** | `.vue`, `.svelte` | Mixed syntax support |
| **Python** | `.py` | `#` |
| **Shell Scripts** | `.sh`, `.bash`, `.zsh`, `.fish` | `#` |
| **Ruby/Perl** | `.rb`, `.pl` | `#` |
| **YAML** | `.yaml`, `.yml` | `#` |

## Usage

### Basic Examples

```bash
# Process current directory (default)
npx crapify-comments

# Process specific files
npx crapify-comments src/app.js src/utils.ts

# Process with custom extensions
npx crapify-comments --extensions "js,ts,vue"

# Exclude certain patterns
npx crapify-comments --exclude "node_modules,dist,*.min.js"
```

### Advanced Examples

```bash
# Keep custom patterns
npx crapify-comments --keep "todo,fixme,hack,copyright,license"

# Verbose output with dry run
npx crapify-comments --dry-run --verbose

# JSON output for CI/CD
npx crapify-comments --json

# Quiet mode (errors only)
npx crapify-comments --quiet
```

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--keep` | `-k` | Comma-separated patterns to preserve | `todo,fixme,hack,ts-ignore,eslint-disable` |
| `--extensions` | `-e` | File extensions to process | `js,ts,jsx,tsx,vue,svelte` |
| `--exclude` | `-x` | Glob patterns to exclude | - |
| `--dry-run` | - | Preview changes without modifying files | `false` |
| `--verbose` | `-v` | Detailed output | `false` |
| `--quiet` | `-q` | Suppress output | `false` |
| `--json` | - | JSON output format | `false` |
| `--help` | `-h` | Show help | - |
| `--version` | `-V` | Show version | - |

## Real-World Examples

### Clean up legacy codebase
```bash
# Preview what would be removed from current directory
npx crapify-comments --dry-run --verbose

# Apply changes to specific directory
npx crapify-comments legacy-app/ --keep "todo,fixme,copyright"
```

### CI/CD Integration
```bash
# Check if files need comment cleanup in current directory
npx crapify-comments --json > comment-report.json

# Check specific directory
npx crapify-comments src/ --json > comment-report.json

# Exit codes:
# 0 = No changes needed
# 1 = Comments found and processed
# 2 = Errors occurred
```

### Pre-commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit
npx crapify-comments $(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|jsx|tsx)$') --dry-run
```

## Development

```bash
# Clone repository
git clone https://github.com/kafk3d/crapify.git
cd crapify-tools

# Install dependencies
npm install

# Build all packages
npm run build

# Test locally
node packages/crapify-comments/dist/cli.js --help
```

## Roadmap

- **crapify-logs** - Debug statement removal

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>Built for developers who value clean code</strong>
</p>

<p align="center">
  <a href="https://github.com/kafk3d/crapify/issues">Report Bug</a> •
  <a href="https://github.com/kafk3d/crapify/issues">Request Feature</a> •
  <a href="https://github.com/kafk3d/crapify/discussions">Discussions</a>
</p>