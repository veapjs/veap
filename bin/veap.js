#!/usr/bin/env node

import { createRequire } from "module";
const require = createRequire(import.meta.url);

// We run the compiled CLI from dist
require("../dist/infrastructure/cli/index.js");
