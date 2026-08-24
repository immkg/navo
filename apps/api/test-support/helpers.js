const prisma = require("../src/db/client");

async function cleanDatabase() {
  await prisma.planStopWork.deleteMany();
  await prisma.planStop.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.workDependency.deleteMany();
  await prisma.locationOption.deleteMany();
  await prisma.location.deleteMany();
  await prisma.context.deleteMany();
  await prisma.work.deleteMany();
  await prisma.intent.deleteMany();
  await prisma.planTemplate.deleteMany();
}

module.exports = { cleanDatabase };
