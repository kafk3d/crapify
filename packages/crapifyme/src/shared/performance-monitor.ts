import { Logger } from './logger';

export interface PerformanceMetrics {
    processingTime: number;
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
    };
    tokensProcessed: number;
    fileSize: number;
    throughput: number; 
}

export interface PerformanceBenchmark {
    baseline: PerformanceMetrics;
    optimized: PerformanceMetrics;
    improvement: {
        processingTimeReduction: number; 
        memoryReduction: number; 
        throughputIncrease: number; 
    };
}

export class PerformanceMonitor {
    private logger: Logger;
    private startTime: number = 0;
    private startMemory: NodeJS.MemoryUsage | null = null;

    constructor(logger?: Logger) {
        this.logger = logger || new Logger(false, false, false);
    }

    startMonitoring(): void {
        if (global.gc) {
            global.gc();
        }
        
        this.startTime = performance.now();
        this.startMemory = process.memoryUsage();
    }

    stopMonitoring(tokensProcessed: number, fileSize: number): PerformanceMetrics {
        const endTime = performance.now();
        const endMemory = process.memoryUsage();
        
        const processingTime = endTime - this.startTime;
        const throughput = tokensProcessed / processingTime;

        const metrics: PerformanceMetrics = {
            processingTime,
            memoryUsage: {
                heapUsed: endMemory.heapUsed,
                heapTotal: endMemory.heapTotal,
                external: endMemory.external,
                rss: endMemory.rss
            },
            tokensProcessed,
            fileSize,
            throughput
        };

        
        return metrics;
    }

    getMemoryUsage(): NodeJS.MemoryUsage {
        return process.memoryUsage();
    }

    static compareBenchmarks(baseline: PerformanceMetrics, optimized: PerformanceMetrics): PerformanceBenchmark {
        const processingTimeReduction = ((baseline.processingTime - optimized.processingTime) / baseline.processingTime) * 100;
        const memoryReduction = ((baseline.memoryUsage.heapUsed - optimized.memoryUsage.heapUsed) / baseline.memoryUsage.heapUsed) * 100;
        const throughputIncrease = ((optimized.throughput - baseline.throughput) / baseline.throughput) * 100;

        return {
            baseline,
            optimized,
            improvement: {
                processingTimeReduction,
                memoryReduction,
                throughputIncrease
            }
        };
    }

    private logMetrics(metrics: PerformanceMetrics): void {
        this.logger.info(`Performance Metrics:
  Processing Time: ${metrics.processingTime.toFixed(2)}ms
  Memory Usage: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB
  Tokens Processed: ${metrics.tokensProcessed}
  File Size: ${(metrics.fileSize / 1024).toFixed(2)}KB
  Throughput: ${metrics.throughput.toFixed(2)} tokens/ms`);
    }

    static generateReport(benchmarks: PerformanceBenchmark[]): string {
        const report = ['Performance Optimization Report', '='.repeat(40)];
        
        benchmarks.forEach((benchmark, index) => {
            report.push(`\nBenchmark ${index + 1}:`);
            report.push(`  Processing Time: ${benchmark.baseline.processingTime.toFixed(2)}ms → ${benchmark.optimized.processingTime.toFixed(2)}ms (${benchmark.improvement.processingTimeReduction.toFixed(1)}% improvement)`);
            report.push(`  Memory Usage: ${(benchmark.baseline.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB → ${(benchmark.optimized.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB (${benchmark.improvement.memoryReduction.toFixed(1)}% improvement)`);
            report.push(`  Throughput: ${benchmark.baseline.throughput.toFixed(2)} → ${benchmark.optimized.throughput.toFixed(2)} tokens/ms (${benchmark.improvement.throughputIncrease.toFixed(1)}% improvement)`);
        });

        return report.join('\n');
    }
}

export class OptimizedStringBuilder {
    private chunks: string[] = [];
    private totalLength: number = 0;
    private readonly chunkSizeLimit: number;

    constructor(chunkSizeLimit: number = 64 * 1024) { 
        this.chunkSizeLimit = chunkSizeLimit;
    }

    append(content: string): void {
        this.chunks.push(content);
        this.totalLength += content.length;

        if (this.chunks.length > 1000) {
            this.consolidate();
        }
    }

    toString(): string {
        if (this.chunks.length === 0) return '';
        if (this.chunks.length === 1) return this.chunks[0];
        
        return this.chunks.join('');
    }

    get length(): number {
        return this.totalLength;
    }

    clear(): void {
        this.chunks = [];
        this.totalLength = 0;
    }

    private consolidate(): void {
        if (this.chunks.length <= 1) return;

        const consolidated = this.chunks.join('');
        this.chunks = [consolidated];
    }
}