const express = require('express');
const path = require('path');
const config = require('./config');
const apiRoutes = require('./api/routes');

function createServer(bot, courseData) {
  const app = express();

  app.use(express.json());

  // Auth middleware for /api
  app.use('/api', (req, res, next) => {
    if (!config.ADMIN_TOKEN) {
      return res.status(500).json({ error: 'ADMIN_TOKEN not configured' });
    }
    const token = req.headers['authorization']?.replace('Bearer ', '')
                  || req.query.token;
    if (!token || token !== config.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });

  // API routes
  app.use('/api', apiRoutes(bot, courseData));

  // Serve static admin frontend
  app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

  // SPA fallback
  app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'admin', 'index.html'));
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('Express error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createServer };
