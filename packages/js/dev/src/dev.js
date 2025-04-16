import { buildAppLocal } from "./buildAppLocal.js";
import http from "http";
import open from "open";
import defaultBrowser from "default-browser";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const tunnelProviders = {
  ngrok: {
    start: (port) => {
      return new Promise((resolve, reject) => {
        const tunnelProcess = spawn("ngrok", [
          "http",
          port.toString(),
          "--log=stdout",
          "--log-format=json",
          "--compression",
        ]);

        let output = "";

        const timeoutId = setTimeout(() => {
          reject(new Error("Timeout waiting for ngrok to start"));
          console.log("ngrok output:\n", output);
          try {
            killProcessAndChildren(tunnelProcess);
          } catch (error) {
            console.error("Failed to kill ngrok:", error);
          }
        }, 10000);

        tunnelProcess.stdout.on("data", (data) => {
          try {
            output += data.toString();
            const lines = data.toString().split("\n");
            for (const line of lines) {
              if (!line.trim()) continue;
              const obj = JSON.parse(line);
              if (obj.url) {
                resolve({
                  url: obj.url,
                  tunnelProcess,
                });
                clearTimeout(timeoutId);
                break;
              }
            }
          } catch (err) {
            console.error("error parsing ngrok log:");
            console.error(err);
            console.error(data.toString());
          }
        });

        tunnelProcess.stderr.on("data", (data) => {
          console.error(`ngrok error: ${data}`);
        });

        tunnelProcess.on("error", (err) => {
          if (err.code === "ENOENT") {
            reject(new Error("ngrok is not installed"));
          } else {
            reject(err);
          }
        });
      });
    },
  },
};

async function dev({ magicPath, debug, port, url, autoOpen = true, tunnel }) {
  const cleanups = [];
  try {
    let devLocalUrl, tunnelProcess;
    if (tunnel) {
      const provider = tunnelProviders[tunnel];
      if (!provider) {
        throw new Error(`Unknown tunnel provider: ${tunnel}`);
      }
      ({ url: devLocalUrl, tunnelProcess } = await provider.start(port));
      cleanups.push(() => {
        try {
          killProcessAndChildren(tunnelProcess);
        } catch (error) {
          console.error("Failed to kill tunnel process:", error);
        }
      });
    }

    const token = crypto.randomUUID();

    const corsHeaders = {
      "Access-Control-Allow-Origin": url,
      "Access-Control-Allow-Headers": "x-token, ngrok-skip-browser-warning",
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
          prod: tunnel ? true : false, //when tunneling, minify, no sourcemaps by default
        });
        res.writeHead(200, headers);
        res.end(JSON.stringify(appObj));
      } catch (error) {
        console.error(error);
        res.writeHead(500, headers);
        res.end(JSON.stringify({ error: error.message }));
      }
    });

    await new Promise((resolve) => server.listen(port, resolve));

    const devServerUrl = `http://localhost:${port}`;
    console.log(`Magic Sandbox dev server running at ${devServerUrl}`);
    let appUrl = `${url}?_app=magicsandbox.DevLocal&devLocalPort=${port}&devLocalToken=${token}`;
    if (devLocalUrl) {
      appUrl += `&devLocalUrl=${devLocalUrl}`;
    }
    if (autoOpen && !devLocalUrl) {
      const browser = await defaultBrowser();
      if (browser.name.toLowerCase().includes("safari")) {
        console.log("\n⚠️  Safari detected as default browser");
        console.log("Safari requires HTTPS even for localhost connections");
        console.log("To proceed, either:");
        console.log("1. Use the --tunnel flag. See 'Using HTTPS' in the docs");
        console.log("2. Open the URL manually in a different browser:");
        console.log(`   ${appUrl}\n`);
      } else {
        console.log(`Opening in your default browser: ${appUrl}`);
        open(appUrl);
      }
    } else if (devLocalUrl) {
      console.log(`Tunnel created with ${tunnel}`);
      console.log(`Open this url on any device: ${appUrl}`);
    }
    server.devServerUrl = devServerUrl;
    server.appUrl = appUrl;

    //create a file to enable detecting if the dev server is running
    const jsonPath = path.join(magicPath, ".devlocal.json");
    fs.writeFileSync(
      jsonPath,
      JSON.stringify({ devServerUrl, appUrl }, null, 2),
    );
    cleanups.push(() => {
      try {
        if (fs.existsSync(jsonPath)) {
          fs.unlinkSync(jsonPath);
        }
      } catch (error) {
        console.error("Failed to delete .devlocal.json:", error);
      }
    });

    server.on("close", () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
      process.exit(0);
    });
    process.on("SIGINT", () => server.close());
    process.on("SIGTERM", () => server.close());

    return server;
  } catch (error) {
    console.error("Failed to start dev server:", error);
    for (const cleanup of cleanups) {
      cleanup();
    }
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

export { dev, isRunning, tunnelProviders };

function killProcessAndChildren(proc) {
  // I thought ngrok spawned a child process that needed to be killed, but maybe not? might need to revisit this
  // const pid = proc.pid;
  // if (process.platform === "win32") {
  //   let childrenString = execSync(
  //     `powershell "Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq ${pid} } | Select-Object -ExpandProperty ProcessId"`,
  //   ).toString();
  //   const children = childrenString.match(/\d+/g) || [];
  //   for (const child of children) {
  //     execSync(`taskkill /PID ${child} /F`);
  //   }
  // } else {
  //   execSync(`pkill -TERM -P ${pid}`);
  // }
  if (!proc.killed) {
    proc.kill();
  }
}
