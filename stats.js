var dgram  =  require('dgram')
  , sys    =  require('sys')
  , net    =  require('net')
  , config =  require('./config')
  , schemas = require('./schemas')

var counters = {};
var timers = {};
var debugInt, flushInt, server;

config.configFile(process.argv[2], function (config, oldConfig) {
  if (! config.debug && debugInt) {
    clearInterval(debugInt); 
    debugInt = false;
  }

  if (config.debug) {
    if (debugInt !== undefined) { clearInterval(debugInt); }
    debugInt = setInterval(function () { 
      sys.log("Counters:\n" + sys.inspect(counters) + "\nTimers:\n" + sys.inspect(timers));
    }, config.debugInterval || 10000);
  }

  if (server === undefined) {
    server = dgram.createSocket('udp4', function (msg, rinfo) {
      if (config.dumpMessages) { sys.log(msg.toString()); }
      var bits = msg.toString().split(':');
      var key = bits.shift()
                    .replace(/\s+/g, '_')
                    .replace(/\//g, '-')
                    .replace(/[^a-zA-Z_\-0-9\.]/g, '');

      if (bits.length == 0) {
        bits.push("1");
      }

      for (var i = 0; i < bits.length; i++) {
        var sampleRate = 1;
        var fields = bits[i].split("|");
        if (fields[1] === undefined) {
            sys.log('Bad line: ' + fields);
            continue;
        }
        if (fields[1].trim() == "ms") {
          if (! timers[key]) {
            timers[key] = [];
          }
          timers[key].push(Number(fields[0] || 0));
        } else {
          if (fields[2] && fields[2].match(/^@([\d\.]+)/)) {
            sampleRate = Number(fields[2].match(/^@([\d\.]+)/)[1]);
          }
          if (! counters[key]) {
            counters[key] = 0;
          }
          counters[key] += Number(fields[0] || 1) * (1 / sampleRate);
        }
      }
    });

    server.bind(config.port || 8125);

    schemas.schemaFile(process.argv[3], function (schemas) {
      for (var k in schemas) {
        if (! schemas[k].pattern) { return; }
        var flushPattern = schemas[k].pattern;
        var flushInterval = Number(schemas[k].interval || 10000);

        flushInt = setInterval((function (pattern) {return function () {
          var statString = '';
          var ts = Math.round(new Date().getTime() / 1000);
          var numStats = 0;
          var key;

          for (key in counters) {
            if (! pattern.test(key)) { continue; }
            if (config.debug) {
                sys.log(key + " matches " + pattern + " --- flushing!");
            }

            var value = counters[key];
            var prefix = config.prefix===undefined ? 'stats_count.' : config.prefix;
            if ((!! prefix.length) && (prefix[prefix.length-1] != '.')) {
                prefix += '.';
            }
            var message = prefix + key + ' ' + value + ' ' + ts + "\n";
            statString += message;
            counters[key] = 0;

            numStats += 1;
          }

          for (key in timers) {
            if (! pattern.test(key)) { continue; }
            if (config.debug) {
                sys.log("timer " + key + " matches " + pattern + " --- flushing!");
            }

            if (timers[key].length > 0) {
              var pctThreshold = config.percentThreshold || 90;
              var values = timers[key].sort(function (a,b) { return a-b; });
              var count = values.length;
              var min = values[0];
              var max = values[count - 1];

              var mean = min;
              var maxAtThreshold = max;

              if (count > 1) {
                var thresholdIndex = Math.round(((100 - pctThreshold) / 100) * count);
                var numInThreshold = count - thresholdIndex;
                values = values.slice(0, numInThreshold);
                maxAtThreshold = values[numInThreshold - 1];

                // average the remaining timings
                var sum = 0;
                for (var i = 0; i < numInThreshold; i++) {
                  sum += values[i];
                }

                mean = sum / numInThreshold;
              }

              timers[key] = [];

              var message = "";
              message += prefix + 'timers.' + key + '.mean ' + mean + ' ' + ts + "\n";
              message += prefix + 'timers.' + key + '.upper ' + max + ' ' + ts + "\n";
              message += prefix + 'timers.' + key + '.upper_' + pctThreshold + ' ' + maxAtThreshold + ' ' + ts + "\n";
              message += prefix + 'timers.' + key + '.lower ' + min + ' ' + ts + "\n";
              message += prefix + 'timers.' + key + '.count ' + count + ' ' + ts + "\n";
              statString += message;

              numStats += 1;
            }
          }

          statString += 'statsd.numStats ' + numStats + ' ' + ts + "\n";
          
          try {
            var graphite = net.createConnection(config.graphitePort, config.graphiteHost);
            graphite.addListener('error', function(connectionException){
              if (config.debug) {
                sys.log(connectionException);
              }
            });
            graphite.on('connect', function() {
              this.write(statString);
              this.end();
            });
          } catch(e){
            if (config.debug) {
              sys.log(e);
            }
          }
        }}(flushPattern)), flushInterval);
      }
    });
  }
});

