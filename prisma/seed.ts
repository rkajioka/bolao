import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.scoringConfig.findFirst();
  if (existing) {
    await prisma.scoringConfig.update({
      where: { id: existing.id },
      data: { exact: 3, outcome: 1 },
    });
  } else {
    await prisma.scoringConfig.create({
      data: { exact: 3, outcome: 1 },
    });
  }
}

main()
  .then(() => {
    console.log("Seed: scoring_config default (exact=3, outcome=1)");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
