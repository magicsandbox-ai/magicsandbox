import { v4 as uuid } from "uuid";

function generateUuid() {
  return uuid();
}

export { generateUuid };
