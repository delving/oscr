'use strict';

var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var basex = require('basex');//basex.debug_mode = true;
var im = require('imagemagick');
var defer = require('node-promise').defer;

var Person = require('./storage-person');
var I18N = require('./storage-i18n');
var Vocab = require('./storage-vocab');
var Document = require('./storage-document');
var Media = require('./storage-media');
var Log = require('./storage-log');
var Directories = require('../directories');

function log(message) {
//    console.log(message);
}

function Storage(home) {
    this.session = new basex.Session();
    this.directories = new Directories(home);
    this.Person = new Person(this);
    this.I18N = new I18N(this);
    this.Vocab = new Vocab(this);
    this.Document = new Document(this);
    this.Media = new Media(this);
    this.Log = new Log(this);

    this.userDocument = function (identifier) {
        return "/people/users/" + identifier + ".xml";
    };

    this.userPath = function (identifier) {
        return "doc('" + this.database + this.userDocument(identifier) + "')/User";
    };

    this.userCollection = function () {
        return "collection('" + this.database + "/people/users')/User";
    };

    this.groupDocument = function (identifier) {
        return "/people/groups/" + identifier + ".xml";
    };

    this.groupPath = function (identifier) {
        return "doc('" + this.database + this.groupDocument(identifier) + "')/Group";
    };

    this.groupCollection = function () {
        return "collection('" + this.database + "/people/groups')/Group";
    };

    this.langDocument = function (language) {
        return "/i18n/" + language + ".xml";
    };

    this.langPath = function (language) {
        return "doc('" + this.database + this.langDocument(language) + "')/Language";
    };

    this.schemaPath = function () {
        return "doc('" + this.database + "/Schemas.xml')/Schemas";
    };

    this.vocabDocument = function (vocabName) {
        return "/vocabulary/" + vocabName + ".xml";
    };

    this.vocabPath = function (vocabName) {
        return "doc('" + this.database + this.vocabDocument(vocabName) + "')";
    };

    this.vocabExists = function (vocabName) {
        return "db:exists('" + this.database + "','" + this.vocabDocument(vocabName) + "')";
    };

    this.vocabAdd = function (vocabName, xml) {
        return "db:add('" + this.database + "', " + xml + ",'" + this.vocabDocument(vocabName) + "')";
    };

    this.docDocument = function (schemaName, identifier) {
        if (!schemaName) throw new Error("No schema name!");
        if (!identifier) throw new Error("No identifier!");
        return "/documents/" + schemaName + "/" + identifier + ".xml";
    };

    this.docPath = function (schemaName, identifier) {
        return "doc('" + this.database + this.docDocument(schemaName, identifier) + "')/Document";
    };

    this.docCollection = function (schemaName) {
        return "collection('" + this.database + "/documents/" + schemaName + "')";
    };

    this.logDocument = function () {
        var now = new Date();
        return "/log/" + now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate() + ".xml";
    };

    this.logPath = function () {
        return "doc('" + this.database + this.logDocument() + "')";
    };

    function wrapQuery(query) {
        if (_.isArray(query)) {
            query = query.join('\n');
        }
        log(query);
        return '<xquery><![CDATA[\n' + query + '\n]]></xquery>';
    }

    function reportError(message, error, query) {
        if (message) {
            console.error(message);
            console.error(error);
            console.error(query);
        }
    }

    this.query = function (message, query, receiver) {
        query = wrapQuery(query);
        this.session.execute(query, function (error, reply) {
            if (reply.ok) {
                log(message);
                receiver(reply.result);
            }
            else {
                reportError(message, error, query);
                receiver(null);
            }
        });
    };

    this.update = function (message, query, receiver) {
        query = wrapQuery(query);
        this.session.execute(query, function (error, reply) {
            if (reply.ok) {
                log(message);
                receiver(true);
            }
            else {
                reportError(message, error, query);
                receiver(false);
            }
        });
    };

    this.add = function (message, path, content, receiver) {
        this.session.add(path, content, function (error, reply) {
            if (reply.ok) {
                log('add ' + path + ': ' + content);
                receiver(content);
            }
            else {
                reportError(message, error, path + ': ' + content);
                receiver(null);
            }
        });
    };

    this.replace = function (message, path, content, receiver) {
        this.session.replace(path, content, function (error, reply) {
            if (reply.ok) {
                log('replace ' + path + ': ' + content);
                receiver(content);
            }
            else {
                reportError(message, error);
                receiver(null);
            }
        });
    };

    this.getStatistics = function (receiver) {
        this.query('get global statistics',
            [
                '<Statistics>',
                '  <People>',
                '    <Person>{ count(' + this.userCollection() + ') }</Person>',
                '    <Group>{ count(' + this.groupCollection() + ') }</Group>',
                '  </People>',
                '  <Documents>',
                '    <Schema>',
                '       <Name>Photo</Name>',
                '       <Count>{ count(' + this.docCollection('Photo') + ') }</Count>',
                '    </Schema>',
                '    <Schema>',
                '       <Name>InMemoriam</Name>',
                '       <Count>{ count(' + this.docCollection('InMemoriam') + ') }</Count>',
                '    </Schema>',
                '    <Schema>',
                '       <Name>Video</Name>',
                '       <Count>{ count(' + this.docCollection('Video') + ') }</Count>',
                '    </Schema>',
                '    <Schema>',
                '       <Name>Book</Name>',
                '       <Count>{ count(' + this.docCollection('Book') + ') }</Count>',
                '    </Schema>',
                '    <Schema>',
                '      <Name>MediaMetadata</Name>',
                '       <Count>{ count(' + this.docCollection('MediaMetadata') + ') }</Count>',
                '    </Schema>',
                '  </Documents>',
                '</Statistics>'
            ],
            receiver
        );
    };

    this.refreshSchemas = function (receiver) {
        var session = this.session;

        function replaceXML(fileName, next) {
            var contents = fs.readFileSync('test/data/' + fileName, 'utf8');
            session.replace('/' + fileName, contents, function (error, reply) {
                if (reply.ok) {
                    console.log("Reloaded: " + fileName);
                }
                else {
                    console.error('Unable to refresh schemas');
                    console.error(error);
                }
                if (next) next();
            });
        }

        replaceXML("Schemas.xml", receiver);
    }
}

