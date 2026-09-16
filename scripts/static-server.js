/* Minimal static file server, no dependencies. Used by the smoke test
   and available for local dev: `node scripts/static-server.js [port]`. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function startServer(rootDir, port) {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const filePath = path.join(rootDir, urlPath);
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(port || 0, "127.0.0.1", () => resolve(server));
  });
}

module.exports = { startServer };

if (require.main === module) {
  const port = Number(process.argv[2]) || 8080;
  startServer(path.join(__dirname, ".."), port).then((server) => {
    const addr = server.address();
    console.log(`Serving Throughline at http://127.0.0.1:${addr.port}`);
  });
}
