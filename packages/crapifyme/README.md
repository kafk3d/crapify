# CrapifyMe - Ultra-Fast Developer Productivity Tools

```
█▀▀ █▀█ ▄▀█ █▀█ █ █▀▀ █▄█   ▀█▀ █▀█ █▀█ █   █▀
█▄▄ █▀▄ █▀█ █▀▀ █ █▀░ ░█░   ░█░ █▄█ █▄█ █▄▄ ▄█
```

> **Ultra-fast, intelligent developer productivity CLI tools**

## Quick Start

```bash
# Install globally
npm install -g crapifyme

# Remove comments from your code
crapifyme comments src/

# Remove console.log statements
crapifyme logs src/

# Preview changes before applying
crapifyme comments --dry-run src/
```

## Available Tools

### 🧹 Comments Removal
Remove code comments while preserving important ones (TODO, FIXME, JSDoc, etc.)

```bash
crapifyme comments src/
crapifyme comments --dry-run .
crapifyme comments --no-preserve-framework src/
```

### 📝 Console Logs Removal  
Remove console.log statements while preserving error/warn messages

```bash
crapifyme logs src/
crapifyme logs --no-preserve-error src/
crapifyme logs --keep "debug,trace" src/
```

## Features

- **🚀 Ultra Fast** - Processes thousands of files in seconds
- **🧠 Smart Preservation** - Keeps important comments and logs
- **🔍 Multi-Language** - Supports 20+ programming languages  
- **💾 Version Control Safety** - Requires VCS or `--force` flag
- **👀 Preview Mode** - `--dry-run` to see changes before applying
- **📊 Detailed Reports** - Shows exactly what was processed

## Global Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without modifying files |
| `--force` | Proceed without version control detection |
| `--verbose` | Detailed output |
| `--quiet` | Suppress output |
| `--json` | Output as JSON |

## Examples

### Comments Removal
```bash
# Remove comments from specific directory
crapifyme comments src/

# Preview changes
crapifyme comments --dry-run .

# Keep custom patterns
crapifyme comments --keep "copyright,license,author" src/

# Process specific file types
crapifyme comments --extensions "js,ts" src/

# Disable framework comment preservation
crapifyme comments --no-preserve-framework src/
```

### Console Logs Removal
```bash
# Remove console.log but keep error/warn
crapifyme logs src/

# Remove all console statements
crapifyme logs --no-preserve-error --no-preserve-warn src/

# Keep specific patterns
crapifyme logs --keep "performance,benchmark" src/

# Process TypeScript files only
crapifyme logs --extensions "ts,tsx" src/
```

## Supported Languages

| Language | Extensions | Comment Types |
|----------|------------|---------------|
| **JavaScript/TypeScript** | `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs`, `.cjs` | `//` and `/* */` |
| **Vue/Svelte** | `.vue`, `.svelte` | Mixed syntax support |
| **HTML/XML** | `.html`, `.xml`, `.svg` | `<!-- -->` |
| **CSS/SCSS** | `.css`, `.scss`, `.sass`, `.less` | `/* */` and `//` |
| **Python** | `.py` | `#` |
| **Shell Scripts** | `.sh`, `.bash`, `.zsh`, `.fish` | `#` |

## Programmatic Usage

```typescript
import { CommentsProcessor, LogsProcessor } from 'crapifyme';

// Remove comments
const commentsProcessor = new CommentsProcessor({
  keep: ['todo', 'fixme'],
  preserveFramework: true
});

const result = commentsProcessor.processFile(sourceCode);

// Remove console logs
const logsProcessor = new LogsProcessor({
  preserveError: true,
  preserveWarn: true
});

const result2 = logsProcessor.processFile(sourceCode);
```

## Homepage

Visit [crapify.me](https://crapify.me) for more information and documentation.

## License

MIT License - see [LICENSE](../../LICENSE) file for details.