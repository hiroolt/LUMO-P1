"use strict";
var io = require('socket.io-client');
var socket = io('http://"your ip address":7060').connect();
var wpi = require('wiring-pi');
var async = require('async');

// Child Process
var cp = require('child_process');

// setup socket.io
socket.on('connection', function(socket){
    console.log('connection established');
});

//setup wiringpi
wpi.setup('gpio');
var pin = 12;
wpi.pinMode(pin, wpi.PWM_OUTPUT);

//setup writeLED function
function writeLED(before, after) {
    if((before !== 0) && (after !== 0)) {
        var val = before;
        if (before < after) {
            var diff = Math.round(100/(after - before));
            //console.log(diff);
            async.whilst(
                function() { return val  < after; },
                function(callback) {
                    val++;
                    setTimeout(function() {
                        wpi.pwmWrite(pin, val);
                        callback(null, val);
                    }, diff);
                },
                function (err) {
                    //console.log("end");
                });
        } else {
            var diff = Math.round(100/(before - after));
            //console.log(diff);
            async.whilst(
                function() { return val  > after; },
                function(callback) {
                    val--;
                    setTimeout(function() {
                        wpi.pwmWrite(pin, val);
                        callback(null, val);
                    }, diff);
                },
                function (err) {
                    //console.log("end");
                });
        };
    } else {
        wpi.pwmWrite(pin, 0);
    };
};

//setup audio Input/Output as a child process

var avconv = cp.spawn('avconv', [
    '-f', 'alsa',
    '-ac', '2',
    '-ar', '44100',
    '-i', 'hw:0,0',
    //'-t', '1',
    //'-timelimit', '3',
    '-f', 'mp3',
    'pipe:1', //Output -> STDOUT
    //'send.mp3'
]);

var mpg123 = cp.spawn('mpg123', ['-']);

//setup global variables
var sensorValue = 0;
var ledValue = 0;
var lastSensorValue = 0;
var lastLEDValue = 0;
var receivedVal = 0;
var buffersize1 = 100;
var buffersize2 = 0;
var chunk = '';
var audioBuffer = [];
var LEDbias = 1.6;

// Transmit sensor value
setInterval(function(){
    var rawSensorString = cp.execSync('sudo python ./Adafruit_Python_MCP3008/examples/simpletest.py').toString('ascii');
    var rawSensorValue = parseInt(rawSensorString);
    if (((lastSensorValue + 30) < rawSensorValue) || (rawSensorValue < (lastSensorValue - 30))){
        sensorValue = rawSensorValue;
        console.log("Original sensorValue is " + sensorValue);
	socket.emit('sense_from_channel2', sensorValue);
        lastSensorValue = sensorValue;
    }
}, 100);

// Receive sensor value from the other device/ Write LED value
socket.on('sense_to_channel2', function(rcvValue){
    receivedVal = rcvValue;
    if (receivedVal < 50){
	writeLED(lastLEDValue, 0);
	lastLEDValue = 0;
	console.log("Set sensor Value as zero")
    } else {
	ledValue = Math.round(receivedVal * LEDbias);
	writeLED(lastLEDValue, ledValue);
	lastLEDValue = ledValue;
	console.log("LED  Value is : " + ledValue);
	if ((lastSensorValue > 400) && (receivedVal > 400)){
	    console.log("Volume: 160");
	    cp.execSync("amixer $1 -Dhw:sndrpiwsp cset name='Speaker Digital Volume' 160");
	} else if ((lastSensorValue > 320) && (receivedVal > 320)){
	    console.log("Volume: 140");
	    cp.execSync("amixer $1 -Dhw:sndrpiwsp cset name='Speaker Digital Volume' 140");
	} else if ((lastSensorValue > 250) && (receivedVal > 250)){
	    console.log("Volume: 100");
	    cp.execSync("amixer $1 -Dhw:sndrpiwsp cset name='Speaker Digital Volume' 100");
	} else {
	    console.log("Volume: muted");
	    cp.execSync("amixer $1 -Dhw:sndrpiwsp cset name='Speaker Digital Volume' 0");
	};
    };
});

// Turn on speaker
socket.on('audio_to_channel2', function(audiodata){
    //console.log("VoIP receiver is on");
    audioBuffer.push([Buffer.from(audiodata.time), Buffer.from(audiodata.data, 'base64').toString('binary')]);
    // if buffer array is greater than specific value, sort it. Then write to mpg123 stdin
    if (audioBuffer.length > buffersize2) {
	audioBuffer.sort(
	    function(a,b){
		return (a[0] < b[0] ? -1 : 1);
	    }
	);
	var i = 0;
	while(i < audioBuffer.length) {
	    mpg123.stdin.write(audioBuffer[i][1], 'binary');
	    i = i + 1;
	};
	audioBuffer = [];
    };
});

// Turn on microphone

avconv.stdout.on('data', function(data) {
    var buf = new Buffer.from(data, 'binary').toString('base64');
    chunk += buf;
    if (chunk.length > buffersize1) {
	// Convert to JSON format
	var audiodata = {};
	audiodata.time = JSON.stringify(new Date());
	audiodata.data = chunk;
	chunk = '';
	socket.emit('audio_from_channel2', audiodata);
    };
});
avconv.stderr.on('data', function (data) {
    //console.log('stderr: ' + data);
});
avconv.on('exit', function (code) {
    console.log('child process exited with code ' + code);
    process.exit();
});
