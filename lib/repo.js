"use strict";

var gith = require('gith'),
    request = require('superagent'),
    nconf = require('nconf'),
    when = require('when'),
    sequence = require('sequence');

var Repo = module.exports = function (name, hooks){
    this.name = name;
    this.hooks = hooks;
};

Repo.prototype.hasHook = function(url){
    return this.hooks.some(function(hook){
        return hook.config.url === url;
    });
};

Repo.prototype.addHook = function(url){
    var hook = {
            'name': 'web',
            'active': true,
            'config': {
                'content_type': 'form',
                'insecure_ssl': '1',
                'url': url
            }
        },
        hookString = JSON.stringify(hook),
        d = when.defer();
    request
        .post("https://api.github.com/repos/" + this.name + "/hooks?access_token=" + nconf.get('token'))
        .send(hookString)
        .set("Content-Type", "application/x-www-form-urlencoded")
        .set("Content-Length", hookString.length)
        .end(function (res){
            console.log('Added repo?', res.ok);
            return (res.ok) ? d.resolve(res) : d.reject(res);
        });
    return d.promise;
};

Repo.prototype.ensureHook = function(url){
    var d = when.defer(),
        self = this;

    if(this.hasHook(url)){
        return d.resolve(self);
    }
    this.addHook(url).then(function(){
        return Repo.load(self.name);
    }).then(d.resolve);

    return d.promise;
};

function getWebhooks(repoName){
    var d = when.defer();
    request.get("https://api.github.com/repos/" + repoName + "/hooks?access_token=" + nconf.get('token'))
        .end(function(res){
            d.resolve(res);
        });
    return d.promise;
}

Repo.load = function(name){
    return getWebhooks(name).then(function(res){
        return new Repo(name, res.body);
    });
};