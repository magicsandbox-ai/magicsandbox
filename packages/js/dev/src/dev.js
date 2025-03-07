import { buildAppLocal } from "./buildAppLocal.js";
import http from "http";
import open from "open";
import crypto from "crypto";
import fs from "fs";
import path from "path";

function dev({ magicPath, debug, port, url, autoOpen = true }) {
  try {
    const token = crypto.randomUUID();

    const corsHeaders = {
      "Access-Control-Allow-Origin": url,
      "Access-Control-Allow-Headers": "x-token",
    };

    const headers = {
      ...corsHeaders,
      "Content-Type": "application/json",
    };

    const contextRef = { current: {} };

    const server = http.createServer(async (req, res) => {
      try {
        //handle CORS preflight requests
        if (req.method === "OPTIONS") {
          res.writeHead(204, corsHeaders);
          res.end();
          return;
        }
        const reqToken = req.headers["x-token"];
        if (reqToken !== token) {
          res.writeHead(401, headers);
          res.end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }
        const { appObj } = await buildAppLocal({
          magicPath,
          debug,
          contextRef,
          prod: false,
        });
        res.writeHead(200, headers);
        res.end(JSON.stringify(appObj));
      } catch (error) {
        console.error(error);
        res.writeHead(500, headers);
        res.end(JSON.stringify({ error: error.message }));
      }
    });

    return new Promise((resolve) => {
      server.listen(port, () => {
        const devServerUrl = `http://localhost:${port}`;
        console.log(`Magic Sandbox dev server running at ${devServerUrl}`);
        const appUrl = `${url}?_app=magicsandbox.DevLocal&devLocalPort=${port}&devLocalToken=${token}`;
        if (autoOpen) {
          console.log(`Opening ${appUrl} in your default browser...`);
          open(appUrl);
        }
        server.devServerUrl = devServerUrl;
        server.appUrl = appUrl;

        //create a file to enable detecting if the dev server is running
        const jsonPath = path.join(magicPath, ".devlocal.json");
        fs.writeFileSync(
          jsonPath,
          JSON.stringify({ devServerUrl, appUrl }, null, 2),
        );
        function cleanup() {
          if (fs.existsSync(jsonPath)) {
            fs.unlinkSync(jsonPath);
          }
          process.exit(0);
        }
        server.on("close", cleanup);
        process.on("SIGINT", () => server.close());
        process.on("SIGTERM", () => server.close());
        resolve(server);
      });
    });
  } catch (error) {
    console.error("Failed to start dev server:", error);
    process.exit(1);
  }
}

async function isRunning(magicPath) {
  const jsonPath = path.join(magicPath, ".devlocal.json");
  if (fs.existsSync(jsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      const response = await fetch(data.devServerUrl, {
        method: "OPTIONS",
      });
      if (response.ok) {
        return data;
      } else {
        throw new Error(`${data.devServerUrl} returned ${response.status}`);
      }
    } catch (error) {
      console.error(
        `${jsonPath} exists but error connecting to dev server:`,
        error,
      );
      console.log(`Deleting ${jsonPath}`);
      fs.unlinkSync(jsonPath);
      return false;
    }
  }
  return false;
}

export { dev, isRunning };
