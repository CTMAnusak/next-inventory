// Simple Next.js server test
const http = require('http');

console.log('Starting simple server...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <h1>Simple Server Working!</h1>
    <p>Node.js Version: ${process.version}</p>
    <p>Environment: ${process.env.NODE_ENV}</p>
    <p>MongoDB URI: ${process.env.MONGODB_URI ? 'Connected' : 'Not Found'}</p>
    <p>Working Directory: ${process.cwd()}</p>
  `);
});

const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => {
  console.log(`Simple server running on port ${port}`);
});
