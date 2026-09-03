const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('안녕! 첫서버 생성');
});

server.listen(3000, () => {
  console.log('서버 실행중 http://localhost:3000')
});
