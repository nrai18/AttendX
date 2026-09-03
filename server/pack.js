const AdmZip = require("adm-zip");
const path = require("path");

const zip = new AdmZip();
const distPath = path.join(__dirname, "../client/dist");
const outPath = path.join(__dirname, "src/uploads/update.zip");

zip.addLocalFolder(distPath);
zip.writeZip(outPath);
console.log("Successfully created update.zip using adm-zip!");
