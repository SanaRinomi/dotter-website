const settings = require("../../config.json");
const port = settings.port || 8080;

const website = {
    title: settings.name,
    styles: ["/css/style.css"]
}

module.exports = {
    settings,
    port,
    website
}