const express = require("express");
const prisma = require("../db/client");

const router = express.Router();
const VALID_STATUSES = new Set([
  "active",
  "completed",
  "not_required",
  "archived",
]);
const VALID_PRIORITIES = new Set(["low", "medium", "high"]);

function parseOptionalDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Get all active intents
router.get("/", async (req, res) => {
  try {
    const intents = await prisma.intent.findMany({
      where: { status: { not: "archived" } },
      orderBy: { createdAt: "desc" },
      include: {
        workItems: {
          select: {
            status: true,
            locationOptions: {
              select: {
                locations: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    const summaryIntents = intents.map((intent) => {
      const workCount = intent.workItems.length;
      const completedWorkCount = intent.workItems.filter(
        (work) => work.status === "done"
      ).length;
      const placeIds = new Set();
      intent.workItems.forEach((work) => {
        work.locationOptions.forEach((option) => {
          option.locations.forEach((location) => placeIds.add(location.id));
        });
      });

      return {
        id: intent.id,
        title: intent.title,
        description: intent.description,
        status: intent.status,
        priority: intent.priority,
        startDate: intent.startDate,
        dueDate: intent.dueDate,
        createdAt: intent.createdAt,
        updatedAt: intent.updatedAt,
        workCount,
        completedWorkCount,
        placeCount: placeIds.size,
      };
    });

    res.json(summaryIntents);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch intents" });
  }
});

// Get a specific intent and its work graph
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const intent = await prisma.intent.findUnique({
      where: { id },
      include: {
        workItems: {
          include: {
            contexts: true,
            dependsOn: true,
            dependedBy: true,
            locationOptions: {
              include: {
                locations: true,
              },
            },
          },
        },
      },
    });

    if (!intent) {
      return res.status(404).json({ error: "Intent not found" });
    }

    res.json(intent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch intent" });
  }
});

// Create a new intent
router.post("/", async (req, res) => {
  try {
    const { title, description, priority, startDate, dueDate } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const normalizedPriority = priority ?? "medium";
    if (!VALID_PRIORITIES.has(normalizedPriority)) {
      return res
        .status(400)
        .json({ error: "Priority must be low, medium, or high" });
    }

    const parsedStartDate = parseOptionalDate(startDate);
    const parsedDueDate = parseOptionalDate(dueDate);
    if (startDate && !parsedStartDate) {
      return res.status(400).json({ error: "Invalid start date" });
    }
    if (dueDate && !parsedDueDate) {
      return res.status(400).json({ error: "Invalid due date" });
    }
    if (parsedStartDate && parsedDueDate && parsedStartDate > parsedDueDate) {
      return res
        .status(400)
        .json({ error: "Start date cannot be after due date" });
    }

    const newIntent = await prisma.intent.create({
      data: {
        title,
        description,
        status: "active",
        priority: normalizedPriority,
        startDate: parsedStartDate,
        dueDate: parsedDueDate,
      },
    });

    res.status(201).json(newIntent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create intent" });
  }
});

// Update an intent
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, startDate, dueDate } =
      req.body;

    if (status !== undefined && !VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    if (priority !== undefined && !VALID_PRIORITIES.has(priority)) {
      return res
        .status(400)
        .json({ error: "Priority must be low, medium, or high" });
    }

    const parsedStartDate =
      startDate === undefined ? undefined : parseOptionalDate(startDate);
    const parsedDueDate =
      dueDate === undefined ? undefined : parseOptionalDate(dueDate);
    if (startDate && !parsedStartDate) {
      return res.status(400).json({ error: "Invalid start date" });
    }
    if (dueDate && !parsedDueDate) {
      return res.status(400).json({ error: "Invalid due date" });
    }

    const existingIntent = await prisma.intent.findUnique({ where: { id } });
    if (!existingIntent) {
      return res.status(404).json({ error: "Intent not found" });
    }

    const nextStartDate =
      parsedStartDate === undefined
        ? existingIntent.startDate
        : parsedStartDate;
    const nextDueDate =
      parsedDueDate === undefined ? existingIntent.dueDate : parsedDueDate;
    if (nextStartDate && nextDueDate && nextStartDate > nextDueDate) {
      return res
        .status(400)
        .json({ error: "Start date cannot be after due date" });
    }

    const updatedIntent = await prisma.intent.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(parsedStartDate !== undefined
          ? { startDate: parsedStartDate }
          : {}),
        ...(parsedDueDate !== undefined ? { dueDate: parsedDueDate } : {}),
      },
    });

    res.json(updatedIntent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update intent" });
  }
});

module.exports = router;
