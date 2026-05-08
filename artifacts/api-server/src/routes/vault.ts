import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, vaultsTable } from "@workspace/db";
import { SyncVaultBody } from "@workspace/api-zod";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

router.get("/vault", requireAuth, async (req, res): Promise<void> => {
  const [vault] = await db
    .select()
    .from(vaultsTable)
    .where(eq(vaultsTable.userId, req.user!.userId));

  if (!vault) {
    res.json({ encryptedData: null, updatedAt: null });
    return;
  }

  res.json({
    encryptedData: vault.encryptedData ?? null,
    updatedAt: vault.updatedAt?.toISOString() ?? null,
  });
});

router.put("/vault", requireAuth, async (req, res): Promise<void> => {
  const parsed = SyncVaultBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { encryptedData } = parsed.data;

  const [result] = await db
    .insert(vaultsTable)
    .values({ userId: req.user!.userId, encryptedData })
    .onConflictDoUpdate({
      target: vaultsTable.userId,
      set: { encryptedData },
    })
    .returning();

  res.json({ updatedAt: result.updatedAt.toISOString() });
});

export default router;
