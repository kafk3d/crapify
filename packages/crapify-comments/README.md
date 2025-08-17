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

- **Smart Preservation** - Keeps TODO, FIXME, HACK, eslint-disable, ts-ignore
- **Multi-Language** - Supports 20+ programming languages  
- **Dry Run Mode** - Preview changes before applying
- **Ultra Fast** - Processes thousands of files in seconds

## Usage

```bash
# Process current directory (default behavior)
npx crapify-comments

# Preview changes without modifying files
npx crapify-comments --dry-run

# Process specific directory
npx crapify-comments src/

# Keep custom patterns
npx crapify-comments --keep "todo,fixme,copyright"

# Process multiple directories
npx crapify-comments src/ lib/ --verbose
```

## Documentation

Full documentation available at: https://github.com/kafk3d/crapify#readme

## License

MIT