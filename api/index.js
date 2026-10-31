const requestDispatcher = require('../server.js');

module.exports = async (req, res) => {
  if (req.url && req.url.includes('debug')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      url: req.url,
      headers: req.headers,
      query: req.query
    }));
    return;
  }

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
