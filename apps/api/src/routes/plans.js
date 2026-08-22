const express = require("express");
const prisma = require("../db/client");
const {
  rebuildPlanStops,
  PLAN_STOP_INCLUDE,
} = require("../services/planPersistence");

const router = express.Router();

// Create a new plan and immediately build its stops.
router.post("/", async (req, res) => {
  try {
    const {
      title,
      startAt,
      startLabel,
      startLatitude,
      startLongitude,
      endAt,
      endLabel,
      endLatitude,
      endLongitude,
      useAccurateTravelTime,
    } = req.body;

    if (!startAt || !endAt) {
      return res.status(400).json({ error: "startAt and endAt are required" });
    }
    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      return res.status(400).json({ error: "endAt must be after startAt" });
    }

    const plan = await prisma.plan.create({
      data: {
        title,
        startAt: new Date(startAt),
        startLabel,
        startLatitude,
        startLongitude,
        endAt: new Date(endAt),
        endLabel,
        endLatitude,
        endLongitude,
        useAccurateTravelTime: Boolean(useAccurateTravelTime),
      },
    });

    const { plan: builtPlan } = await rebuildPlanStops(prisma, plan.id, {
      asOfAt: plan.startAt,
      asOfLocation: {
        latitude: plan.startLatitude,
        longitude: plan.startLongitude,
      },
    });

    res.status(201).json(builtPlan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create plan" });
  }
});

// List every plan.
router.get("/", async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        stops: { orderBy: { order: "asc" }, include: PLAN_STOP_INCLUDE },
      },
    });
    res.json(plans);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

// Get one plan's full detail.
router.get("/:id", async (req, res) => {
  try {
    const plan = await prisma.plan.findUnique({
      where: { id: req.params.id },
      include: {
        stops: { orderBy: { order: "asc" }, include: PLAN_STOP_INCLUDE },
      },
    });
    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }
    res.json(plan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch plan" });
  }
});

module.exports = router;
