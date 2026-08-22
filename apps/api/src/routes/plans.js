const express = require("express");
const prisma = require("../db/client");
const {
  rebuildPlanStops,
  PLAN_STOP_INCLUDE,
} = require("../services/planPersistence");
const { buildPlanVariations } = require("../services/planVariations");

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

const VALID_STOP_STATUSES = new Set([
  "planned",
  "in_progress",
  "done",
  "skipped",
]);
const VALID_PLAN_STOP_WORK_STATUSES = new Set(["planned", "done", "skipped"]);

router.patch("/:id/stops/:stopId", async (req, res) => {
  try {
    const { id, stopId } = req.params;
    const { status, actualArrivalAt, actualDepartureAt } = req.body;

    if (status !== undefined && !VALID_STOP_STATUSES.has(status)) {
      return res.status(400).json({ error: "Invalid stop status" });
    }

    const stop = await prisma.planStop.findFirst({
      where: { id: stopId, planId: id },
    });
    if (!stop) {
      return res.status(404).json({ error: "Plan stop not found" });
    }

    const updatedStop = await prisma.planStop.update({
      where: { id: stopId },
      data: {
        status,
        actualArrivalAt:
          actualArrivalAt !== undefined ? new Date(actualArrivalAt) : undefined,
        actualDepartureAt:
          actualDepartureAt !== undefined
            ? new Date(actualDepartureAt)
            : undefined,
      },
      include: PLAN_STOP_INCLUDE,
    });

    res.json(updatedStop);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update plan stop" });
  }
});

// Marking a work item done syncs Work.status to "done" — but only once
// every PlanStopWork row for that same work item, in this same plan, is no
// longer "planned". A work item legitimately spanning two stops (its
// chosen option lists two locations) must not be marked done after just
// the first stop.
router.patch("/:id/stops/:stopId/work/:workId", async (req, res) => {
  try {
    const { id, stopId, workId } = req.params;
    const { status } = req.body;

    if (!VALID_PLAN_STOP_WORK_STATUSES.has(status)) {
      return res.status(400).json({ error: "Invalid work status" });
    }

    const planStopWork = await prisma.planStopWork.findFirst({
      where: { workId, planStop: { id: stopId, planId: id } },
    });
    if (!planStopWork) {
      return res.status(404).json({ error: "Plan stop work item not found" });
    }

    const updated = await prisma.planStopWork.update({
      where: { id: planStopWork.id },
      data: { status },
      include: { work: true },
    });

    if (status === "done") {
      const otherOpenAssignments = await prisma.planStopWork.count({
        where: {
          workId,
          planStop: { planId: id },
          status: "planned",
          id: { not: planStopWork.id },
        },
      });
      if (otherOpenAssignments === 0) {
        await prisma.work.update({
          where: { id: workId },
          data: { status: "done" },
        });
      }
    }

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update plan stop work item" });
  }
});

router.post("/:id/recheck", async (req, res) => {
  try {
    const { id } = req.params;
    const { asOfAt, latitude, longitude, label } = req.body;

    const existingPlan = await prisma.plan.findUnique({ where: { id } });
    if (!existingPlan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const asOf = asOfAt ? new Date(asOfAt) : new Date();
    const result = await rebuildPlanStops(prisma, id, {
      asOfAt: asOf,
      asOfLocation: { latitude, longitude, label },
    });

    let variations = [];
    if (result.unselectedWork.length > 0) {
      // Deduped by id: a work item whose chosen option lists two locations
      // has an assignment at each stop, and listing it twice in the prompt
      // just invites the model to reason about it as two separate errands.
      const selectedWork = [
        ...new Map(
          result.plan.stops
            .flatMap((stop) => stop.works.map((assignment) => assignment.work))
            .map((work) => [work.id, work])
        ).values(),
      ];
      const budgetMinutes = Math.max(
        0,
        Math.round(
          (new Date(result.plan.endAt).getTime() - asOf.getTime()) / 60000
        )
      );

      try {
        variations = await buildPlanVariations({
          selectedWork,
          unselectedWork: result.unselectedWork,
          budgetMinutes,
        });
      } catch (error) {
        console.error("Failed to fetch plan variations during recheck", error);
      }
    }

    res.json({ plan: result.plan, variations });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to recheck plan" });
  }
});

module.exports = router;
