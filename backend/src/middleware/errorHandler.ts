import { Request, Response, NextFunction } from 'express';

/**
 * Application error with metadata
 */
export interface AppError extends Error {
    statusCode?: number;
    code?: string;
    isOperational?: boolean;
    details?: any;
}

/**
 * Create operational error
 */
export function createError(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: any
): AppError {
    const error = new Error(message) as AppError;
    error.statusCode = statusCode;
    error.code = code;
    error.isOperational = true;
    error.details = details;
    return error;
}

/**
 * Global error handler middleware
 * MUST be last middleware in chain
 */
export function errorHandler(
    err: AppError,
    req: Request,
    res: Response,
    next: NextFunction
) {
    const statusCode = err.statusCode || 500;
    const isOperational = err.isOperational !== false;
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;

    // Structured error logging
    const logEntry = {
        timestamp: new Date().toISOString(),
        requestId,
        method: req.method,
        path: req.path,
        statusCode,
        code: err.code || 'UNKNOWN_ERROR',
        message: err.message,
        isOperational,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.socket.remoteAddress
    };

    if (statusCode >= 500) {
        console.error('[ErrorHandler] Server Error:', logEntry);
        if (!isOperational) {
            console.error('[ErrorHandler] Stack:', err.stack);
        }
    } else {
        console.warn('[ErrorHandler] Client Error:', logEntry);
    }

    // Send response
    res.status(statusCode).json({
        error: isOperational ? err.message : 'Internal server error',
        code: err.code || 'INTERNAL_ERROR',
        requestId,
        timestamp: logEntry.timestamp,
        ...(process.env.NODE_ENV === 'development' && !isOperational ? {
            stack: err.stack,
            details: err.details
        } : {})
    });
}

/**
 * Async handler wrapper
 * Eliminates try-catch boilerplate
 */
export function asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * 404 handler
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
    const error = createError(
        `Route not found: ${req.method} ${req.path}`,
        404,
        'ROUTE_NOT_FOUND'
    );
    next(error);
}

/**
 * Validation error formatter
 */
export function formatValidationError(errors: any[]): AppError {
    const messages = errors.map(err => {
        if (typeof err === 'string') return err;
        return err.message || err.msg || JSON.stringify(err);
    });

    return createError(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        { errors: messages }
    );
}

/**
 * Request timeout handler
 */
export function timeoutHandler(timeoutMs: number = 30000) {
    return (req: Request, res: Response, next: NextFunction) => {
        const timeout = setTimeout(() => {
            const error = createError(
                'Request timeout',
                408,
                'REQUEST_TIMEOUT'
            );
            next(error);
        }, timeoutMs);

        res.on('finish', () => clearTimeout(timeout));
        res.on('close', () => clearTimeout(timeout));

        next();
    };
}
