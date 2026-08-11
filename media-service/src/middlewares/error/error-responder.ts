import type { NextFunction, Request, Response } from "express";

interface AppError extends Error {
    status?: number
    referenceId?: string
}

export default function respondError(error: AppError, request: Request, response: Response, next: NextFunction) {
    if (!error.status) {
        response.status(500).json({
            message: 'An unexpected error occurred. Please contact support.',
            referenceId: error.referenceId
        });
    } else {
        response.status(error.status).json({ message: error.message || 'Internal Server Error' });
    }
}
