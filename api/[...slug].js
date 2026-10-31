/**
 * Vercel Serverless Function Catch-All for /api/*
 */
const requestDispatcher = require('../server.js');

module.exports = async (req, res) => {
  return requestDispatcher(req, res);
};

