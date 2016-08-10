# LUMO-P1
LUMO is a IoT device which makes our communication ridiculously easy, especially for long distance relationship couples. This product will be released in 2017, hopefully.

## Description of LUMO
LUMO mainly consists of a server and 2 client devices. Each device has IR sensor, LED strip, Microcontroller and audio system. Based on the sensor value of the other side device, it controls LED brightness and VoIP volume. For example, if you come close to the device, then the other device lits. When both of you are close to the devices, VoIP function starts.

### app.js
This file should be placed on a server. Using socket.io, it works as a mediator between 2 devices.

### main_device1/2.js
This is a main file of client devices. 
