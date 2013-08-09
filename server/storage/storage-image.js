'use strict';

var fs = require('fs');
var path = require('path');
var uploadDir = require('../oscr-public').uploadDir;
var _ = require('underscore');

module.exports = Image;

function Image(storage) {
    this.storage = storage;
}

var P = Image.prototype;

P.saveImage = function (digitalObject, receiver) {
    var s = this.storage;
    var imagePath = path.join(uploadDir, digitalObject.fileName);
    if (!fs.existsSync(imagePath)) {
        throw 'Cannot find image file ' + imagePath;
    }
    if (!fs.existsSync(s.imageRoot)) {
        fs.mkdirSync(s.imageRoot);
    }
    var fileName = createFileName(s, digitalObject);
    var bucketName = s.imageBucketName(fileName);
    var bucketPath = path.join(s.imageRoot, bucketName);
    if (!fs.existsSync(bucketPath)) {
        fs.mkdirSync(bucketPath);
    }
    copyFile(imagePath, path.join(bucketPath, fileName), function (err) {
        if (err) {
            throw err;
        }
        receiver(fileName);
    });
};

P.getImagePath = function (fileName) {
    var s = this.storage;
    var bucketName = s.imageBucketName(fileName);
    return s.imageRoot + '/' + bucketName + '/' + fileName;
};

P.getImageDocument = function (fileName, receiver) {
    var s = this.storage;
    var query = s.docPath(fileName);
    s.xquery(query, function (error, reply) {
        if (reply.ok) {
            receiver(reply.result);
        }
        else {
            throw error + "\n" + query;
        }
    });
};

P.listImageData = function (receiver) {
    var s = this.storage;
    var query = [
        '<Images>',
        '    { ' + s.docCollection() + '}',
        '</Images>'
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

P.listImageFiles = function (done) {
    function walk(dir, done) {
        var results = [];
        fs.readdir(dir, function (err, list) {
            if (err) {
                done(err);
            }
            else {
                var pending = list.length;
                if (!pending) {
                    done(null, results);
                }
                else {
                    list.forEach(function (file) {
                        file = dir + '/' + file;
                        fs.stat(file, function (err, stat) {
                            if (stat && stat.isDirectory()) {
                                walk(file, function (err, res) {
                                    results = results.concat(res);
                                    if (!--pending) done(null, results);
                                });
                            }
                            else {
                                results.push(file);
                                if (!--pending) done(null, results);
                            }
                        });
                    });
                }
            }
        });
    }

    walk(this.storage.imageRoot, done);
};

function copyFile(source, target, cb) {
    var cbCalled = false;

    var rd = fs.createReadStream(source);
    rd.on("error", function (err) {
        done(err);
    });
    var wr = fs.createWriteStream(target);
    wr.on("error", function (err) {
        done(err);
    });
    wr.on("close", function (ex) {
        done();
    });
    rd.pipe(wr);

    function done(err) {
        if (!cbCalled) {
            cb(err);
            cbCalled = true;
        }
    }
}

function createFileName(s, digitalObject) {
    var fileName = s.generateImageId();
    switch (digitalObject.mimeType) {
        case 'image/jpeg':
            fileName += '.jpg';
            break;
        case 'image/png':
            fileName += '.png';
            break;
        case 'image/gif':
            fileName += '.gif';
            break;
        default:
            throw "Unknown mime type: " + digitalObject.mimeType;
            break;
    }
    return fileName;
}
