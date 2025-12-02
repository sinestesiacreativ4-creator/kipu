/**
 * Module 5: Circuit Breaker
 * Handles model overload gracefully without blocking pipeline
 */

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
    threshold?: number; // Failures before opening
    timeout?: number; // Time to wait before half-open (ms)
    resetTimeout?: number; // Time in half-open before closing (ms)
}

export class CircuitBreaker {
    private failureCount = 0;
    private successCount = 0;
    private lastFailureTime = 0;
    private state: CircuitState = 'CLOSED';
    private readonly threshold: number;
    private readonly timeout: number;
    private readonly resetTimeout: number;

    constructor(options: CircuitBreakerOptions = {}) {
        this.threshold = options.threshold || 3;
        this.timeout = options.timeout || 30000; // 30s
        this.resetTimeout = options.resetTimeout || 10000; // 10s
    }

    async execute<T>(
        fn: () => Promise<T>,
        fallback?: () => Promise<T>
    ): Promise<T> {
        // Check circuit state
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                console.log('[CircuitBreaker] Entering HALF_OPEN state');
                this.state = 'HALF_OPEN';
                this.successCount = 0;
            } else {
                console.warn('[CircuitBreaker] Circuit OPEN, using fallback');
                if (fallback) return fallback();
                throw new Error('Circuit breaker OPEN, no fallback available');
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error: any) {
            this.onFailure(error);

            // Use fallback if available
            if (fallback) {
                console.warn('[CircuitBreaker] Primary failed, executing fallback');
                try {
                    return await fallback();
                } catch (fallbackError) {
                    console.error('[CircuitBreaker] Fallback also failed');
                    throw fallbackError;
                }
            }

            throw error;
        }
    }

    private onSuccess() {
        this.failureCount = 0;

        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= 2) {
                console.log('[CircuitBreaker] Closing circuit after successful recovery');
                this.state = 'CLOSED';
                this.successCount = 0;
            }
        }
    }

    private onFailure(error: any) {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        // Check for overload errors
        const is503 = error.message?.includes('503') || error.status === 503;
        const is429 = error.message?.includes('429') || error.status === 429;
        const isOverloaded = error.message?.includes('overloaded') ||
            error.message?.includes('Resource has been exhausted');

        if (is503 || is429 || isOverloaded) {
            console.warn(`[CircuitBreaker] Model overload detected (${this.failureCount}/${this.threshold})`);

            if (this.failureCount >= this.threshold) {
                this.state = 'OPEN';
                console.error('[CircuitBreaker] Circuit OPENED due to repeated overload failures');
            }
        }

        // If in HALF_OPEN and fails, reopen immediately
        if (this.state === 'HALF_OPEN') {
            this.state = 'OPEN';
            console.warn('[CircuitBreaker] Circuit reopened after failure in HALF_OPEN state');
        }
    }

    getState(): CircuitState {
        return this.state;
    }

    getMetrics() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime
        };
    }

    reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = 0;
        console.log('[CircuitBreaker] Circuit manually reset');
    }
}

// Global circuit breaker instance for Gemini API
export const modelCircuitBreaker = new CircuitBreaker({
    threshold: 3,
    timeout: 60000, // 1 minute
    resetTimeout: 10000
});

/**
 * Execute with exponential backoff retry
 */
export async function executeWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            const is503 = error.message?.includes('503') || error.status === 503;
            const is429 = error.message?.includes('429') || error.status === 429;

            if ((is503 || is429) && attempt < maxRetries) {
                const backoffDelay = initialDelay * Math.pow(2, attempt);
                console.warn(
                    `[Backoff] Attempt ${attempt + 1}/${maxRetries} failed. ` +
                    `Retrying in ${backoffDelay}ms...`
                );
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                continue;
            }

            throw error;
        }
    }

    throw lastError;
}
