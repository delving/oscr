'use strict';

var _ = require("underscore");
var express = require('express');
var storage = require('./storage');
var app = express();
var https = require('https');
var crypto = require('crypto');

app.use(express.bodyParser());

storage.useDatabase('oscr', function (name) {
    console.log('Yes we have ' + name);
});

function apiQueryString() {
    var API_QUERY_PARAMS = {
        "apiToken": "6f941a84-cbed-4140-b0c4-2c6d88a581dd",
        "apiOrgId": "delving",
        "apiNode": "playground"
    };
    var queryParams = [];
    for (var key in API_QUERY_PARAMS) {
        queryParams.push(key + '=' + API_QUERY_PARAMS[key]);
    }
    return queryParams.join('&');
}

function requestOptions(path) {
    return         {
        method: "GET",
        host: 'commons.delving.eu',
        port: 443,
        path: path + '?' + apiQueryString()
    }
}

app.post('/authenticate', function (req, res) {
    var sha = crypto.createHash('sha512');
    var hashedPassword = sha.update(new Buffer(req.body.password, 'utf-8')).digest('base64');
    var hmac = crypto.createHmac('sha1', req.body.username);
    var hash = hmac.update(hashedPassword).digest('hex');
    https.request(
        requestOptions('/user/authenticate/' + hash),
        function (authResponse) {
            if (authResponse.statusCode == 200) {
                https.request(
                    requestOptions('/user/profile/' + req.body.username),
                    function(profileResponse) {
                        var data;
                        profileResponse.on('data', function(data) {
                            console.log("profile returned :"+data);
                            var profile = JSON.parse(data);
                            console.log("profile:");
                            console.log(profile);
                            res.json(profile);

                        });
//                        if (profileResponse.statusCode == 200) {
//                        }
//                        else {
//                            res.json({error: "Failed to fetch profile"});
//                        }
                    }
                ).end();
            }
            else {
                res.json({error: "Failed to contact CultureCommons"});
            }
        }
    ).end();
});

function replyWithLanguage(lang, res) {
    storage.getLanguage(lang, function (language) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(language);
    });
}

app.get('/i18n/:lang', function (req, res) {
    replyWithLanguage(req.params.lang, res);
});

app.post('/i18n/:lang/element', function (req, res) {
    var lang = req.params.lang;
    var key = req.body.key;
    if (key) {
        if (req.body.title) storage.setElementTitle(lang, key, req.body.title, function (ok) {
            replyWithLanguage(lang, res);
        });
        if (req.body.doc) storage.setElementDoc(lang, key, req.body.doc, function (ok) {
            replyWithLanguage(lang, res);
        });
    }
});

app.post('/i18n/:lang/label', function (req, res) {
    var lang = req.params.lang;
    var key = req.body.key;
    if (key) {
        if (req.body.label) storage.setLabel(lang, key, req.body.label, function (ok) {
            replyWithLanguage(lang, res);
        });
    }
});

app.get('/vocabulary/:vocab', function (req, res) {
    storage.getVocabularySchema(req.params.vocab, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(xml);
    });
});

app.get('/vocabulary/:vocab/select', function (req, res) {
    var search = req.param('q').toLowerCase();
    storage.getVocabularyEntries(req.params.vocab, search, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send("<Entries>" + xml + "</Entries>");
    });
});

app.post('/vocabulary/:vocab/add', function (req, res) {
    var entry = req.body.Entry;
    storage.addVocabularyEntry(req.params.vocab, entry, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(xml);
    });
});

app.get('/document/schema/:schema', function (req, res) {
    storage.getDocumentSchema(req.params.schema, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(xml);
    });
});

app.get('/document/fetch/:identifier', function (req, res) {
    storage.getDocument(req.params.identifier, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(xml);
    });
});

app.get('/document/list', function (req, res) {
    storage.getDocumentList(function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send("<Headers>" + xml + "</Headers>");
    });
});

app.post('/document/save', function (req, res) {
    // kind of interesting to receive xml within json, but seems to work
//    console.log(req.body);
    storage.saveDocument(req.body, function (header) {
        res.json(header);
    });
});

module.exports = app;
