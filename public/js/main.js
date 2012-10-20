"use strict";

var socket = io.connect('http://musichackathon-commits.ex.fm');


socket.on('commit', function (data) {
    console.log('Got commit!', data);
});

socket.on('new repo', function (data) {
    console.log('New repo!', data);
});