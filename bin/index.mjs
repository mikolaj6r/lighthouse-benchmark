#!/usr/bin/env node

import { inspect } from 'util';
import runLighthouse from '../src/run-lighthouse.mjs';
const args = process.argv.slice(2);

(async function(){
  const result = await runLighthouse(args);
  console.log(inspect(result,  false, null, true /* enable colors */));
})()