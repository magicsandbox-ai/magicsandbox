import { dev } from "@magicsandbox.ai/dev";

function cli(appPath, debug, port, url) {
  //install browsers?
  dev(appPath, debug, port, url); //start dev server
  //run tests
}

export { cli };
