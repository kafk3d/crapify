import { glob } from 'glob';
import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';

export async function findFiles(
    patterns: string[],
    exclude: string[] = []
): Promise<string[]> {
    const allFiles: string[] = [];
    for (const pattern of patterns) {
        const files = await glob(pattern, {
            ignore: ['**/node_modules/**', ...exclude]
        });
        allFiles.push(...files);
    }
    return [...new Set(allFiles)];
}

export async function readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
}

export async function writeFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf-8');
}

export function getFileExtension(filePath: string): string {
    return path.extname(filePath).slice(1);
}

export function showBanner(): void {
    console.log('█▀▀ █▀█ ▄▀█ █▀█ █ █▀▀ █▄█');
    console.log('█▄▄ █▀▄ █▀█ █▀▀ █ █▀░ ░█░');
    console.log('');
}

export function resolvePath(inputPath: string): string {
    if (path.isAbsolute(inputPath)) {
        return inputPath;
    }
    return path.resolve(process.cwd(), inputPath);
}

export function createFilePatterns(paths: string[], extensions: string[]): string[] {
    return paths.map(p => {
        const resolved = resolvePath(p);
        
        if (p.includes('*')) return resolved;
        
        try {
            const stat = fssync.statSync(resolved);
            if (stat.isFile()) return resolved;
            if (stat.isDirectory()) {
                return `${resolved}/**/*.{${extensions.join(',')}}`;
            }
        } catch {
            // If stat fails, assume it's a pattern or directory
        }
        
        return `${resolved}/**/*.{${extensions.join(',')}}`;
    });
}