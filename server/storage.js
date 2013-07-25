'use strict';

var fs = require('fs');
var basex = require('basex');
//basex.debug_mode = true;

var storage = {
    database: 'oscrtest',
    session: new basex.Session()
};

function langDocument(language) {
    return "/i18n/" + language;
}

function langPath(language) {
    return "doc('" + storage.database + langDocument(language) + "')/Language";
}

function quote(value) {
    return "'" + value.replace(/'/g, "\'\'") + "'";
}

function inXml(value) {
    return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

storage.useDatabase = function (name, receiver) {
    storage.database = name;
    storage.session.execute('open ' + name, function (error, reply) {
        if (reply.ok) {
            console.log(reply.info);
            receiver(name);
        }
        else {
            console.log('could not open database ' + name);
            storage.session.execute('create db ' + name, function (error, reply) {
                if (reply.ok) {
                    console.log(reply.info);
                    var contents = fs.readFileSync('test/data/VocabularySchemas.xml', 'utf8');
                    storage.session.add('/VocabularySchemas', contents, function (error, reply) {
                        if (reply.ok) {
                            console.log("Preloaded VocabularySchemas.xml");
                        }
                        else {
                            throw error;
                        }
                    });
                    receiver(name);
                }
                else {
                    throw error;
                }
            });
        }
    });
};

storage.getLanguage = function (language, receiver) {
    var self = this;
    var query = self.session.query(langPath(language));
    query.results(function (error, reply) {
        if (reply.ok) {
            receiver(reply.result);
        }
        else {
            var initialXML = '<Language>\n  <label/>\n  <element/>\n</Language>';
            self.session.add(
                langDocument(language),
                initialXML,
                function (error, reply) {
                    if (reply.ok) {
                        receiver(initialXML);
                    }
                    else {
                        throw 'Unable to add initial XML for language ' + language;
                    }
                }
            );
        }
    });
};

storage.setLabel = function (language, key, value, receiver) {
    var labelPath = langPath(language) + "/label";
    var keyPath = labelPath + '/' + key;
    var query = "xquery " +
        "if (exists(" + keyPath + "))" +
        " then " +
        "replace value of node " + keyPath + " with " + quote(value) +
        " else " +
        "insert node <" + key + ">" + inXml(value) + "</" + key + "> into " + labelPath + " ";
    storage.session.execute(query, function (error, reply) {
        if (error) throw error+ "\n" + query;
        receiver(reply.ok);
    });
};

storage.setElementTitle = function (language, key, value, receiver) {
    var elementPath = langPath(language) + "/element";
    var keyPath = elementPath + '/' + key;
    var titlePath = keyPath + '/title';
    var query = "xquery " +
        "if (exists(" + keyPath + "))" +
        " then " +
        "replace value of node " + titlePath + " with " + quote(value) +
        " else " +
        "insert node <" + key + "><title>" + inXml(value) + "</title><doc>?</doc></" + key + "> into " + elementPath + " ";
    storage.session.execute(query, function (error, reply) {
        if (error) throw error+ "\n" + query;
        receiver(reply.ok);
    });
};

storage.setElementDoc = function (language, key, value, receiver) {
    var elementPath = langPath(language) + "/element";
    var keyPath = elementPath + '/' + key;
    var docPath = keyPath + '/doc';
    var query = "xquery " +
        "if (exists(" + keyPath + "))" +
        " then " +
        "replace value of node " + docPath + " with " + quote(value) +
        " else " +
        "insert node <" + key + "><title>?</title><doc>" + inXml(value) + "</doc></" + key + "> into " + elementPath + " ";
    storage.session.execute(query, function (error, reply) {
        if (error) throw error+ "\n" + query;
        receiver(reply.ok);
    });
};

function vocabPath(vocabName) {
    return "doc('" + storage.database + "/VocabularySchemas')/VocabularySchemas/" + vocabName;
}

storage.getVocabularySchema = function (vocabName, receiver) {
    var self = this;
    var query = self.session.query(vocabPath(vocabName));
    query.results(function (error, reply) {
        if (reply.ok) {
            receiver(reply.result);
        }
        else {
            throw 'No vocabulary found with name ' + vocabName;
        }
    });
};

module.exports = storage;