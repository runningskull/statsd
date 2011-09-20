// This file defines how often to flush different stats.
// It's analagous to Graphite's storage-schemas.conf
//
// This example is modeled after this storage-schemas.conf:
//
// [etsy-style]
// pattern = ^stats\..*
// priority=110
// retentions = 10s:6h,60s:7d,10m:5y
// 
// [alternate]
// pattern = ^altstats\..*
// retentions = 1m:3d,1h:30d,1d:3y


(function() {

var s = 1000
,   m = s * 60
,   h = m * 60
,   d = h * 24
,   y = d * 365   

// Stat names will be tested against these *without*
// config.prefix prepended to them
return {
    "etsy-style": {
         pattern:  /^stats\..*/
        ,interval: 10*s
    }

    ,"alternate": {
         pattern:  /^atlstats\..*/
        ,interval: 1*m
    }
}

})();

