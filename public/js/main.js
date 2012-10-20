"use strict";

var socket = io.connect('http://musichackathon-commits.ex.fm');

socket.on('commit', function (data) {
    console.log('Got commit!', data);
    var h = '<div class="commit row" id="commit-'+data.id+'"><div class="image span2"><img src="'+data.image+'"/></div><div class="span10"><div class="header">';
    h += data.username;
    h += '<span>&nbsp;pushed to&nbsp;</span>'+data.repoName;
    h += '</div><div class="message">'+data.message+'</div></div></div>';

    $('#commits').prepend(h);
    $('#commit-'+data.id).show('fast');
});

socket.on('new repo', function (data) {
    console.log('New repo!', data);
});