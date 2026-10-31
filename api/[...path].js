/**
 * Vercel Serverless Function Catch-All for /api/*
 */
const requestDispatcher = require('../server.js');

module.exports = async (req, res) => {
  try {
    const urlObj = new URL(req.url, 'http://localhost');
    const pathParam = urlObj.searchParams.get('path') || (req.query && req.query.path);
    if (pathParam) {
      const subpath = Array.isArray(pathParam) ? pathParam.join('/') : pathParam;
      urlObj.searchParams.delete('path');
      const search = urlObj.searchParams.toString();
      req.url = `/api/${subpath}` + (search ? `?${search}` : '');
    }
  } catch (_) {}

  return requestDispatcher(req, res);
};
