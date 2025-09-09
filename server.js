// Production server for Plesk
console.log('Starting inventory management server...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('MongoDB URI exists:', !!process.env.MONGODB_URI);

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // Listen on all interfaces
const port = process.env.PORT || 3000;

console.log('Creating Next.js app with dev:', dev);
const app = next({ 
  dev,
  hostname,
  port 
});
const handle = app.getRequestHandler();

console.log('Preparing Next.js app...');
app.prepare().then(() => {
  console.log('Next.js app prepared, starting HTTP server...');
  
  const server = createServer(async (req, res) => {
    try {
      // Add CORS headers for production
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  server.listen(port, hostname, () => {
    console.log(`✅ Server ready on http://${hostname}:${port}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV}`);
    console.log(`✅ MongoDB: ${process.env.MONGODB_URI ? 'Connected' : 'Missing'}`);
    console.log(`✅ Server started successfully at ${new Date().toISOString()}`);
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

}).catch(err => {
  console.error('❌ Failed to start server:', err);
  console.error('Error details:', err.message);
  console.error('Stack trace:', err.stack);
  process.exit(1);
});
