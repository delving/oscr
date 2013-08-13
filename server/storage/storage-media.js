'use strict';

var fs = require('fs');
var path = require('path');
var uploadDir = require('../oscr-public').uploadDir;
var _ = require('underscore');

module.exports = Media;

function Media(storage) {
    this.storage = storage;
}

var P = Media.prototype;

P.saveMedia = function (mediaObject, receiver) {
    var s = this.storage;
    var imagePath = path.join(uploadDir, mediaObject.fileName);
    if (!fs.existsSync(imagePath)) {
        throw 'Cannot find image file ' + imagePath;
    }
    if (!fs.existsSync(s.imageRoot)) {
        fs.mkdirSync(s.imageRoot);
    }
    var fileName = createFileName(s, mediaObject);
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

P.getMediaPath = function (fileName) {
    var s = this.storage;
    var bucketName = s.imageBucketName(fileName);
    return s.imageRoot + '/' + bucketName + '/' + fileName;
};

// ============= for testing only:

P.listMediaFiles = function (done) {
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
            console.log("UNKOWN MIME" + digitalObject.mimeType);
            fileName += '.jpg';
            break;
    }
    return fileName;
}