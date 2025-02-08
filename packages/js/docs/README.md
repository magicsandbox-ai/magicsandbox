## Usage

```javascript
import { docs } from "@magicsandbox.ai/docs";

function context() {
  return `Context specific to my App here...

  Magic Sandbox executes Apps in a sandbox. The restrictions and capabilities of the Sandbox are documented below:

  ${docs("sandbox")}
  `;
}

export { context };
```
