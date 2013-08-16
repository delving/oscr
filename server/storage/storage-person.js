'use strict';

module.exports = Person;

function Person(storage) {
    this.storage = storage;
}

var P = Person.prototype;

function log(message) {
//    console.log(message);
}

/*
 { isPublic: false,
 firstName: 'Gerald',
 lastName: 'de Jong',
 email: 'gerald@delving.eu',
 websites: [] }
 */

P.roles = [
    'Member', 'Administrator'
];

P.getOrCreateUser = function (profile, receiver) {
    var s = this.storage;
    var self = this;
    if (!profile.email) {
        throw new Error('No email in profile');
    }

    function addUser(userObject) {
        var userXml = s.objectToXml(userObject, 'User');
        s.add(s.userDocument(profile.email), userXml, function (error, reply) {
            if (reply.ok) {
                receiver(userXml);
            }
            else {
                throw error + "\n" + query;
            }
        });
    }

    this.getUser(profile.email, function (xml) {
        if (xml) {
            receiver(xml);
        }
        else {
            var userObject = {
                Identifier: s.generateUserId(),
                Profile: profile,
                SaveTime: new Date().getTime()
            };
            s.xquery('count(' + s.userCollection() + ')', function (error, reply) {
                var count = reply.result;
                if (count === '0') {
                    var oscrGroup = {
                        Name: 'OSCR',
                        Identifier: s.generateGroupId(),
                        SaveTime: new Date().getTime()
                    };
                    self.saveGroup(oscrGroup, function (xml) {
                        log('created group ' + xml);
                        var groupIdentifier = s.getFromXml(xml, 'Identifier');
                        userObject.Memberships = {
                            Member: {
                                Group: groupIdentifier,
                                Role: 'Administrator'
                            }
                        };
                        addUser(userObject)
                    });
                }
                else {
                    addUser(userObject);
                }
            });
        }
    });
};

P.getUser = function (email, receiver) {
    var s = this.storage;
    var query = s.userPath(email);
    s.xquery(query, function (error, reply) {
        if (reply.ok) {
            receiver(reply.result);
        }
        else {
            receiver(null);
        }
    });
};

P.getUsersInGroup = function (identifier, receiver) {
    var s = this.storage;
    var query = [
        '<Users>',
        '    { ' + s.userCollection() + '[Memberships/Member/Group = ' + s.quote(identifier) + '] }',
        '</Users>'
    ];
    s.xquery(query, function (error, reply) {
        if (reply.ok) {
            receiver(reply.result);
        }
        else {
            throw error + "\n" + query;
        }
    });
};

P.getUsers = function (search, receiver) {
    var s = this.storage;
    var query = [
        '<Users>',
        '    { ' + s.userCollection() + '[contains(lower-case(Profile/email), ' + s.quote(search) + ')] }',
        '</Users>'
    ];
    s.xquery(query, function (error, reply) {
        if (reply.ok) {
            receiver(reply.result);
        }
        else {
            throw error + "\n" + query;
        }
    });
};

P.getAllUsers = function (receiver) {
    var s = this.storage;
    var query = [
        '<Users>',
        '    { ' + s.userCollection() + ' }',
        '</Users>'
    ];
    s.xquery(query, function (error, reply) {
        if (reply.ok) {
            receiver(reply.result);
        }
        else {
            throw error + "\n" + query;
        }
    });
};

P.saveGroup = function (group, receiver) {
    var s = this.storage;
    group.SaveTime = new Date().getTime();
    var existing = group.Identifier;
    if (!existing) {
        group.Identifier = s.generateGroupId();
    }
    var groupXml = s.objectToXml(group, "Group");
    if (existing) {
        s.replace(s.groupDocument(group.Identifier), groupXml, function (error, reply) {
            if (reply.ok) {
                receiver(groupXml);
            }
            else {
                throw "Unable to replace " + s.groupDocument(group.Identifier);
            }
        });
    }
    else {
        s.add(s.groupDocument(group.Identifier), groupXml, function (error, reply) {
            if (reply.ok) {
                receiver(groupXml);
            }
            else {
                throw error + "\n" + query;
            }
        });
    }
};

P.getGroups = function (search, receiver) {
    var s = this.storage;
    var query = [
        '<Groups>',
        '    { ' + s.groupCollection() + '[contains(lower-case(Name), lower-case(' + s.quote(search) + '))] }',
        '</Groups>'
    ];
    s.xquery(query, function (error, reply) {
        if (reply.ok) {
            receiver(reply.result);
        }
        else {
            throw error + "\n" + query;
        }
    });
};

P.getAllGroups = function (receiver) {
    var s = this.storage;
    var query = [
        '<Groups>',
        '    { ' + s.groupCollection() + ' }',
        '</Groups>'
    ];
    s.xquery(query, function (error, reply) {
        if (reply.ok) {
            receiver(reply.result);
        }
        else {
            throw error + "\n" + query;
        }
    });
};

P.getGroup = function (identifier, receiver) {
    var s = this.storage;
    var query = s.groupPath(identifier);
    s.xquery(query, function (error, reply) {
        if (reply.ok) {
            receiver(reply.result);
        }
        else {
            console.error(error + "\n" + query);
        }
    });
};

P.addUserToGroup = function (email, role, identifier, receiver) {
    var s = this.storage;
    var query = [
        'let $user := ' + s.userPath(email),
        'let $mem := ' + '<Member><Group>' + identifier + '</Group><Role>' + role + '</Role></Member>',
        'return',
        'if (exists($user/Memberships/Member[Group=' + s.quote(identifier) + ']))',
        'then ()',
        'else (',
        'if (exists($user/Memberships))',
        'then (insert node $mem into $user/Memberships)',
        'else (insert node <Memberships>{$mem}</Memberships> into $user)',
        ')'
    ];
    s.xquery(query, function (error, reply) {
        if (reply.ok) {
            s.xquery(s.userPath(email), function (e, r) {
                receiver(r.result);
            });
        }
        else {
            throw error + "\n" + query;
        }
    });
};

P.removeUserFromGroup = function (email, role, identifier, receiver) {
    var s = this.storage;
    var query = 'delete node ' + s.userPath(email) + '/Memberships/Member[Group=' + s.quote(identifier) + ']';
    s.xquery(query, function (error, reply) {
        if (reply.ok) {
            s.xquery(s.userPath(email), function (e, r) {
                receiver(r.result);
            });
        }
        else {
            throw error + "\n" + query;
        }
    });
};

