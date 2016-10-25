"use strict";
var io = require('socket.io-client');
var socket = io('http://******').connect();
var wpi = require('wiring-pi');
var async = require('async');
//var heapdump = require('heapdump'); 

//setup global variables
var sensorValue = 0;
var ledValue = 0;
var lastSensorValue = 0;
var lastLEDValue = 0;
var receivedValue = 0;
var SMax = 600;
var SMin = 70;
var SenseInterval = 500;
//var idx = 0;

// Child Process
var cp = require('child_process');

// setup socket.io
socket.on('connection', function(socket){
    console.log('connection established');
});

//setup wiringpi for LED control
wpi.setup('gpio');
var pin = 12;
var pin2 = 5;
wpi.pinMode(pin, wpi.PWM_OUTPUT);
wpi.softPwmCreate(pin2, 0, 100);

//setup writeLED function
function writeLED(before, after) {
    if((before !== 0) && (after !== 0)) {
        var val = before;
        if (before < after) {
            var diff = Math.round(SenseInterval/(after - before));
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
            var diff = Math.round(SenseInterval/(before - after));
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
    '-cutoff', '15k',
    //'-t', '1',
    //'-timelimit', '3',
    '-f', 'mp3',
    'pipe:1', //Output -> STDOUT
    //'send.mp3'
]);

var mpg123 = cp.spawn('mpg123', ['-']);


// get sensor value and send it to server
setInterval(function(){
//setTimeout(function(){
    var rawSensorString = cp.execSync('sudo python /home/pi/Work/LUMO/LUMO-P1/Adafruit_Python_MCP3008/examples/simpletest.py').toString('ascii');
    var rawSensorValue = parseInt(rawSensorString);
    if (((lastSensorValue + 5) < rawSensorValue) || (rawSensorValue < (lastSensorValue - 5))){
	sensorValue = Math.round((1023*rawSensorValue)/(SMax-SMin) - (1023*SMin)/(SMax-SMin));
        //console.log("Modified sensorValue is " + sensorValue);
	if (sensorValue > 1023) {
	    wpi.softPwmWrite(pin2, 100);
	} else if (sensorValue < 0) {
	    wpi.softPwmWrite(pin2, 0);
	} else {
	    var PWMval = Math.round(sensorValue*100/1024);
	    wpi.softPwmWrite(pin2, PWMval);
	}
	
	if (sensorValue > 30){  
            console.log("Mic: on, Speaker: on");                                                                                
	    avconv.kill('SIGSTOP');
	    cp.execSync("amixer $1 -Dhw:sndrpiwsp cset name='Speaker Digital Volume' 130");
        }  else {                                                                                       
            console.log("Mic: muted, Speaker: off");
	    avconv.kill('SIGCONT');	                                                     
	    cp.execSync("amixer $1 -Dhw:sndrpiwsp cset name='Speaker Digital Volume' 0");
        };
	socket.emit('sense_from_channel2', sensorValue);
        //lastSensorValue = sensorValue;
	//idx++;
    }
}, SenseInterval);


// receive sensor value from server and write it on LED
socket.on('sense_to_channel2', function(rcvValue){
    ledValue = rcvValue;
    if (ledValue > 1023) {
	writeLED(lastLEDValue, 1023);
	lastLEDValue = 1023;
	console.log("Set sensor Value as Max")
    } else if (ledValue < 0){
	writeLED(lastLEDValue, 0);
	lastLEDValue = 0;
	console.log("Set sensor Value as Min")
    } else {
	writeLED(lastLEDValue, ledValue);
	lastLEDValue = ledValue;
	console.log("LED  Value is : " + ledValue);
    };
});

//receive audio data from server and pass it to mpg123 as stdout
socket.on('audio_to_channel2', function(audiodata){
    //avconv.kill('SIGSTOP');
    var buf = Buffer.from(audiodata.data, 'base64').toString('binary');
    mpg123.stdin.write(buf, 'binary');
});

//record from mic and send it to server
avconv.stdout.on('data', function(data) {
    var buf = Buffer.from(data, 'binary').toString('base64');
    var audiodata = {};
    audiodata.data = buf;
    socket.emit('audio_from_channel2', audiodata);
});

avconv.stderr.on('data', function (data) {
    //console.log('stderr: ' + data);
});
avconv.on('exit', function (code) {
    console.log('child process exited with code ' + code);
    process.exit();
});


// control volume
setInterval(function(){
    var rawMicString = cp.execSync("/home/pi/Work/LUMO/LUMO-P1/getAudioLevel");
    var rawMicValue = parseInt(rawMicString);
    console.log("Mic Value is " + rawMicValue);
    if (rawMicValue == 0){
	console.log("Mic Volume has not changed");
    } else {
	if (rawMicValue > 40000) {
	    cp.execSync("amixer $1 -Dhw:sndrpiwsp cset name='Speaker Digital Volume' 60");
	} else {
	    if (rawMicValue > 27000) {
		cp.execSync("amixer $1 -Dhw:sndrpiwsp cset name='Speaker Digital Volume' 130");
	    } else if (rawMicValue > 24000) {
		cp.execSync("amixer $1 -Dhw:sndrpiwsp cset name='Speaker Digital Volume' 140");
	    } else if (rawMicValue > 18000) {
		cp.execSync("amixer $1 -Dhw:sndrpiwsp cset name='Speaker Digital Volume' 150");
	    } else {
		cp.execSync("amixer $1 -Dhw:sndrpiwsp cset name='Speaker Digital Volume' 160");
	    }
	}
    }
}, 300);


//check memory leak issue
/*
setInterval(function(){
    heapdump.writeSnapshot(function(err, filename) {
	console.log('dump written to', filename);
    });
}, 900000);

setInterval(function(){
    console.log("Counter of Sender: " + idx);
}, 300000);
*/
