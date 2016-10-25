var app = require('http').createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');

app.listen(7060);

function handler (req, res) {
    fs.readFile(__dirname + '/index.html',
		function (err, data) {
		    if (err) {
			res.writeHead(500);
			return res.end('Error loading index.html');
		    }

		    res.writeHead(200);
		    res.end(data);
		});
}

io.on('connection', function (socket) {
    io.emit('this', { will: 'be received by everyone'});

    socket.on('sense_from_channel1', function (msg) {
	console.log('Data from channel1');
	io.volatile.emit('sense_to_channel2', msg)
    });

    socket.on('sense_from_channel2', function (msg) {
	console.log('Data from channel2');
	io.volatile.emit('sense_to_channel1', msg)
    });

    socket.on('audio_from_channel1', function (msg) {
	//console.log('Data from channel1');
	io.volatile.emit('audio_to_channel2', msg)
    });
/*
    socket.on('audio_from_channel2', function (msg) {
	//console.log('Data from channel2');
	io.volatile.emit('audio_to_channel1', msg)
    });
*/    
    socket.on('disconnect', function () {
	io.emit('user disconnected');
    });
});
