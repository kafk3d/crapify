# crapify-comments

> Smart comment removal tool that preserves important comments

Part of the [Crapify Tools](https://github.com/kafk3d/crapify) collection.

## Quick Start

```bash
# Run from any directory (processes current directory by default)
npx crapify-comments

# Preview changes before applying
npx crapify-comments --dry-run

# Process specific directory
npx crapify-comments src/
```

## Features

- **Enhanced Preservation Rules** - Intelligent categorization of comments
  - **Framework**: Svelte, Vue, React, TypeScript, Webpack directives
  - **Development**: TODO, FIXME, HACK, NOTE, XXX, BUG, WARN keywords
  - **Tooling**: ESLint, Prettier, TypeScript, Coverage directives  
  - **Documentation**: JSDoc comments with @ annotations
- **Context-Aware Parsing** - Correctly handles regex literals and string contexts
- **Custom Rules** - Add your own preservation patterns with priority control
- **Multi-Language** - Supports 20+ programming languages  
- **Dry Run Mode** - Preview changes before applying
- **Ultra Fast** - Processes thousands of files in seconds

## Usage

### Basic Usage

```bash
# Process current directory (default behavior)
npx crapify-comments

# Preview changes without modifying files
npx crapify-comments --dry-run

# Process specific directory
npx crapify-comments src/
```

### Preservation Control

```bash
# Disable specific preservation categories
npx crapify-comments --no-preserve-framework
npx crapify-comments --no-preserve-development

# Add custom preservation patterns
npx crapify-comments --custom-rules "api,config,important"

# Set custom rule priority (higher = more important)
npx crapify-comments --custom-rules "critical" --rule-priority 1000

# Legacy keep patterns (still supported)
npx crapify-comments --keep "todo,fixme,copyright"
```

### Advanced Options

```bash
# Use legacy tokenizer (less accurate but faster)
npx crapify-comments --legacy-tokenizer

# Verbose output with preservation details
npx crapify-comments --verbose

# Process multiple directories
npx crapify-comments src/ lib/ --verbose
```

## Documentation

Full documentation available at: https://github.com/kafk3d/crapify#readme

## License

MIT