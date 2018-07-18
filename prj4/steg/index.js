#!/usr/bin/env nodejs

'use strict';

const assert = require('assert');
const path = require('path');
const process = require('process');
const services = require('./steg-web');

function usage() {
  console.error(`usage: ${process.argv[1]} PORT WS-URL...`);
  process.exit(1);
}

function getPort(portArg) {
  let port = Number(portArg);
  if (!port) usage();
  return port;
}

const BASE = '/api';

async function go(args) {
  try {
    const port = getPort(args[0]);
    //const images = await imgStore();
    services.serve(port, args[1]);
  }
  catch (err) {
    console.error(err);
  }
}
    

if (process.argv.length < 4) usage();
go(process.argv.slice(2));
