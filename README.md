# Description of LUMO
LUMO mainly consists of a server and 2 client devices. Each device has IR sensor, LED strip, Microcontroller and Audio system. Based on the sensor value of one client device, the LED brightness and VoIP function of the other client device is controlled. For example, proximity to one device lights up the other device.

## app.js
This file should be placed on a server. Using socket.io, it works as a mediator between 2 devices.

## main_device1/2.js
This is a main file of each client device. 
