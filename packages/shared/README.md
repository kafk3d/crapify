# @kafked/shared

> Shared utilities and components for Crapify Tools

This package contains common utilities, types, and components used across all Crapify Tools.

## Installation

```bash
npm install @kafked/shared
```

## Usage

```typescript
import { Logger, loadConfig, findFiles } from '@kafked/shared';

const logger = new Logger(verbose, quiet, json);
const config = loadConfig('tool-name');
const files = await findFiles(['src/**/*.js'], ['node_modules']);
```

## Exports

- `Logger` - Colored CLI logging
- `loadConfig` - Configuration file loading
- `findFiles` - File pattern matching
- `showBanner` - ASCII banner display
- `ExitCode` - Standard exit codes
- Utility functions for path resolution and file operations

## Documentation

Part of [Crapify Tools](https://github.com/kafk3d/crapify) - see main repository for complete documentation.

## License

MIT