function open(databaseName, homeDir, receiver) {
    var xmlDir = path.join('test', 'data', 'xml');
    var storage = new Storage(homeDir);
    storage.session.execute('open ' + databaseName, function (error, reply) {
        storage.database = databaseName;

        function loadPromise(filePath, docPath) {
            var deferred = defer();

            fs.readFile(filePath, 'utf8', function (err, contents) {
                if (err) console.error(err);
                storage.replace(null, docPath, contents, function (results) {
                    console.log('replaced ' + filePath);
                    deferred.resolve(results);
                });
            });
            return deferred.promise;
        }

        function loadData() {
            log('loading data from '+xmlDir);
            var promise = null;
            _.each(fs.readdirSync(xmlDir), function (file) {
                if (file[0] != '.') {
                    var fsPath = path.join(xmlDir, file);
                    var dbPath = '/' + file;
                    if (fs.statSync(fsPath).isDirectory()) {
                        log('load directory ' + fsPath);
                        var files = fs.readdirSync(fsPath);
                        _.each(files, function (file) {
                            if (file[0] != '.') {
                                var filePath = path.join(fsPath, file);
                                if (fs.statSync(filePath).isFile()) {
                                    if (promise) {
                                        promise = promise.then(
                                            function () {
                                                return loadPromise(filePath, dbPath + '/' + file);
                                            }
                                        );
                                    }
                                    else {
                                        promise = loadPromise(filePath, dbPath + '/' + file);
                                    }
                                }
                                else {
                                    log("Expected file: " + filePath);
                                }
                            }
                        });
                    }
                    else {
                        log("Load file: " + fsPath);
                        promise = loadPromise(fsPath, dbPath);
                    }
                }
            });

            if (promise) {
                promise.then(
                    function () {
                        receiver(storage);
                    },
                    function (error) {
                        console.error("final problem! " + error);
                    }
                );
            }

        }

        if (reply.ok) {
            loadData();
            receiver(storage);
        }
        else {
            storage.session.execute('create db ' + databaseName, function (error, reply) {
                if (reply.ok) {
                    loadData();
                }
                else {
                    console.error('Unable to create database ' + databaseName);
                    console.error(error);
                    receiver(null);
                }
            });
        }
    });
}

module.exports = open;
