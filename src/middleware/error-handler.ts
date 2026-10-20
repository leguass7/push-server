import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import type { Logger } from "../lib/logger.js";

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "not_found" });
}

export function createErrorHandler(logger: Logger) {
  return function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "invalid_request", issues: err.issues });
      return;
    }

    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }

    logger.error({ err, path: req.path }, "unhandled_error");
    res.status(500).json({ error: "internal_error" });
  };
}
