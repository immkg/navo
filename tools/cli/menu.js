const { select } = require("@inquirer/prompts");

const { generatePage } = require("./generators/page");
const { generateComponent } = require("./generators/component");
const { generateHook } = require("./generators/hook");
const { generateEndpoint } = require("./generators/endpoint");
const { generateFeature } = require("./generators/feature");

async function showMainMenu() {
  while (true) {
    const action = await select({
      message: "NAVO CLI",
      choices: [
        {
          name: "Create",
          value: "create",
        },
        {
          name: "Exit",
          value: "exit",
        },
      ],
    });

    if (action === "exit") {
      process.exit(0);
    }

    await showCreateMenu();
  }
}

async function showCreateMenu() {
  while (true) {
    const target = await select({
      message: "Create",
      choices: [
        {
          name: "Web",
          value: "web",
        },
        {
          name: "Back",
          value: "back",
        },
      ],
    });

    if (target === "back") return;

    if (target === "web") {
      await showWebMenu();
    }
  }
}

async function showWebMenu() {
  const option = await select({
    message: "Web",
    choices: [
      {
        name: "Page",
        value: "page",
      },
      {
        name: "Back",
        value: "back",
      },
    ],
  });

  if (option === "back") return;

  if (option === "page") {
    await generatePage();
  }
}

module.exports = {
  showMainMenu,
};
