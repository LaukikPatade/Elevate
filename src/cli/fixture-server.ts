import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PAGE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "fixtures",
  "internal-crm",
  "index.html",
);

export interface FixtureServer {
  url: string;
  close: () => Promise<void>;
}

export function startFixtureServer(port = 0): Promise<FixtureServer> {
  const html = readFileSync(PAGE);
  const server: Server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      const boundPort = typeof address === "object" && address ? address.port : port;
      resolve({
        url: `http://127.0.0.1:${boundPort}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
