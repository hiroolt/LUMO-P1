var publishKey = 'publishKey';
var subscribeKey = 'subscribeKey';
var channel1 = "LUMO1";  // use same channel name
var channel2 = "LUMO2";
var McpAdc = require('mcp-adc');
var adc = new McpAdc.Mcp3008();
var wpi = require('wiring-pi');
var async = require('async');


// execute shell command
var cp = require('child_process');

// setup PubNub
var pubnub = require("pubnub")({
    ssl           : true,
    publish_key   : publishKey,
    subscribe_key : subscribeKey,
});

//setup wiringpi
wpi.setup('gpio');
var pin = 19;
wpi.pinMode(pin, wpi.PWM_OUTPUT);

// register publish & subscribe
setInterval(function(){
    adc.readRawValue(0, function(value){
	sensorValue = value;
	pubnub.publish({
	    channel : channel1,
	    message : sensorValue,
	});
    });
}, 1000);

pubnub.subscribe({
    channel : channel2,
    message : function(m){
	console.log(m);
	async.series([
	    function (cb) {
		wpi.pwmWrite(pin, m);
		cb();
	    }]);
    },
    disconnect : function(){
	console.log("See you");
    }
});
