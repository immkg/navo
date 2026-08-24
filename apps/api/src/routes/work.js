const express = require("express");
const prisma = require("../db/client");
const { deleteWorkItems } = require("../services/workService");
const { isRecordNotFoundError } = require("../utils/prismaErrors");
const { isBlockedByDependency, scoreWork } = require("../services/planBuilder");

const router = express.Router();
const VALID_STATUSES = new Set(["todo", "in_progress", "done"]);
const VALID_PRIORITIES = new Set(["low", "medium", "high"]);
const VALID_ENERGY_LEVELS = new Set(["low", "medium", "high"]);
const DEFAULT_RECOMMENDED_LIMIT = 10;

// Get all work items
router.get("/", async (req, res) => {
  try {
    const workItems = await prisma.work.findMany({
      include: {
        intent: true,
        contexts: true,
        locationOptions: {
          include: { locations: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(workItems);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch work items" });
  }
});

// Not-done work ranked by the same priority/urgency score the plan builder
// uses, highest first — powers "what should I do next" surfaces (the
// Dashboard's recommended-work panel and next-best-action callout) without
// requiring a Plan to exist. Registered before GET /:id so "recommended"
// isn't swallowed as an id.
router.get("/recommended", async (req, res) => {
  try {
    const limit = Math.max(
      1,
      Math.min(50, Number(req.query.limit) || DEFAULT_RECOMMENDED_LIMIT)
    );
    const now = new Date();

    const workItems = await prisma.work.findMany({
      where: { status: { not: "done" } },
      include: {
        intent: true,
        dependsOn: { include: { dependsOn: true } },
      },
    });

    const ranked = workItems
      .filter((work) => !isBlockedByDependency(work))
      .sort((a, b) => scoreWork(b, b.intent, now) - scoreWork(a, a.intent, now))
      .slice(0, limit);

    res.json(ranked);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch recommended work" });
  }
});

// Get a single work item
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const workItem = await prisma.work.findUnique({
      where: { id },
      include: {
        intent: true,
        contexts: true,
        locationOptions: {
          include: { locations: true },
        },
      },
    });

    if (!workItem) {
      return res.status(404).json({ error: "Work item not found" });
    }

    res.json(workItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch work item" });
  }
});

// Create a new piece of work
router.post("/", async (req, res) => {
  try {
    const {
      title,
      type,
      intentId,
      durationMinutes,
      notes,
      locationOptions,
      priority,
      energyLevel,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (priority !== undefined && !VALID_PRIORITIES.has(priority)) {
      return res
        .status(400)
        .json({ error: "Priority must be low, medium, or high" });
    }

    if (energyLevel !== undefined && !VALID_ENERGY_LEVELS.has(energyLevel)) {
      return res
        .status(400)
        .json({ error: "energyLevel must be low, medium, or high" });
    }

    const createLocationOption = (option) => {
      const locationData = {
        create: option.locations
          .filter((loc) => !loc.id && !loc.placeId)
          .map((loc) => ({
            name: loc.name,
            address: loc.address,
            latitude: loc.latitude,
            longitude: loc.longitude,
            placeId: loc.placeId,
            provider: loc.provider,
            phoneNumber: loc.phoneNumber,
            rating: loc.rating,
            ratingsCount: loc.ratingsCount,
            openingHoursText: loc.openingHoursText,
            openingPeriods: loc.openingPeriods,
          })),
      };

      const connect = option.locations
        .filter((loc) => loc.id)
        .map((loc) => ({ id: loc.id }));

      const connectOrCreate = option.locations
        .filter((loc) => !loc.id && loc.placeId)
        .map((loc) => ({
          where: { placeId: loc.placeId },
          create: {
            name: loc.name,
            address: loc.address,
            latitude: loc.latitude,
            longitude: loc.longitude,
            placeId: loc.placeId,
            provider: loc.provider,
            phoneNumber: loc.phoneNumber,
            rating: loc.rating,
            ratingsCount: loc.ratingsCount,
            openingHoursText: loc.openingHoursText,
            openingPeriods: loc.openingPeriods,
          },
        }));

      return {
        title: option.title,
        locations: {
          ...(!connect.length ? {} : { connect }),
          ...(!connectOrCreate.length ? {} : { connectOrCreate }),
          ...(!locationData.create.length
            ? {}
            : { create: locationData.create }),
        },
      };
    };

    const data = {
      title,
      type: type || "task",
      priority: priority || "medium",
      energyLevel: energyLevel || "medium",
      durationMinutes:
        typeof durationMinutes === "number" ? durationMinutes : 30,
      notes,
      intentId: intentId || null,
      locationOptions:
        locationOptions &&
        Array.isArray(locationOptions) &&
        locationOptions.length > 0
          ? {
              create: locationOptions.map(createLocationOption),
            }
          : undefined,
    };

    const newWork = await prisma.work.create({
      data,
      include: {
        locationOptions: {
          include: { locations: true },
        },
      },
    });

    res.status(201).json(newWork);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create work item" });
  }
});

// Update a work item
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      type,
      status,
      priority,
      energyLevel,
      durationMinutes,
      notes,
      selectedLocationOptionId,
    } = req.body;

    if (status !== undefined && !VALID_STATUSES.has(status)) {
      return res
        .status(400)
        .json({ error: "Status must be todo, in_progress, or done" });
    }

    if (priority !== undefined && !VALID_PRIORITIES.has(priority)) {
      return res
        .status(400)
        .json({ error: "Priority must be low, medium, or high" });
    }

    if (energyLevel !== undefined && !VALID_ENERGY_LEVELS.has(energyLevel)) {
      return res
        .status(400)
        .json({ error: "energyLevel must be low, medium, or high" });
    }

    const existingWork = await prisma.work.findUnique({ where: { id } });
    if (!existingWork) {
      return res.status(404).json({ error: "Work item not found" });
    }

    const updatedWork = await prisma.work.update({
      where: { id },
      data: {
        title,
        type,
        status,
        priority,
        energyLevel,
        durationMinutes,
        notes,
        selectedLocationOptionId,
      },
      include: {
        locationOptions: {
          include: { locations: true },
        },
      },
    });

    res.json(updatedWork);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update work item" });
  }
});

