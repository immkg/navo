const express = require('express');
const prisma = require('../db/client');

const router = express.Router();

// Get all work items
router.get('/', async (req, res) => {
  try {
    const workItems = await prisma.work.findMany({
      include: {
        contexts: true,
        intent: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(workItems);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch work items' });
  }
});

// Create a new piece of work
router.post('/', async (req, res) => {
  try {
    const { title, type, intentId } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const newWork = await prisma.work.create({
      data: {
        title,
        type: type || 'task',
        intentId: intentId || null
      }
    });
    
    res.status(201).json(newWork);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create work item' });
  }
});

// Link work to an intent
router.post('/:id/link', async (req, res) => {
  try {
    const { id } = req.params;
    const { intentId } = req.body;
    
    if (!intentId) {
      return res.status(400).json({ error: 'intentId is required' });
    }
    
    const updatedWork = await prisma.work.update({
      where: { id },
      data: { intentId }
    });
    
    res.json(updatedWork);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to link work item' });
  }
});

// Add a dependency to this work item (this work depends on dependsOnId)
router.post('/:id/dependency', async (req, res) => {
  try {
    const { id } = req.params;
    const { dependsOnId } = req.body;
    
    if (!dependsOnId) {
      return res.status(400).json({ error: 'dependsOnId is required' });
    }
    
    const dependency = await prisma.workDependency.create({
      data: {
        workId: id,
        dependsOnId
      }
    });
    
    res.status(201).json(dependency);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add dependency' });
  }
});

// Add a context to this work item
router.post('/:id/context', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: 'name and type are required' });
    }
    
    const updatedWork = await prisma.work.update({
      where: { id },
      data: {
        contexts: {
          create: {
            name,
            type
          }
        }
      },
      include: { contexts: true }
    });
    
    res.json(updatedWork);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add context' });
  }
});

module.exports = router;
