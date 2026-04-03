import { Router } from "express";
import { forgotPassword, login, me, register, resetPassword } from "../controllers/authController.js";
import { googleAuthCallback, startGoogleAuth } from "../controllers/googleAuthController.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", auth, me);
router.get("/google", startGoogleAuth);
router.get("/google/callback", googleAuthCallback);

export default router;