// Link work to an intent
router.post("/:id/link", async (req, res) => {
  try {
    const { id } = req.params;
    const { intentId } = req.body;

    if (!intentId) {
      return res.status(400).json({ error: "intentId is required" });
    }

    const updatedWork = await prisma.work.update({
      where: { id },
      data: { intentId },
    });

    res.json(updatedWork);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return res.status(404).json({ error: "Work item not found" });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to link work item" });
  }
});

// Add a dependency to this work item (this work depends on dependsOnId)
router.post("/:id/dependency", async (req, res) => {
  try {
    const { id } = req.params;
    const { dependsOnId } = req.body;

    if (!dependsOnId) {
      return res.status(400).json({ error: "dependsOnId is required" });
    }

    const dependency = await prisma.workDependency.create({
      data: {
        workId: id,
        dependsOnId,
      },
    });

    res.status(201).json(dependency);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return res
        .status(404)
        .json({ error: "Work item or dependency target not found" });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to add dependency" });
  }
});

// Add a context to this work item
router.post("/:id/context", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: "name and type are required" });
    }

    const updatedWork = await prisma.work.update({
      where: { id },
      data: {
        contexts: {
          create: {
            name,
            type,
          },
        },
      },
      include: { contexts: true },
    });

    res.json(updatedWork);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return res.status(404).json({ error: "Work item not found" });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to add context" });
  }
});

