'use strict'
var publishKey = 'publishKey';
var subscribeKey = 'subscribeKey';
var channel1 = "LUMO1";  // channel name for pubnub
var channel2 = "LUMO2";
var async = require('async');
var fs = require('fs');

// variables

var buffersize1 = 100;
var buffersize2 = 0;
var audioBuffer = [];
var chunk = '';

// setup child process
var cp = require('child_process');

// setup PubNub
var pubnub = require("pubnub")({
    ssl           : true,
    publish_key   : publishKey,
    subscribe_key : subscribeKey,
});

// setup audio Input/Output as a child process
var avconv = cp.spawn('avconv', [
    '-f', 'alsa',
    '-ac', '1',
    '-ar', '44100',
    '-i', 'hw:2,0',
    '-b', '32k',
    '-f', 'mp3',
    'pipe:1' //Output -> STDOUT
]);

var mpg123 = cp.spawn('mpg123', ['-']);

// Sending audio data to the other device through PubNub

avconv.stdout.on('data', function(data) {
    var buf = new Buffer.from(data, 'binary').toString('base64');
    chunk += buf;
    // if chunk size is greater than specific value, send it through pubnub
    if (chunk.length > buffersize1) {
    // if(true) {
	// Convert to JSON format
	var audiodata = {};
	audiodata.time = JSON.stringify(new Date());
	audiodata.data = chunk;
	chunk = '';
	pubnub.publish({
	    channel : channel1,
	    message: audiodata
	});
    };
});

avconv.stderr.on('data', function (data) {
    console.log('stderr: ' + data);
});

avconv.on('exit', function (code) {
    console.log('child process exited with code ' + code);
});


// Receiving audio data from the other device.
// setup audio buffer

pubnub.subscribe({
    channel : channel2,
    message : function(audiodata) {
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
    },
    disconnect : function(){
	console.log("See you");
    }
});
