const express = require("express");
const prisma = require("../db/client");
const { isRecordNotFoundError } = require("../utils/prismaErrors");

const router = express.Router();
const VALID_ENERGY_LEVELS = new Set(["low", "medium", "high"]);

router.get("/", async (req, res) => {
  try {
    const templates = await prisma.planTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(templates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch plan templates" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, durationMinutes, energyLevel, useAccurateTravelTime } =
      req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return res
        .status(400)
        .json({ error: "durationMinutes must be a positive number" });
    }
    if (energyLevel !== undefined && !VALID_ENERGY_LEVELS.has(energyLevel)) {
      return res.status(400).json({ error: "Invalid energyLevel" });
    }

    const template = await prisma.planTemplate.create({
      data: {
        name: name.trim(),
        durationMinutes,
        energyLevel: energyLevel || undefined,
        useAccurateTravelTime: useAccurateTravelTime ?? undefined,
      },
    });
    res.status(201).json(template);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create plan template" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.planTemplate.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return res.status(404).json({ error: "Plan template not found" });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to delete plan template" });
  }
});

module.exports = router;
