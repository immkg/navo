const express = require("express");
const prisma = require("../db/client");

const router = express.Router();

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
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const newIntent = await prisma.intent.create({
      data: {
        title,
        description,
        status: "active",
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
    const { title, description, status } = req.body;

    const updatedIntent = await prisma.intent.update({
      where: { id },
      data: {
        title,
        description,
        status,
      },
    });

    res.json(updatedIntent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update intent" });
  }
});

module.exports = router;
