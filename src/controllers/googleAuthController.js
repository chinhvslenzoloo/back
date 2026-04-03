import { randomUUID } from "crypto";
import { Issuer, generators } from "openid-client";
import { prisma } from "../config/prisma.js";
import { hashPassword, signToken } from "../services/authService.js";

const stateStore = new Map(); // state -> { expiresAtMs, nonce }

async function getGoogleClient() {
  const issuer = await Issuer.discover("https://accounts.google.com");
  return new issuer.Client({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uris: [process.env.GOOGLE_CALLBACK_URL],
    response_types: ["code"]
  });
}

function requireGoogleEnv() {
  const missing = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CALLBACK_URL"].filter((k) => !process.env[k]);
  if (missing.length) {
    const err = new Error(`Missing env: ${missing.join(", ")}`);
    err.statusCode = 500;
    throw err;
  }
}

export async function startGoogleAuth(req, res, next) {
  try {
    requireGoogleEnv();
    const client = await getGoogleClient();
    const state = generators.state();
    const nonce = generators.nonce();
    stateStore.set(state, { expiresAtMs: Date.now() + 10 * 60 * 1000, nonce });

    const url = client.authorizationUrl({
      scope: "openid email profile",
      state,
      nonce,
      prompt: "select_account"
    });
    return res.redirect(url);
  } catch (error) {
    return next(error);
  }
}

export async function googleAuthCallback(req, res, next) {
  try {
    requireGoogleEnv();
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).json({ message: "Missing code/state" });

    const stateData = stateStore.get(String(state));
    stateStore.delete(String(state));
    if (!stateData || stateData.expiresAtMs < Date.now()) {
      return res.status(400).json({ message: "Invalid state" });
    }

    const client = await getGoogleClient();
    const params = client.callbackParams(req);
    const tokenSet = await client.callback(process.env.GOOGLE_CALLBACK_URL, params, {
      state: String(state),
      nonce: stateData.nonce
    });
    const claims = tokenSet.claims();

    const email = claims.email;
    const sub = claims.sub;
    const fullName = claims.name || "Google User";
    if (!email || !sub) return res.status(400).json({ message: "Missing Google profile" });

    const normalizedEmail = String(email).trim().toLowerCase();
    const systemOwnerEmail = process.env.SYSTEM_OWNER_EMAIL ? String(process.env.SYSTEM_OWNER_EMAIL).trim().toLowerCase() : null;
    const role = systemOwnerEmail && normalizedEmail === systemOwnerEmail ? "owner" : "sales";

    let user = await prisma.user.findFirst({
      where: { OR: [{ googleSub: String(sub) }, { email: normalizedEmail }], deletedAt: null }
    });

    if (!user) {
      const tenantId = randomUUID();
      const userId = randomUUID();
      const randomPass = randomUUID();
      const passwordHash = await hashPassword(randomPass);
      const tenantName = `${String(email).split("@")[0]}'s workspace`;

      const [, created] = await prisma.$transaction([
        prisma.tenant.create({ data: { id: tenantId, name: tenantName } }),
        prisma.user.create({
          data: {
            id: userId,
            tenantId,
            fullName,
            email: normalizedEmail,
            passwordHash,
            googleSub: String(sub),
            role
          }
        })
      ]);
      user = created;
    } else if (!user.googleSub) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleSub: String(sub) }
      });
    }

    if (user.role === "owner" && systemOwnerEmail && normalizedEmail !== systemOwnerEmail) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: "sales" }
      });
    }

    const token = signToken(user);

    if (process.env.APP_BASE_URL) {
      const redirectUrl = new URL("/auth/callback", process.env.APP_BASE_URL);
      redirectUrl.searchParams.set("token", token);
      return res.redirect(redirectUrl.toString());
    }

    return res.json({ token });
  } catch (error) {
    return next(error);
  }
}

