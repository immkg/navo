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

const VALID_PLAN_STATUSES = new Set([
  "draft",
  "active",
  "completed",
  "abandoned",
]);

// Update a plan's fields. Changing the time window or activating it
// triggers a rebuild of every not-yet-resolved stop; so does passing
// forceIncludeWorkIds/forceExcludeWorkIds (used when applying an
// AI-suggested variation, or a manual add/exclude from the UI).
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
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
      status,
      forceIncludeWorkIds,
      forceExcludeWorkIds,
    } = req.body;

    if (status !== undefined && !VALID_PLAN_STATUSES.has(status)) {
      return res.status(400).json({ error: "Invalid plan status" });
    }

    const existingPlan = await prisma.plan.findUnique({ where: { id } });
    if (!existingPlan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const timingChanged = startAt !== undefined || endAt !== undefined;
    const activating = status === "active" && existingPlan.status !== "active";
    const shouldRebuild =
      timingChanged || activating || forceIncludeWorkIds || forceExcludeWorkIds;

    await prisma.plan.update({
      where: { id },
      data: {
        title,
        startAt: startAt !== undefined ? new Date(startAt) : undefined,
        startLabel,
        startLatitude,
        startLongitude,
        endAt: endAt !== undefined ? new Date(endAt) : undefined,
        endLabel,
        endLatitude,
        endLongitude,
        useAccurateTravelTime,
        status,
      },
    });

    if (!shouldRebuild) {
      const plan = await prisma.plan.findUnique({
        where: { id },
        include: {
          stops: { orderBy: { order: "asc" }, include: PLAN_STOP_INCLUDE },
        },
      });
      return res.json(plan);
    }

    const refreshedPlan = await prisma.plan.findUnique({ where: { id } });
    const { plan: rebuiltPlan } = await rebuildPlanStops(prisma, id, {
      asOfAt: refreshedPlan.startAt,
      asOfLocation: {
        latitude: refreshedPlan.startLatitude,
        longitude: refreshedPlan.startLongitude,
      },
      forceIncludeWorkIds: forceIncludeWorkIds || [],
      forceExcludeWorkIds: forceExcludeWorkIds || [],
    });

    res.json(rebuiltPlan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update plan" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const existingPlan = await prisma.plan.findUnique({
      where: { id: req.params.id },
    });
    if (!existingPlan) {
      return res.status(404).json({ error: "Plan not found" });
    }
    await prisma.plan.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete plan" });
  }
});

module.exports = router;
