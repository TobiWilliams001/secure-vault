import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, vaultsTable } from "@workspace/db";
import { RegisterUserBody, LoginUserBody } from "@workspace/api-zod";
import { signToken } from "../lib/jwt";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, authKey, pbkdf2Salt } = parsed.data;
  const normalEmail = email.toLowerCase();

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, normalEmail));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const authKeyHash = await bcrypt.hash(authKey, 12);
  const [user] = await db
    .insert(usersTable)
    .values({ email: normalEmail, authKeyHash, pbkdf2Salt })
    .returning();

  await db.insert(vaultsTable).values({ userId: user.id, encryptedData: null });

  const token = signToken({ userId: user.id, email: user.email });
  req.log.info({ userId: user.id }, "User registered");
  res.status(201).json({ userId: user.id, token });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, authKey } = parsed.data;
  const normalEmail = email.toLowerCase();

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalEmail));

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(authKey, user.authKeyHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email });
  req.log.info({ userId: user.id }, "User logged in");
  res.json({ userId: user.id, token, pbkdf2Salt: user.pbkdf2Salt });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  res.json({ userId: req.user!.userId, email: req.user!.email });
});

router.post("/auth/logout", requireAuth, async (_req, res): Promise<void> => {
  res.sendStatus(204);
});

router.delete("/auth/account", requireAuth, async (req, res): Promise<void> => {
  await db.delete(usersTable).where(eq(usersTable.id, req.user!.userId));
  req.log.info({ userId: req.user!.userId }, "Account deleted");
  res.sendStatus(204);
});

export default router;
