import { CrapifyComments } from '../index';

describe('CLI Integration Tests', () => {
    describe('Enhanced preservation rule options', () => {
        it('should accept new preservation rule options', () => {
            const options = {
                preserveFramework: true,
                preserveDevelopment: false,
                preserveTooling: true,
                preserveDocumentation: false,
                customRules: 'api,config',
                rulePriority: 150,
                useEnhancedTokenizer: true
            };

            expect(() => new CrapifyComments(options)).not.toThrow();
        });

        it('should maintain backward compatibility with keep patterns', () => {
            const options = {
                keep: 'todo,fixme,hack',
                useEnhancedTokenizer: true
            };

            expect(() => new CrapifyComments(options)).not.toThrow();
        });

        it('should handle mixed old and new options', () => {
            const options = {
                keep: 'todo,fixme',
                preserveFramework: false,
                customRules: 'api,config',
                useEnhancedTokenizer: true
            };

            expect(() => new CrapifyComments(options)).not.toThrow();
        });

        it('should parse custom rules correctly', () => {
            const options = {
                customRules: 'pattern1,pattern2,pattern3',
                rulePriority: 200,
                useEnhancedTokenizer: true
            };

            const tool = new CrapifyComments(options);
            const ruleManager = (tool as any).remover.getRuleManager();
            
            
            const rules = ruleManager.getRules();
            const customRules = rules.filter((rule: any) => rule.name.startsWith('cli-custom-pattern-'));
            expect(customRules.length).toBe(3);
        });

        it('should disable rule categories when explicitly set to false', () => {
            const options = {
                preserveFramework: false,
                preserveDevelopment: false,
                useEnhancedTokenizer: true
            };

            const tool = new CrapifyComments(options);
            const ruleManager = (tool as any).remover.getRuleManager();
            
            
            const rules = ruleManager.getRules();
            const frameworkRules = rules.filter((rule: any) => rule.category === 'framework');
            const developmentRules = rules.filter((rule: any) => rule.category === 'development');
            
            expect(frameworkRules.length).toBe(0);
            expect(developmentRules.length).toBe(0);
        });
    });

    describe('Preservation info display', () => {
        it('should generate correct preservation info for default options', () => {
            const tool = new CrapifyComments({});
            const info = (tool as any).getPreservationInfo();
            
            expect(info).toContain('Framework');
            expect(info).toContain('Development');
            expect(info).toContain('Tooling');
            expect(info).toContain('Documentation');
        });

        it('should generate correct preservation info for disabled options', () => {
            const tool = new CrapifyComments({
                preserveFramework: false,
                preserveDevelopment: false
            });
            const info = (tool as any).getPreservationInfo();
            
            expect(info).not.toContain('Framework');
            expect(info).not.toContain('Development');
            expect(info).toContain('Tooling');
            expect(info).toContain('Documentation');
        });

        it('should show custom rules count in preservation info', () => {
            const tool = new CrapifyComments({
                customRules: 'pattern1,pattern2'
            });
            const info = (tool as any).getPreservationInfo();
            
            expect(info).toContain('Custom (2)');
        });
    });
});