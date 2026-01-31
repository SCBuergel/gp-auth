import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const PORT = 8080;
const API_HOST = "https://api.gnosispay.com";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const send = (res, status, body, type) => {
  if (res.headersSent) return;
  res.writeHead(status, { "content-type": type || "text/plain; charset=utf-8" });
  res.end(body);
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      const targetUrl = `${API_HOST}${url.pathname}${url.search}`;
      console.log("[proxy] request", req.method, targetUrl);

      const headers = { ...req.headers };
      delete headers.host;
      delete headers.origin;

      const body = req.method === "GET" || req.method === "HEAD" ? undefined : req;
      const upstream = await fetch(targetUrl, {
        method: req.method,
        headers,
        body,
        duplex: "half",
        redirect: "manual",
      });

      console.log("[proxy] response", req.method, targetUrl, upstream.status);

      const bodyBuffer = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(upstream.status, Object.fromEntries(upstream.headers.entries()));
      res.end(bodyBuffer);
      return;
    }

    const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const absolutePath = join(process.cwd(), filePath);
    const ext = extname(absolutePath);
    try {
      const content = await readFile(absolutePath);
      send(res, 200, content, contentTypes[ext] || "application/octet-stream");
    } catch (err) {
      if (err?.code === "ENOENT") {
        send(res, 404, "Not found");
        return;
      }
      throw err;
    }
  } catch (err) {
    console.error("[server] error", err);
    if (!res.headersSent) {
      send(res, 500, "Server error");
    } else {
      res.end();
    }
  }
});

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
