// Loads the BUILT package the way a consumer would (require and import). Unit tests run on the
// sources and cannot catch a broken build: 0.2.0 shipped ESM output that Node could not load.
const assert = require("node:assert/strict");
const path = require("node:path");

const entry = path.join(__dirname, "..", "dist", "index.js");
const EXPECTED = ["MVolaClient", "MvolaError", "MvolaNetworkError", "MvolaUncertainOutcomeError", "MvolaValidationError", "isOutcomeUncertain", "normalizeStatus"];

const viaRequire = require(entry);
for (const name of EXPECTED) assert.equal(typeof viaRequire[name], "function", `require: missing export ${name}`);

import(entry).then((viaImport) => {
  for (const name of EXPECTED) assert.equal(typeof viaImport[name], "function", `import: missing named export ${name}`);
  const client = new viaImport.MVolaClient({ consumerKey: "k", consumerSecret: "s", partnerName: "p", merchantAccount: "0343500003" });
  assert.equal(typeof client.transaction.initiate, "function");
  console.log("package smoke test: require and import OK");
});
