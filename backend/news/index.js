const newsRoutes = require("../../news-routes");
const newsStore = require("../../news-store");

module.exports = {
  ...newsRoutes,
  ...newsStore,
};
