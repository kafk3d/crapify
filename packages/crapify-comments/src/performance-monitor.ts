import { Logger } from '@kafked/shared';

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
    throughput: number; // tokens per millisecond
}

export interface PerformanceBenchmark {
    baseline: PerformanceMetrics;
    optimized: PerformanceMetrics;
    improvement: {
        processingTimeReduction: number; // percentage
        memoryReduction: number; // percentage
        throughputIncrease: number; // percentage
    };
}

/**
 * Performance monitoring utility for tracking tokenizer and comment remover performance
 */
export class PerformanceMonitor {
    private logger: Logger;
    private startTime: number = 0;
    private startMemory: NodeJS.MemoryUsage | null = null;

    constructor(logger?: Logger) {
        this.logger = logger || new Logger(false, false, false);
    }

    /**
     * Start performance monitoring
     */
    startMonitoring(): void {
        // Force garbage collection if available (for more accurate memory measurements)
        if (global.gc) {
            global.gc();
        }
        
        this.startTime = performance.now();
        this.startMemory = process.memoryUsage();
    }

    /**
     * Stop monitoring and return metrics
     */
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

        this.logMetrics(metrics);
        return metrics;
    }

    /**
     * Monitor memory usage during processing
     */
    getMemoryUsage(): NodeJS.MemoryUsage {
        return process.memoryUsage();
    }

    /**
     * Check if memory usage is within acceptable limits
     */
    isMemoryUsageAcceptable(currentMemory: NodeJS.MemoryUsage, fileSize: number): boolean {
        // Memory usage should not exceed 10x the file size (reasonable for tokenization)
        const maxAcceptableMemory = fileSize * 10;
        return currentMemory.heapUsed < maxAcceptableMemory;
    }

    /**
     * Compare performance metrics between two implementations
     */
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

    /**
     * Log performance metrics
     */
    private logMetrics(metrics: PerformanceMetrics): void {
        this.logger.info(`Performance Metrics:
  Processing Time: ${metrics.processingTime.toFixed(2)}ms
  Memory Usage: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB
  Tokens Processed: ${metrics.tokensProcessed}
  File Size: ${(metrics.fileSize / 1024).toFixed(2)}KB
  Throughput: ${metrics.throughput.toFixed(2)} tokens/ms`);
    }

    /**
     * Create a performance report
     */
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

/**
 * Memory-efficient string builder for large content processing
 */
export class OptimizedStringBuilder {
    private chunks: string[] = [];
    private totalLength: number = 0;
    private readonly chunkSizeLimit: number;

    constructor(chunkSizeLimit: number = 64 * 1024) { // 64KB chunks by default
        this.chunkSizeLimit = chunkSizeLimit;
    }

    /**
     * Append content to the builder
     */
    append(content: string): void {
        this.chunks.push(content);
        this.totalLength += content.length;

        // Periodically consolidate chunks to prevent excessive memory fragmentation
        if (this.chunks.length > 1000) {
            this.consolidate();
        }
    }

    /**
     * Get the final string
     */
    toString(): string {
        if (this.chunks.length === 0) return '';
        if (this.chunks.length === 1) return this.chunks[0];
        
        return this.chunks.join('');
    }

    /**
     * Get the current length without building the string
     */
    get length(): number {
        return this.totalLength;
    }

    /**
     * Clear the builder
     */
    clear(): void {
        this.chunks = [];
        this.totalLength = 0;
    }

    /**
     * Consolidate chunks to reduce memory fragmentation
     */
    private consolidate(): void {
        if (this.chunks.length <= 1) return;

        const consolidated = this.chunks.join('');
        this.chunks = [consolidated];
    }
}