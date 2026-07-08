const fs = require("fs-extra");
const path = require("path");

const ROUTES_FILE = path.join(
  process.cwd(),
  "apps",
  "web",
  "src",
  "routes.jsx"
);

async function addPageRoute(pageName) {
  let content = await fs.readFile(ROUTES_FILE, "utf8");

  const importLine = `import ${pageName} from "./pages/${pageName}/${pageName}";`;

  // Skip if already imported
  if (!content.includes(importLine)) {
    content = content.replace(
      'import Home from "./pages/Home/Home";',
      `import Home from "./pages/Home/Home";
${importLine}`
    );
  }

  const routeLine = `        <Route path="/${pageName.toLowerCase()}" element={<${pageName} />} />`;

  // Skip if already exists
  if (!content.includes(routeLine)) {
    content = content.replace(
      "      </Routes>",
      `${routeLine}
      </Routes>`
    );
  }

  await fs.writeFile(ROUTES_FILE, content);

  console.log("✅ Route added");
}

module.exports = {
  addPageRoute,
};
