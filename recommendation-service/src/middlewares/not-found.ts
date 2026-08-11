import type { NextFunction, Request, Response } from "express";

export default function notFound(request: Request, response: Response, next: NextFunction) {
    response.status(404).json({ error: 'Not Found' });
}
