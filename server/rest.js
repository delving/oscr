'use strict';

var _ = require("underscore");
var express = require('express');
var app = express();
var https = require('https');
var crypto = require('crypto');
var Storage = require('./storage');

app.use(express.bodyParser());

var storage = null;

Storage('oscr', function (s) {
    console.log('Yes we have ' + s.database);
    storage = s;
});

function commonsQueryString() {
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

function commonsRequest(path) {
    return {
        method: "GET",
        host: 'commons.delving.eu',
        port: 443,
        path: path + '?' + commonsQueryString()
    }
}

app.post('/authenticate', function (req, res) {
    var sha = crypto.createHash('sha512');
    var hashedPassword = sha.update(new Buffer(req.body.password, 'utf-8')).digest('base64');
    var hmac = crypto.createHmac('sha1', req.body.username);
    var hash = hmac.update(hashedPassword).digest('hex');
    res.setHeader('Content-Type', 'text/xml');
    https.request(
        commonsRequest('/user/authenticate/' + hash),
        function (authResponse) {
            if (authResponse.statusCode == 200) {
                https.request(
                    commonsRequest('/user/profile/' + req.body.username),
                    function (profileResponse) {
                        var data;
                        profileResponse.on('data', function (data) {
//                            console.log("profile returned :" + data);
                            var profile = JSON.parse(data);
//                            console.log("profile:");
//                            console.log(profile);
                            storage.Person.getOrCreateUser(profile, function(xml) {
                                res.send(xml);
                            });
                        });
                    }
                ).end();
            }
            else {
                res.send("<Error>Failed to authenticate</Error>");
            }
        }
    ).end();
});

function replyWithLanguage(lang, res) {
    storage.I18N.getLanguage(lang, function (language) {
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
        if (req.body.title) storage.I18N.setElementTitle(lang, key, req.body.title, function (ok) {
            replyWithLanguage(lang, res);
        });
        if (req.body.doc) storage.I18N.setElementDoc(lang, key, req.body.doc, function (ok) {
            replyWithLanguage(lang, res);
        });
    }
});

app.post('/i18n/:lang/label', function (req, res) {
    var lang = req.params.lang;
    var key = req.body.key;
    if (key) {
        if (req.body.label) storage.I18N.setLabel(lang, key, req.body.label, function (ok) {
            replyWithLanguage(lang, res);
        });
    }
});

app.get('/person/user/fetch/:email', function(req, res) {
    storage.Person.getUser(req.params.email, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(xml);
    });
});

app.get('/person/user/select', function(req, res) {
    var search = req.param('q').toLowerCase();
    storage.Person.getUsers(search, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(xml);
    });
});

app.get('/person/group/fetch/:identifier', function(req, res) {
    storage.Person.getGroup(req.params.identifier, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(xml);
    });
});

app.get('/person/group/select', function(req, res) {
    var search = req.param('q').toLowerCase();
    storage.Person.getGroups(search, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(xml);
    });
});

app.post('/person/group/save', function (req, res) {
    console.log('group save:');
    console.log(req.body);
    storage.Person.saveGroup(req.body, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(xml);
    });
});

app.get('/person/group/:identifier/users', function (req, res) {
    storage.Person.getUsersInGroup(req.params.identifier, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(xml);
    });
});

app.post('/person/group/:identifier/add', function (req, res) {
    storage.Person.addUserToGroup(req.body.email, req.body.role, req.params.identifier, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(xml);
    });
});

app.post('/person/group/:identifier/remove', function (req, res) {
    storage.Person.removeUserFromGroup(req.body.email, req.body.role, req.params.identifier, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(xml);
    });
});

app.get('/vocabulary/:vocab', function (req, res) {
    storage.Vocab.getVocabularySchema(req.params.vocab, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(xml);
    });
});

app.get('/vocabulary/:vocab/select', function (req, res) {
    var search = req.param('q').toLowerCase();
    storage.Vocab.getVocabularyEntries(req.params.vocab, search, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send("<Entries>" + xml + "</Entries>"); // todo: do it in the xquery
    });
});

app.post('/vocabulary/:vocab/add', function (req, res) {
    var entry = req.body.Entry;
    storage.Vocab.addVocabularyEntry(req.params.vocab, entry, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(xml);
    });
});

app.get('/document/schema/:schema', function (req, res) {
    storage.Document.getDocumentSchema(req.params.schema, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(xml);
    });
});

app.get('/document/fetch/:schema/:identifier', function (req, res) {
    storage.Document.getDocument(req.params.schema, req.params.identifier, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(xml);
    });
});

app.get('/document/list/:schema', function (req, res) {
    storage.Document.getDocumentList(req.params.schema, function (xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(xml);
    });
});

app.post('/document/save', function (req, res) {
    // kind of interesting to receive xml within json, but seems to work
//    console.log(req.body);
    storage.Document.saveDocument(req.body, function (header) {
        res.json(header);
    });
});

app.get('/image/list', function (req, res) {
    storage.Image.listImages(function(xml) {
        res.setHeader('Content-Type', 'text/xml');
        res.send(xml);
    });
});

app.get('/image/fetch/:fileName', function (req, res) {
    var fileName = req.params.fileName;
    var filePath = storage.Image.getImagePath(fileName);
    res.json({ hello: 'Congratulations!', filePath: filePath });
});

app.post('/image/save', function (req, res) {
    res.json({ hello: 'Thank you!' });
});

module.exports = app;
