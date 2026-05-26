const socialRoutes = require("../../social-routes");
const socialStore = require("../../social-store");
const presence = require("../../presence");

module.exports = {
  ...socialRoutes,
  ...socialStore,
  ...presence,
};
