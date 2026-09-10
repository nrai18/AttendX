const AdmZip = require("adm-zip");
const path = require("path");

const zip = new AdmZip();
zip.addLocalFolder(path.join(__dirname, "../client/dist"));
zip.writeZip(path.join(__dirname, "src/uploads/update.zip"));

console.log("update.zip securely bundled to src/uploads/");
