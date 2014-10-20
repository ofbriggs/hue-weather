// Require the module
var Forecast = require('forecast');
// Initialize
var forecast = new Forecast({
  service: 'forecast.io',
  key: '5aac7dd9b24b5f2117a059d8a3080480',
  units: 'celcius', // Only the first letter is parsed
  cache: true,      // Cache API requests?
  ttl: {            // How long to cache requests. Uses syntax from moment.js: http://momentjs.com/docs/#/durations/creating/
    minutes: 27,
    seconds: 45
    }
});

var currentDate = new Date();
var yesterDate = new Date();
yesterDate.setDate(yesterDate.getDate() - 1);

var weatherUTCHour = 16;
var hourDiff = weatherUTCHour - currentDate.getUTCHours();
var secondsDiff = hourDiff * 3600;

var currentUnixTime = ~~(currentDate.getTime() / 1000);
var yesterUnixTime = ~~(yesterDate.getTime() / 1000);

//takes an array of callbacks, gives fn the resolved values in the same order
function all(callbackArr, fn){
    var arr = [];
    var callbackCount = callbackArr.length;
    callbackArr.forEach(function(callback, idx){
        callback.call(callback, function(value){
            arr[idx] = value;
            if (--callbackCount <= 0){
                fn(arr);
            }
        });
    });
}

function curry(fn){
    var args = [].slice.call(arguments, 1);
    return function(callback){
        fn.apply(fn, args.concat(callback));
    }
}

// x -> Cont x
function pureCallback(a) {
    return function (f) {return f(a);};
}

// Cont (a -> b) -> Cont a -> Cont b
function ap(cont1, cont2){
    var steve1, steve2, fn;
    cont1(function(fun){
        steve1 = fun;
        if (fn !== undefined & steve2 !== undefined)
            fn(steve1(steve2));
    });
    cont2(function(val){
        steve2 = val;
        if (fn !== undefined & steve1 !== undefined)
            fn(steve1(steve2));
    });
    return function(fun){
        if (steve1 !== undefined & steve2 !== undefined)
            fun(steve1(steve2));
        else
            fn = fun;
    }
}

// (a -> b) -> Cont a -> Cont b
function cmap(fn, cont){
    ap(pureCallback(fn), cont);
}

// (a -> b -> c) -> Cont a -> Cont b -> Cont c
function liftA2(fn, conta, contb){
    function badfn(a){
        return function(b){
            return fn(a,b);
        }
    }
    ap(cmap(badfn, conta), contb);
}

function getForecast(time, fn){
    forecast.get([40.766570099999996, -73.98546859999999, time], function(err, weather) {
        if(err) return console.dir(err);
        return fn(weather);
    });
}


function extractTemp(weatherObj){
    var today = weatherObj.daily.data[0];
    var min = today.apparentTemperatureMin;
    var max = today.apparentTemperatureMax;

    return (max + min) / 2;
}

function forecastDiff(time1, time2, fn){
    var lastForecast = curry(getForecast, time1);
    var nowForecast = curry(getForecast, time2);
    all([lastForecast, nowForecast], function(weatherArr){
        fn(extractTemp(weatherArr[1]) - extractTemp(weatherArr[0]));
    });
}

var hostname = "",
    username = "raspberrypi",
    api;

var hue = require("node-hue-api");
var displayBridges = function(bridge) {
    console.log("Hue Bridges Found: " + JSON.stringify(bridge));
    hostname = bridge.ipaddress;
};

// --------------------------
// Using a promise

var HueApi = hue.HueApi,
    lightState = hue.lightState;

var displayResult = function(result) {
    console.log(JSON.stringify(result, null, 2));
};

function diffLightState(tempDiff){
    var absoluteChange = Math.abs(tempDiff);
    if (absoluteChange < 3){
        state = lightState.create().on().rgb(0, 255, 0);
    }
    else if (tempDiff > 0){
        state = lightState.create().on().rgb(255, 0, 0);
    }
    else if (tempDiff > 0){
        state = lightState.create().on().rgb(0, 0, 255);
    }
    return state;
}

function offLightState(){
    return lightState.create().transition(3600).off();
}

hue.locateBridges().then(function(bridge){
    return api = new HueApi(bridge[0].ipaddress, username);
}).then(function(api){
    return api.lights();
}).then(function(lights){
    lights.lights.forEach(function(light){
        forecastDiff(yesterUnixTime, currentUnixTime, function(tempDiff){
            var state = diffLightState(tempDiff);
            var state2 = offLightState();
            api.setLightState(light.id, state);
            api.setLightState(light.id, state2);
       });
    });
});

