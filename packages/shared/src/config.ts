import { cosmiconfigSync } from 'cosmiconfig';
import { ToolConfig } from './types';

export function loadConfig(toolName: string): ToolConfig {
    const explorer = cosmiconfigSync('crapify');
    const result = explorer.search();

    if (result?.config?.[toolName]) {
        return result.config[toolName];
    }

    return {};
}