// Simple Next.js server
console.log('Starting simple Next.js server...');
console.log('NODE_ENV:', process.env.NODE_ENV);

try {
  const next = require('next');
  const app = next({ dev: false, quiet: false });
  const handle = app.getRequestHandler();

  app.prepare().then(() => {
    console.log('Next.js prepared successfully');
    
    require('http').createServer((req, res) => {
      handle(req, res);
    }).listen(3000, '0.0.0.0', () => {
      console.log('Simple Next.js server running on port 3000');
    });
  }).catch(err => {
    console.error('Next.js prepare failed:', err);
    // Fallback to simple server
    require('http').createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Simple Server - Next.js Failed</h1><p>Error: ' + err.message + '</p>');
    }).listen(3000, () => {
      console.log('Fallback server running');
    });
  });
} catch (err) {
  console.error('Failed to load Next.js:', err);
  // Ultimate fallback
  require('http').createServer((req, res) => {
    res.end('Next.js not available: ' + err.message);
  }).listen(3000, () => {
    console.log('Basic fallback server running');
  });
}
