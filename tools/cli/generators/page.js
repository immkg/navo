const fs = require("fs-extra");
const path = require("path");
const { input, confirm } = require("@inquirer/prompts");
const { addPageRoute } = require("../utils/routes");

async function generatePage() {
  const pageName = await input({
    message: "Page name:",
    validate(value) {
      if (!value.trim()) return "Required";
      return true;
    },
  });

  const css = await confirm({
    message: "Generate CSS Module?",
    default: true,
  });

  const test = await confirm({
    message: "Generate Test?",
    default: true,
  });

  const pageDir = path.join(
    process.cwd(),
    "apps",
    "web",
    "src",
    "pages",
    pageName
  );

  await fs.ensureDir(pageDir);

  await fs.writeFile(
    path.join(pageDir, `${pageName}.jsx`),
    `export default function ${pageName}() {
  return (
    <div>
      <h1>${pageName}</h1>
    </div>
  );
}
`
  );

  if (css) {
    await fs.writeFile(path.join(pageDir, `${pageName}.module.css`), ``);
  }

  if (test) {
    await fs.writeFile(
      path.join(pageDir, `${pageName}.test.jsx`),
      `import { render, screen } from "@testing-library/react";
import ${pageName} from "./${pageName}";

test("renders page", () => {
  render(<${pageName} />);
  expect(screen.getByText("${pageName}")).toBeInTheDocument();
});
`
    );
  }

  await addPageRoute(pageName);

  console.log("");
  console.log("✅ Page created");
  console.log(pageDir);
}

module.exports = {
  generatePage,
};
