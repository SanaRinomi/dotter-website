const CryptoJS = require("crypto-js");
const {DateTime} = require("luxon");

const FormData = require("form-data"),
    fetch = require("node-fetch");

const flash = require("smol-flash");

class Auth {
    constructor(client_id, client_secret, callback_uri, scope = "identify", prompt = "consent") {
        this._client_id = client_id;
        this._client_secret = client_secret;
        this._cb_uri = callback_uri;
        this._scope = scope;
        this._prompt = prompt;
    }

    logOut(config = {
        redirectSuccess: null,
        redirectFailure: null
    }) {
        return (req, res, next) => {
            req.session.regenerate((err) => {
                if(err) {
                    flash(req, {error: true, description: "No session found"});
                    config.redirectFailure ? res.redirect(config.redirectFailure) : next(new Error("No session found"));
                } else {
                    flash(req, {error: false, description: "Log out success"});
                    config.redirectSuccess ? res.redirect(config.redirectSuccess) : next();
                }
            });
        }
    }

    isLoggedIn(config = {
        redirectSuccess: null,
        redirectFailure: null,
        cachedGuild: true,
        cachedGuildUser: true,
        required: true
    }) {
        let _config = {
            redirectSuccess: null,
            redirectFailure: null,
            cachedGuild: true,
            cachedGuildUser: true,
            required: true,
            ...config
        }

        return async (req, res, next) => {
            if(!req.session.loggedIn) {
                if(_config.required) {
                    req.loggedIn = false;
                    flash(req, {error: true, description: "Not logged in"});
                    _config.redirectFailure ? res.redirect(_config.redirectFailure) : next(new Error("Not authorized"));
                } else{
                    req.loggedIn = false;
                    next();
                }
            }

            if(req.session.discord_id) {
                req.loggedIn = true;
                _config.redirectSuccess ? res.redirect(_config.redirectSuccess) : next();
            } else {
                req.session.loggedIn = false;
                req.loggedIn = false;
                flash(req, {error: true, description: "Invalid session"});
                _config.redirectFailure ? res.redirect(_config.redirectFailure) : next(new Error("Invalid token"));
            };
        }
    }

    authenticate(config = {
        redirectSuccess: null,
        redirectFailure: null
    }) {
        

        return async (req, res, next) => {
            if(req.session.loggedIn) {
                config.redirectSuccess ? res.redirect(config.redirectSuccess) : next();
                return;
            }

            const remoteState = req.query.state;
            let state = req.session.state;
            if(remoteState && (state !== remoteState)) {
                console.log(`State result: ${state !== remoteState}; Local state: ${state}; Remote state: ${remoteState}`);
                next(new Error("Remote state and local state hijacked"));
            } else if(!remoteState && !state) {
                const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                let newState = CryptoJS.SHA3(`state-${ip}${DateTime.fromJSDate(Date.now()).toISO()}`, { outputLength: 256 }).toString(CryptoJS.enc.Base64);
                req.session.state = newState;
                res.redirect(`https://discord.com/api/oauth2/authorize?response_type=code&client_id=${this._client_id}&scope=${encodeURIComponent(this._scope)}&state=${encodeURIComponent(newState)}&redirect=${this._cb_uri}&prompt=${this._prompt}`);
            } else {
                const code = req.query.code;
                if(!code){
                    req.session.state = null;
                    flash(req, {error: true, description: `${req.query.error_description}`})
                    config.redirectFailure ? res.redirect(config.redirectFailure) : next(new Error("Not Authorized"));
                    return;
                }

                let form = new FormData();
                form.append("client_id", this._client_id);
                form.append("client_secret", this._client_secret);
                form.append("grant_type", "authorization_code");
                form.append("code", code);
                form.append("scope", this._scope);
                form.append("redirect_uri", this._cb_uri);

                let api_token = await fetch("https://discord.com/api/oauth2/token",
                {
                    method: "POST",
                    body: form,
                    headers: form.getHeaders()
                });

                if(!api_token.ok) {
                    next(new Error("Can't get authorization: " + api_token.statusText));
                    return;
                }

                let json_token = await api_token.json();
                let api_user = await fetch("https://discord.com/api/users/@me", {
                    headers: {
                        "Authorization": `Bearer ${json_token.access_token}`
                    }
                });

                if(!api_user.ok) {
                    next(new Error("Can't get user data: " + api_user.statusText));
                    return;
                }
                let json_user = await api_user.json();
                req.session.loggedIn = true;
                req.session.discord_id = json_user.id;
                req.session.username = json_user.username;
                flash(req, {error: false, description: "Successful authentication"});
                next();
            }
        }
    }
}

module.exports = {
    Auth
}