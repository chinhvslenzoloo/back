import { Router } from "express";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "srm-saas-mini-backend" });
});

export default router;
