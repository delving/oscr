'use strict';

var _ = require("underscore");
var express = require('express');
var https = require('https');
var crypto = require('crypto');
var Storage = require('./storage');
var upload = require('./upload');
var util = require('./util');

var app = express();
app.use(upload);
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.cookieSession({secret: 'oscr'}));
app.response.__proto__.xml = function (xmlString) {
    this.setHeader('Content-Type', 'text/xml');
    this.send(xmlString);
};

module.exports = app;

var homeDir = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;

Storage('oscr', homeDir, function (storage) {
    console.log('We have database ' + storage.database + ', and home directory ' + homeDir);

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

    function replyWithLanguage(lang, res) {
        storage.I18N.getLanguage(lang, function (xml) {
            res.xml(xml);
        });
    }

    app.post('/authenticate', function (req, res) {
        var username = req.body.username;
        var password = req.body.password;
        var sha = crypto.createHash('sha512');
        var hashedPassword = sha.update(new Buffer(password, 'utf-8')).digest('base64');
        var hmac = crypto.createHmac('sha1', username);
        var hash = hmac.update(hashedPassword).digest('hex');
        res.setHeader('Content-Type', 'text/xml');
        https.request(
            commonsRequest('/user/authenticate/' + hash),
            function (authResponse) {
                if (authResponse.statusCode == 200) {
                    https.request(
                        commonsRequest('/user/profile/' + username),
                        function (profileResponse) {
                            var data;
                            profileResponse.on('data', function (data) {
                                var profile = JSON.parse(data);
                                profile.username = username;
                                req.session.profile = profile;
                                storage.Person.getOrCreateUser(profile, function (xml) {
                                    req.session.Identifier = util.getFromXml(xml, 'Identifier');
                                    res.xml(xml);
                                    storage.Log.add(req, {
                                        Op: "Authenticate"
                                    });
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

    app.get('/i18n/:lang', function (req, res) {
        replyWithLanguage(req.params.lang, res);
    });

    app.post('/i18n/:lang/element', function (req, res) {
        var lang = req.params.lang;
        var key = req.body.key;
        if (key) {
            var title = req.body.title;
            if (title) storage.I18N.setElementTitle(lang, key, title, function (ok) {
                replyWithLanguage(lang, res);
                storage.Log.add(req, {
                    Op: "TranslateTitle",
                    Lang: lang,
                    Key: key,
                    Value: title
                });

            });
            if (req.body.doc) storage.I18N.setElementDoc(lang, key, req.body.doc, function (ok) {
                replyWithLanguage(lang, res);
                storage.Log.add(req, {
                    Op: "TranslateDoc",
                    Lang: lang,
                    Key: key,
                    Value: req.body.doc
                });
            });
        }
    });

    app.post('/i18n/:lang/label', function (req, res) {
        var lang = req.params.lang;
        var key = req.body.key;
        if (key) {
            var label = req.body.label;
            if (label) storage.I18N.setLabel(lang, key, label, function (ok) {
                replyWithLanguage(lang, res);
                storage.Log.add(req, {
                    Op: "TranslateLabel",
                    Lang: lang,
                    Key: key,
                    Value: label
                });
            });
        }
    });

    app.post('/i18n/:lang/save', function (req, res) {
        var lang = req.params.lang;
        storage.I18N.saveLanguage(lang, function (ok) {
            replyWithLanguage(lang, res);
        });
    });

    app.get('/statistics', function (req, res) {
        storage.getStatistics(function (xml) {
            res.xml(xml);
        });
    });

    app.get('/person/user/fetch/:identifier', function (req, res) {
        storage.Person.getUser(req.params.identifier, function (xml) {
            res.xml(xml);
        });
    });

    app.get('/person/user/select', function (req, res) {
        var search = req.param('q').toLowerCase();
        storage.Person.getUsers(search, function (xml) {
            res.xml(xml);
        });
    });

    app.get('/person/user/all', function (req, res) {
        storage.Person.getAllUsers(function (xml) {
            res.xml(xml);
        });
    });

    app.get('/person/group/fetch/:identifier', function (req, res) {
        storage.Person.getGroup(req.params.identifier, function (xml) {
            res.xml(xml);
        });
    });

    app.get('/person/group/select', function (req, res) {
        var search = req.param('q').toLowerCase();
        storage.Person.getGroups(search, function (xml) {
            res.xml(xml);
        });
    });

    app.get('/person/group/all', function (req, res) {
        storage.Person.getAllGroups(function (xml) {
            res.xml(xml);
        });
    });

    app.post('/person/group/save', function (req, res) {
        storage.Person.saveGroup(req.body, function (xml) {
            res.xml(xml);
            storage.Log.add(req, {
                Op: "SaveGroup",
                Group: req.body
            });
        });
    });

    app.get('/person/group/:identifier/users', function (req, res) {
        storage.Person.getUsersInGroup(req.params.identifier, function (xml) {
            res.xml(xml);
        });
    });

    app.post('/person/group/:identifier/add', function (req, res) {
        var userIdentifier = req.body.userIdentifier;
        var userRole = req.body.userRole;
        var groupIdentifier = req.params.identifier;
        storage.Person.addUserToGroup(userIdentifier, userRole, groupIdentifier, function (xml) {
            res.xml(xml);
            storage.Log.add(req, {
                Op: "AddUserToGroup",
                UserIdentifier: userIdentifier,
                UserRole: userRole,
                GroupIdentifier: groupIdentifier
            });

        });
    });

    app.post('/person/group/:identifier/remove', function (req, res) {
        var userIdentifier = req.body.userIdentifier;
        var userRole = req.body.userRole;
        var groupIdentifier = req.params.identifier;
        storage.Person.removeUserFromGroup(userIdentifier, userRole, groupIdentifier, function (xml) {
            res.xml(xml);
            storage.Log.add(req, {
                Op: "RemoveUserFromGroup",
                UserIdentifier: userIdentifier,
                UserRole: userRole,
                GroupIdentifier: groupIdentifier
            })
        });
    });

    app.get('/vocabulary/:vocab', function (req, res) {
        storage.Vocab.getVocabularySchema(req.params.vocab, function (xml) {
            res.xml(xml);
        });
    });

    app.get('/vocabulary/:vocab/all', function (req, res) {
        storage.Vocab.getVocabulary(req.params.vocab, function (xml) {
            res.xml(xml);
        });
    });

    app.get('/vocabulary/:vocab/select', function (req, res) {
        // todo: make sure q exists
        var search = req.param('q').toLowerCase();
        storage.Vocab.getVocabularyEntries(req.params.vocab, search, function (xml) {
            res.xml(xml);
        });
    });

    app.get('/vocabulary/:vocab/fetch/:identifier', function (req, res) {
        storage.Vocab.getVocabularyEntry(req.params.vocab, req.params.identifier, function (xml) {
            res.xml(xml);
        });
    });

    app.post('/vocabulary/:vocab/add', function (req, res) {
        var entry = req.body.Entry;
        var vocabName = req.params.vocab;
        storage.Vocab.addVocabularyEntry(vocabName, entry, function (xml) {
            res.xml(xml);
            storage.Log.add(req, {
                Op: "AddVocabularyEntry",
                Vocabulary: vocabName,
                Entry: entry
            })

        });
    });

    app.get('/document/schemaMap', function (req, res) {
        res.send(storage.Document.schemaMap);
    });

    app.get('/document/schema/:schema', function (req, res) {
        storage.Document.getDocumentSchema(req.params.schema, function (xml) {
            res.xml(xml);
        });
    });

    app.get('/document/fetch/:schema/:groupIdentifier/:identifier', function (req, res) {
        storage.Document.getDocument(req.params.schema, req.params.groupIdentifier, req.params.identifier, function (xml) {
            res.xml(xml);
        });
    });

    app.get('/document/list/documents/:schema/:groupIdentifier', function (req, res) {
        storage.Document.getAllDocuments(req.params.schema, req.params.groupIdentifier, function (xml) {
            res.xml(xml);
        });
    });

    app.get('/document/select/:schema/:groupIdentifier', function (req, res) {
        // todo: make sure q exists
        var search = req.param('q').toLowerCase();
        storage.Document.selectDocuments(req.params.schema, req.params.groupIdentifier, search, function (xml) {
            res.xml(xml);
        });
    });

    app.post('/document/save', function (req, res) {
        // kind of interesting to receive xml within json, but seems to work
        storage.Document.saveDocument(req.body, function (header) {
            res.xml(header);
            if (header) {
                storage.Log.add(req, {
                    Op: "SaveDocument",
                    Identifier: util.getFromXml(header, "Identifier"),
                    SchemaName: util.getFromXml(header, "SchemaName")
                })
            }
        });
    });

    app.get('/media/fetch/:fileName', function (req, res) {
        var fileName = req.params.fileName;
        var filePath = storage.Media.getMediaPath(fileName);
        var mimeType = storage.Media.getMimeType(fileName);
        res.setHeader('Content-Type', mimeType);
        res.sendfile(filePath);
    });

    app.get('/media/thumbnail/:fileName', function (req, res) {
        var fileName = req.params.fileName;
        var filePath = storage.Media.getThumbnailPath(fileName);
        var mimeType = storage.Media.getMimeType(fileName);
        res.setHeader('Content-Type', mimeType);
        res.sendfile(filePath);
    });

    app.get('/log', function (req, res) {
        storage.Log.getEntries(function (xml) {
            res.xml(xml);
        });
    });

    app.get('/refreshSchemas', function (req, res) {
        storage.refreshSchemas(function () {
            res.xml('<refreshed>' + new Date() + '</refreshed>');
        });
    });

    app.get('/snapshot/:fileName', function (req, res) {
        storage.snapshotCreate(function (localFile) {
            console.log("sending " + localFile);
            res.sendfile(localFile);
        });
    });

    app.get('/snapshot', function (req, res) {
        res.redirect('/snapshot/'+storage.snapshotName());
    });

});

