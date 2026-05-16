import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function getPrismaUser() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.email) return null;

  const existing = await prisma.user.findUnique({ where: { email: authUser.email } });
  if (existing) return existing;

  try {
    return await prisma.user.create({ data: { email: authUser.email } });
  } catch {
    // Race condition: another concurrent request already created the row
    return prisma.user.findUnique({ where: { email: authUser.email } });
  }
}
