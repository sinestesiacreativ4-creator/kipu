import { Request, Response, NextFunction } from 'express';

/**
 * Validate UUID format middleware
 * Prevents invalid UUIDs from reaching the database
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const validateUUID = (paramName: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const value = req.params[paramName];

        if (!value) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: `Parameter '${paramName}' is required`,
                code: 'MISSING_PARAM'
            });
        }

        if (!UUID_REGEX.test(value)) {
            return res.status(400).json({
                error: 'Invalid ID format',
                message: `Parameter '${paramName}' must be a valid UUID`,
                code: 'INVALID_UUID',
                received: value
            });
        }

        next();
    };
};
