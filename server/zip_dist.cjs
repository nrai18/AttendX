
const AdmZip = require("adm-zip");
const path = require("path");
const zip = new AdmZip();
zip.addLocalFolder(path.join(__dirname, "../client/dist"));
zip.writeZip(path.join(__dirname, "uploads/update.zip"));
console.log("update.zip created");

