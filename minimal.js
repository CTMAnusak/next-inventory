console.log('Starting minimal server...');
const http = require('http');

const server = http.createServer((req, res) => {
  console.log('Request received');
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.end('<h1>Minimal Server Works!</h1><p>Time: ' + new Date() + '</p>');
});

server.listen(80, () => {
  console.log('Minimal server running on port 80');
});

server.on('error', (err) => {
  console.error('Server error:', err);
});
