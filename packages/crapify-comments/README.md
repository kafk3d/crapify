# crapify-comments

> Smart comment removal tool that preserves important comments

Part of the [Crapify Tools](https://github.com/kafk3d/crapify) collection.

## Quick Start

```bash
# Install globally
npm install -g crapify-comments

# Use anywhere
crapify-comments src/ --dry-run
```

## Features

- **Smart Preservation** - Keeps TODO, FIXME, HACK, eslint-disable, ts-ignore
- **Multi-Language** - Supports 20+ programming languages  
- **Dry Run Mode** - Preview changes before applying
- **Ultra Fast** - Processes thousands of files in seconds

## Usage

```bash
# Process current directory
crapify-comments .

# Preview changes
crapify-comments src/ --dry-run

# Keep custom patterns
crapify-comments src/ --keep "todo,fixme,copyright"
```

## Documentation

Full documentation available at: https://github.com/kafk3d/crapify#readme

## License

MIT