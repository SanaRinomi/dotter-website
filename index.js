const {port, settings, website} = require("./src/controllers/constants");
const {Database, settings: {SettingsTable}} = require("./src/controllers/dbMain");

// Express
const express = require("express"),
    handlebars = require("express-handlebars").create({defaultLayout:'main', helpers: {...require('handlebars-helpers')(['array', 'object', 'comparison', 'html', 'markdown', 'url', 'string', 'code']), date: require('helper-date')}}),
    session = require("express-session"),
    KnexSessionStore = require('connect-session-knex')(session)

let server = express();

const store = new KnexSessionStore({knex: Database.db});
    
const flash = require("smol-flash");

if(settings.proxy) server.set('trust proxy', 1);

server.engine('handlebars', handlebars.engine);
server.set('view engine', 'handlebars');
server.set('views', 'src/views');

server.use(session({ secret: settings.secret, store, proxy: settings.proxy, cookie: {secure:settings.secure}, saveUninitialized: false, resave: false}));
server.use(express.json());

server.use(express.static('src/public'));

SettingsTable.all().then(v => {
    website.configured = v.success;

    server.listen(port, function() {
        console.log(`Express server started at port ${port}; press Ctrl-C to terminate`);
        console.log(`Is website configured? ${website.configured}`);
    });
});