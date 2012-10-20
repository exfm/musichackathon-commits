"use strict";

var socket = io.connect('http://musichackathon-commits.ex.fm');


socket.on('commit', function (data) {
    console.log('Got commit!', data);

    var h = '<div class="commit" id="commit-'+data.id+'" style="display: none;"><div class="header">';
    h += '<a href="https://github.com/'+data.username+'">'+data.username+'</a>';
    h += '<span>pushed to</span><a href="/repo/'+data.repoName+'">'+data.repoName+'</a>';
    h =+ '</div><div class="message">'+data.message+'</div></div>';

    $('#commits').prepend(h);
    $('commit-'+data.id).show('fast');
});

socket.on('new repo', function (data) {
    console.log('New repo!', data);
});