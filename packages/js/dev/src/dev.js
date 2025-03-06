import { buildAppLocal } from "./buildAppLocal.js";
import http from "http";
import open from "open";
import crypto from "crypto";

export function dev({ magicPath, debug, port, url, autoOpen = true }) {
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
        console.log(
          `Magic Sandbox dev server running at http://localhost:${port}`,
        );
        const appUrl = `${url}?_app=magicsandbox.DevLocal&devLocalPort=${port}&devLocalToken=${token}`;
        if (autoOpen) {
          console.log(`Opening ${appUrl} in your default browser...`);
          open(appUrl);
        }
        server.url = appUrl;
        resolve(server);
      });
    });
  } catch (error) {
    console.error("Failed to start dev server:", error);
    process.exit(1);
  }
}
