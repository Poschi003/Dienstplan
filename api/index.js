const { handleApi } = require("../server");

module.exports = async function handler(req, res) {
  try {
    await handleApi(req, res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: error.message || "Serverfehler" }));
  }
};
