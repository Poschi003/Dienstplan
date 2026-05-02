const fs = require("fs");
const path = require("path");
const { handleApi } = require("./lib/api-handler");

module.exports = async function server(req, res) {
  if (req.url && req.url.startsWith("/api/")) {
    await handleApi(req, res);
    return;
  }

  if (req.url === "/favicon.ico") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const indexPath = path.join(__dirname, "public", "index.html");
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(fs.readFileSync(indexPath, "utf8"));
};
