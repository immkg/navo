#!/usr/bin/env node

const { showMainMenu } = require("./menu");

async function main() {
  console.clear();
  await showMainMenu();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
