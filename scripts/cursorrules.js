import fs from "fs";

const intro =
  "I'm developing a platform called Magic Sandbox. Below is general information about the platform as well as developer documentation. This information may be out of date as the platform undergoes development.";
const about = fs.readFileSync("apps/About/index.md", "utf8");
const docs = fs.readFileSync("apps/Docs/index.md", "utf8");

const cursorrules = `${intro}\n\n${about}\n\n${docs}`;

fs.writeFileSync(".cursorrules", cursorrules);
