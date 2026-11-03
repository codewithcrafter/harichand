const http = require('http');

http.get('http://localhost:8080/product/aluminium-sliding-main-entrance-gate/', res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const match = body.match(/<script type="application\/ld\+json" id="schemaProduct">([\s\S]*?)<\/script>/);
    console.log('Script match:', match ? JSON.stringify(match[1]) : 'NOT FOUND');
  });
});
