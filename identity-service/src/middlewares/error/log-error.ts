import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";

interface AppError extends Error {
    status?: number
    referenceId?: string
}

export default function logError(error: AppError, request: Request, response: Response, next: NextFunction) {
    if (!error.status) {
        error.referenceId = randomUUID()
        console.error(`[${error.referenceId}] Error occurred during ${request.method} ${request.url}:`, error);
    } else {
        console.error(`Error occurred during ${request.method} ${request.url}:`, error);
    }
    next(error);
}
