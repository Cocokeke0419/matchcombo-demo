import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(__dirname, "..");
const preferredPort = Number.parseInt(process.env.PORT || "5173", 10);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

function contentType(filePath) {
  return mimeTypes.get(extname(filePath)) || "application/octet-stream";
}

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const normalized = normalize(pathname).replace(/^([/\\])+/, "");
  const target = resolve(join(root, normalized));

  if (!target.startsWith(root)) {
    return null;
  }

  return target;
}

async function sendFile(response, filePath) {
  const body = await readFile(filePath);
  response.writeHead(200, { "Content-Type": contentType(filePath) });
  response.end(body);
}

function createStaticServer() {
  return createServer(async (request, response) => {
    try {
      let filePath = resolveRequestPath(request.url || "/");

      if (!filePath) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      const fileStat = await stat(filePath).catch(() => null);
      if (fileStat?.isDirectory()) {
        filePath = join(filePath, "index.html");
      } else if (!fileStat && request.url === "/") {
        filePath = join(root, "frontend", "index.html");
      }

      await sendFile(response, filePath);
    } catch (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(`Not found\n${error instanceof Error ? error.message : ""}`);
    }
  });
}

async function listen(port, attempts = 12) {
  for (let offset = 0; offset < attempts; offset++) {
    const candidate = port + offset;
    const server = createStaticServer();

    try {
      await new Promise((resolveListen, rejectListen) => {
        server.once("error", rejectListen);
        server.listen(candidate, "127.0.0.1", resolveListen);
      });

      console.log(`Match Combo server running at http://127.0.0.1:${candidate}/frontend/`);
      return;
    } catch (error) {
      server.close();
      if (error?.code !== "EADDRINUSE") {
        throw error;
      }
    }
  }

  throw new Error(`No available port from ${port} to ${port + attempts - 1}`);
}

listen(preferredPort).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

