/**
 * Vercel Serverless Function entry point for HARICHAND STEEL API
 * Handles /api and /api/
 */
const requestDispatcher = require('../server.js');

module.exports = async (req, res) => {
  return requestDispatcher(req, res);
};
