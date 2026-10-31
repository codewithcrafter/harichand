/**
 * Vercel Serverless Function entry point for HARICHAND STEEL API
 * Routes all /api/* requests to the centralized requestDispatcher
 */
const requestDispatcher = require('../server.js');

module.exports = async (req, res) => {
  // Normalize rewritten URL from Vercel
  if (req.headers['x-matched-path']) {
    req.url = req.headers['x-matched-path'];
  } else {
    try {
      const urlObj = new URL(req.url, 'http://localhost');
      const pathParam = urlObj.searchParams.get('path');
      if (pathParam) {
        urlObj.searchParams.delete('path');
        const search = urlObj.searchParams.toString();
        req.url = `/api/${pathParam}` + (search ? `?${search}` : '');
      }
    } catch (_) {}
  }
  return requestDispatcher(req, res);
};
