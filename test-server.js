// Simple test server - Updated timestamp
console.log('Starting test server...');
console.log('Node.js version:', process.version);
console.log('Working directory:', process.cwd());

const http = require('http');

const server = http.createServer((req, res) => {
  console.log('Request received:', req.url);
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <h1>Node.js Test Server Working!</h1>
    <p>Node.js Version: ${process.version}</p>
    <p>Current Time: ${new Date()}</p>
    <p>Working Directory: ${process.cwd()}</p>
    <p>Environment: ${process.env.NODE_ENV || 'development'}</p>
  `);
});

const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => {
  console.log(`Test server running on port ${port}`);
  console.log(`Visit: http://localhost:${port}`);
});
