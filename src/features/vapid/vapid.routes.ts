import { Router } from "express";

export function createVapidRouter(publicKey: string): Router {
  const router = Router();

  router.get("/vapid-public-key", (_req, res) => {
    res.json({ publicKey });
  });

  return router;
}
