import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';

export class JavaScriptParser {
    parse(content: string, keepPatterns: RegExp[]): string {
        try {
            const ast = parse(content, {
                sourceType: 'module',
                plugins: ['typescript', 'jsx'],
                tokens: true,
                attachComment: false
            });

            traverse(ast, {
                enter(path) {
                    const { leadingComments, trailingComments } = path.node;

                    if (leadingComments) {
                        path.node.leadingComments = leadingComments.filter(comment =>
                            keepPatterns.some(pattern => pattern.test(comment.value))
                        );
                    }

                    if (trailingComments) {
                        path.node.trailingComments = trailingComments.filter(comment =>
                            keepPatterns.some(pattern => pattern.test(comment.value))
                        );
                    }
                }
            });

            const { code } = generate(ast, {
                retainLines: true,
                compact: false
            });

            return code;
        } catch {
            return this.fallbackParse(content, keepPatterns);
        }
    }

    private fallbackParse(content: string, keepPatterns: RegExp[]): string {
        let result = content;

        result = result.replace(/\/\/.*$/gm, (match) => {
            if (keepPatterns.some(p => p.test(match))) return match;
            return '';
        });

        result = result.replace(/\/\*[\s\S]*?\*\//g, (match) => {
            if (keepPatterns.some(p => p.test(match))) return match;
            return '';
        });

        return result;
    }
}