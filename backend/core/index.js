const db = require("../../db");
const siteSettings = require("../../site-settings");

module.exports = {
  ...db,
  ...siteSettings,
};
