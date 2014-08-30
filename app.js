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

function getForecast(fn){
    forecast.get([40.766570099999996, -73.98546859999999], function(err, weather) {
        if(err) return console.dir(err);
        return fn(weather);
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


hue.locateBridges().then(function(bridge){
    return api = new HueApi(bridge[0].ipaddress, username);
}).then(function(api){
    return api.lights();
}).then(function(lights){
    lights.lights.forEach(function(light){
       getForecast(function(weather){
            var temp = weather.currently.apparentTemperature;
            var state = lightState.create().on().rgb(255 * (temp/35),0,255 * (1-(temp/35)));
            api.setLightState(light.id, state);
       });
    });
});

