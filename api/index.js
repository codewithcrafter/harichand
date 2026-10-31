/**
 * Vercel Serverless Function entry point for HARICHAND STEEL API
 * Routes all /api/* requests to the centralized requestDispatcher
 */
const requestDispatcher = require('../server.js');

module.exports = async (req, res) => {
  return requestDispatcher(req, res);
};
