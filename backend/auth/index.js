const authRoutes = require("../../auth-routes");
const userStore = require("../../user-store");
const emailAuth = require("../../email-auth");
const mailer = require("../../mailer");

module.exports = {
  ...authRoutes,
  ...userStore,
  ...emailAuth,
  ...mailer,
};