// Create a new location option for this work item
router.post("/:id/location-option", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, locations } = req.body;

    if (!locations || !Array.isArray(locations) || locations.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one location is required" });
    }

    const createdOption = await prisma.locationOption.create({
      data: {
        title,
        work: { connect: { id } },
        locations: {
          connectOrCreate: locations.map((loc) => ({
            where: loc.id ? { id: loc.id } : { placeId: loc.placeId || "" },
            create: {
              name: loc.name,
              address: loc.address,
              latitude: loc.latitude,
              longitude: loc.longitude,
              placeId: loc.placeId,
              provider: loc.provider,
              phoneNumber: loc.phoneNumber,
              rating: loc.rating,
              ratingsCount: loc.ratingsCount,
              openingHoursText: loc.openingHoursText,
              openingPeriods: loc.openingPeriods,
            },
          })),
        },
      },
      include: { locations: true },
    });

    res.status(201).json(createdOption);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return res.status(404).json({ error: "Work item not found" });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to create location option" });
  }
});

// Add or attach a location to an existing location option
router.post("/:id/location-option/:optionId/location", async (req, res) => {
  try {
    const { optionId } = req.params;
    const {
      locationId,
      name,
      address,
      latitude,
      longitude,
      placeId,
      provider,
      phoneNumber,
      rating,
      ratingsCount,
      openingHoursText,
      openingPeriods,
    } = req.body;

    if (!locationId && !name) {
      return res.status(400).json({ error: "locationId or name is required" });
    }

    const locationConnectOrCreate = locationId
      ? { connect: { id: locationId } }
      : {
          connectOrCreate: {
            where: { placeId: placeId || "" },
            create: {
              name,
              address,
              latitude: latitude === undefined ? undefined : Number(latitude),
              longitude:
                longitude === undefined ? undefined : Number(longitude),
              placeId,
              provider,
              phoneNumber,
              rating: rating === undefined ? undefined : Number(rating),
              ratingsCount:
                ratingsCount === undefined ? undefined : Number(ratingsCount),
              openingHoursText,
              openingPeriods,
            },
          },
        };

    const updatedOption = await prisma.locationOption.update({
      where: { id: optionId },
      data: {
        locations: locationConnectOrCreate,
      },
      include: { locations: true },
    });

    res.json(updatedOption);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return res.status(404).json({ error: "Location option not found" });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to attach location to option" });
  }
});

// Remove a location from an existing location option
router.delete(
  "/:id/location-option/:optionId/location/:locationId",
  async (req, res) => {
    try {
      const { id, optionId, locationId } = req.params;

      const option = await prisma.locationOption.findFirst({
        where: {
          id: optionId,
          workId: id,
          locations: {
            some: { id: locationId },
          },
        },
        select: { id: true },
      });

      if (!option) {
        return res
          .status(404)
          .json({ error: "Location option or location not found" });
      }

      const updatedOption = await prisma.locationOption.update({
        where: { id: optionId },
        data: {
          locations: {
            disconnect: { id: locationId },
          },
        },
        include: { locations: true },
      });

      res.json(updatedOption);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to remove location from option" });
    }
  }
);

// Remove an existing location option from a work item
router.delete("/:id/location-option/:optionId", async (req, res) => {
  try {
    const { id, optionId } = req.params;

    const option = await prisma.locationOption.findFirst({
      where: { id: optionId, workId: id },
      select: { id: true },
    });

    if (!option) {
      return res.status(404).json({ error: "Location option not found" });
    }

    await prisma.locationOption.delete({ where: { id: optionId } });

    const work = await prisma.work.findUnique({
      where: { id },
      include: {
        locationOptions: {
          orderBy: { createdAt: "asc" },
          select: { id: true },
        },
      },
    });

    let selectedLocationOptionId = work?.selectedLocationOptionId || null;
    if (selectedLocationOptionId === optionId) {
      selectedLocationOptionId = work?.locationOptions?.[0]?.id || null;
      await prisma.work.update({
        where: { id },
        data: { selectedLocationOptionId },
      });
    }

    res.json({
      deletedOptionId: optionId,
      selectedLocationOptionId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to remove location option" });
  }
});

// Delete a work item
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const existingWork = await prisma.work.findUnique({ where: { id } });
    if (!existingWork) {
      return res.status(404).json({ error: "Work item not found" });
    }

    await deleteWorkItems(prisma, [id]);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete work item" });
  }
});

module.exports = router;
