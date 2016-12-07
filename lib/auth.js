'use strict';

const express = require('express');
const https = require('https');
const concat = require('concat-stream');
const facebook = {
    appId: '702963836530548',
    appSecret: 'e8fa530bfe8b6e700cd116a144db393a'
};

/**
 * build facebook redirect URL for current server
 * reading req object
 * @param  {Request} req express request object
 * @return {string}     redirect URL
 */
function facebookRedirectURL(req) {
    const port = process.env.PORT || 8080;
    return (req.secure ? 'https://' : 'http://')
        + req.hostname + (port !== 80 ? ':' + port : '')
        + '/auth/facebook/callback';
}

module.exports = function(pages, db) {
    const router = express.Router();

    router.get('/', function(req, res) {
        res.type('html');
        res.send(`
            <!DOCTYPE html>
            <html>
                <head>
                </head>
                <body>
                    <form>
                        <button formaction='/auth/facebook' formmethod='post'>
                            Login with Facebook
                        </button>

                        <button formaction='/auth/twitter' formmethod='post'>
                            Login with Twitter
                        </button>
                    </form>
                </body>
            </html>
            `);
    });

    router.post('/facebook', function(req, res) {
        const redirectURL = facebookRedirectURL(req);
        const fbUrl = 'https://www.facebook.com/v2.8/dialog/oauth'
            + `?client_id=${facebook.appId}`
            + `&redirect_uri=${redirectURL}`;
        res.redirect(fbUrl);
    });

    router.get('/facebook/callback', function(req, res, next) { // read auth code from url and request access token
        const authCode = req.query.code;
        if(!authCode)
            return res.redirect('/'); // TODO: show 'flash' message or similar

        const redirectURL = facebookRedirectURL(req);

        const fbUrl = 'https://graph.facebook.com/v2.8/oauth/access_token'
            + `?client_id=${facebook.appId}`
            + `&client_secret=${facebook.appSecret}`
            + `&redirect_uri=${redirectURL}`
            + `&code=${authCode}`;

        https.get(fbUrl, r => {
            r.on('error', err => {
                next(err);
            });
            r.pipe(concat(data => {
                try {
                    const parsed = JSON.parse(data);
                    const token = parsed['access_token'];
                    if(!token)
                        next(new Error('access token missing from facebook login response'));

                    res.locals.fbToken = token;
                    next();
                } catch(err) {
                    return next(err);
                }
            }));
        });
    }, function(req, res, next) { // use facebook user access token to retrieve its unique user id
        https.get(`https://graph.facebook.com/me?access_token=${res.locals.fbToken}`, r => {
            r.on('error', err => {
                next(err);
            });
            r.pipe(concat(data => {
                try {
                    const parsed = JSON.parse(data);
                    const userID = parsed['id'];
                    const userDoc = {
                        facebook: userID
                    };

                    const c = db.collection('users');
                    c.findOneAndUpdate(userDoc, userDoc, {
                        upsert: true,
                        returnOriginal: false
                    })
                    .then(result => {
                        req.session.user = result.value;
                        res.redirect('/');
                    })
                    .catch(err => {
                        next(err);
                    });
                } catch(err) {
                    return next(err);
                }
            }));
        });
    });

    router.post('/logout', function(req, res) {
        req.session.destroy(err => {
            if(err)
                console.log(err);
            res.redirect('/');
        });
    });

    return router;
};
