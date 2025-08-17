# Crapify CLI Tools - Development Task Specification

Create a collection of 5 specialized npm CLI tools under the "crapify" brand for developer productivity. Each tool should be a standalone package but follow consistent patterns and branding.

## Core Requirements

### Architecture
- TypeScript-based CLI tools using Commander.js
- Monorepo structure (lerna/nx or similar)
- Consistent API patterns across all tools
- Support for configuration files (.crapifyrc, crapify.config.js)
- Colored terminal output with progress indicators
- Dry-run mode for all tools
- JSON/structured output options for CI/CD integration

### Shared Features
- Support for glob patterns and file filtering
- Exclude/include patterns
- Verbose and quiet modes
- Configuration file support
- Exit codes for CI/CD (0 = success, 1 = issues found, 2 = errors)
- Plugin architecture for extensibility

## Tool Specifications

### 1. crapify-comments
**Purpose**: Remove code comments while preserving important ones

**Usage Examples**:
```bash
npx crapify-comments
npx crapify-comments --keep="todo,fixme,hack,ts-ignore,eslint-disable"
npx crapify-comments --extensions="js,ts,jsx,tsx,vue,svelte" --dry-run