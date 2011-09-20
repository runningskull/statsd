var fs  = require('fs')
,   sys = require('sys');

var Schemanator = function (file) {
    var self = this;
    var schemas = {};

    this.updateSchemas = function () {
        sys.log('reading schemas file: ' + file);

        fs.readFile(file, function (err, data) {
            if (err) { throw err; }

            self.schemas = require('vm').runInThisContext('schemas = ' + data, file);
            self.emit('schemasChanged', self.schemas);
        });
    };

    this.updateSchemas();

    fs.watchFile(file, function (curr, prev) {
        if (curr.ino != prev.ino) { self.updateSchemas(); }
    });
};

sys.inherits(Schemanator, process.EventEmitter);

exports.Schemanator = Schemanator;

exports.schemaFile = function(file, callbackFunc) {
    var schemas = new Schemanator(file);
    schemas.on('schemasChanged', function() {
        callbackFunc(schemas.schemas);
    });
};


