// Obfuscate the bundled IIFE. Modest settings — enough that the file is not
// casually editable as text, without the heavy control-flow flattening that
// can break large React bundles or slow them to a crawl.
const fs = require("fs");
const JO = require("javascript-obfuscator");
const [,, inPath, outPath] = process.argv;
const code = fs.readFileSync(inPath, "utf8");
const res = JO.obfuscate(code, {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  stringArray: true,
  stringArrayThreshold: 0.75,
  stringArrayEncoding: ["base64"],
  splitStrings: false,
  identifierNamesGenerator: "hexadecimal",
  numbersToExpressions: true,
  simplify: true,
  renameGlobals: false,
  selfDefending: false,
  disableConsoleOutput: false,
});
fs.writeFileSync(outPath, res.getObfuscatedCode());
console.log("obfuscated", inPath, "->", outPath, "(" + fs.statSync(outPath).size + " bytes)");
