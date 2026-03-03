"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export async function createTeam(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const code = (formData.get("code") as string)?.trim().toUpperCase();
  const groupLetter = (formData.get("group_letter") as string)?.trim().toUpperCase() || null;
  if (!name || !code) {
    redirect("/admin/teams?error=required");
  }
  try {
    await prisma.team.create({
      data: { name, code, groupLetter: groupLetter || undefined },
    });
    revalidatePath("/admin/teams");
    redirect("/admin/teams");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      redirect("/admin/teams?error=code_exists");
    }
    redirect("/admin/teams?error=create");
  }
}

export async function updateTeam(formData: FormData) {
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const code = (formData.get("code") as string)?.trim().toUpperCase();
  const groupLetter = (formData.get("group_letter") as string)?.trim().toUpperCase() || null;
  if (!id || !name || !code) {
    redirect(`/admin/teams?edit=${id}&error=required`);
  }
  try {
    await prisma.team.update({
      where: { id },
      data: { name, code, groupLetter: groupLetter || undefined },
    });
    revalidatePath("/admin/teams");
    redirect("/admin/teams");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      redirect(`/admin/teams?edit=${id}&error=code_exists`);
    }
    redirect(`/admin/teams?edit=${id}&error=update`);
  }
}

export async function deleteTeam(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) redirect("/admin/teams?error=delete");
  try {
    await prisma.team.delete({ where: { id } });
    revalidatePath("/admin/teams");
    redirect("/admin/teams");
  } catch {
    redirect("/admin/teams?error=delete");
  }
}
