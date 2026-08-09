const express = require("express");
const prisma = require("../db/client");

const router = express.Router();

// Get all active intents
router.get("/", async (req, res) => {
  try {
    const intents = await prisma.intent.findMany({
      where: { status: { not: "archived" } },
      orderBy: { createdAt: "desc" },
    });
    res.json(intents);
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
            locations: true,
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

module.exports = router;
