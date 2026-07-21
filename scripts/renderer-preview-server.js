const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const port = Number.parseInt(process.env.PREVIEW_PORT || "4187", 10);
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function send(response, status, body, type = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  response.end(body);
}

http.createServer((request, response) => {
  const requestPath = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
  if (requestPath === "/") {
    const htmlPath = path.join(root, "src", "renderer", "index.html");
    const html = fs.readFileSync(htmlPath, "utf8")
      .replace("./styles.css", "/src/renderer/styles.css")
      .replace("./crop-geometry.js", "/src/renderer/crop-geometry.js")
      .replace("../token-usage.js", "/src/token-usage.js")
      .replace(
        '<script src="./renderer.js"></script>',
        '<script src="/scripts/renderer-preview-mock.js"></script><script src="/src/renderer/renderer.js"></script>'
      );
    send(response, 200, html, types[".html"]);
    return;
  }

  const relative = decodeURIComponent(requestPath).replace(/^\/+/, "");
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(`${root}${path.sep}`) || !fs.existsSync(absolute) || fs.statSync(absolute).isDirectory()) {
    send(response, 404, "Not found");
    return;
  }
  send(response, 200, fs.readFileSync(absolute), types[path.extname(absolute).toLowerCase()] || "application/octet-stream");
}).listen(port, "127.0.0.1", () => {
  console.log(`Renderer preview: http://127.0.0.1:${port}`);
});
