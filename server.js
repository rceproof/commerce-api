const http = require('http');

const server = http.createServer((req, res) => {
  console.log("요청 들어온 경로:", req.url);

  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("환영합니다! Commerce API 입니다");
  } else if (req.url === "/products") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("상품 목록입니다");
  } else if (req.url === "/orders") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("주문 목록입니다");
  } else {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("페이지를 찾을 수 없습니다");
  }
});

server.listen(3000, () => {
  console.log('서버 실행중 http://localhost:3000')
});
