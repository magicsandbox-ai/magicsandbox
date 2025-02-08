#!/usr/bin/env node

import { build } from "../index.js";
import { promises as fs } from "fs";

const file = process.argv[2];
