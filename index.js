"use strict";

var fs = require('fs'),
    nconf = require('nconf'),
    express = require('express'),
    gith = require('gith'),
    sequence = require('sequence'),
    when = require('when'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    request = require('superagent'),
    Repo = require('./lib/repo'),
    querystring = require('querystring'),
    bouncy = require('bouncy'),
    crypto = require('crypto'),
    Buffer = require('buffer').Buffer,
    markdown = require( "markdown" ).markdown;


gith = gith.create(10000);

nconf.argv()
    .env()
    .use('memory')
    .file({ file: process.env.PWD + '/config.json' });


app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.static(__dirname + '/public'));
  app.use(express.favicon());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.cookieParser());
});

app.configure('development', function(){
  app.use(express.errorHandler());
});


function saveRecentCommits(){
    fs.writeFile("commits.json", JSON.stringify(RECENT_COMMITS), function(){
        console.log('saved commits');
    });
}

var REPOS = {},
    RECENT_COMMITS = JSON.parse(fs.readFileSync("commits.json"));


function init(cb){
    sequence().then(function(next){
        when.all(nconf.get('repos').map(function(name){
            return Repo.load(name);
        }), next);
    }).then(function(next, repos){
        when.all(repos.map(function(repo){
            return repo.ensureHook('http://musichackathon-commits.ex.fm/gith');
        }), next);
    }).then(function(next, repos){
        repos.forEach(function(repo){
            repo.gith = gith({
                repo: repo.name
            });
            REPOS[repo.name] = repo;
        });
        next(repos);
    }).then(function(next, repos){
        cb(repos);
    });
}

function addRepo(name, token, cb){
    if(REPOS.hasOwnProperty(name)){
        return cb(REPOS[name]);
    }
    fs.readFile('config.json', 'utf-8', function(err, data){
        var config = JSON.parse(data);
        config.repos.push(name);
        config.repo_tokens[name] = token;

        console.log('Config', JSON.stringify(config, null, 4));

        nconf.set('repos', config.repos);
        nconf.set('repo_tokens', config.repo_tokens);

        fs.writeFile('config.json', JSON.stringify(config, null, 4), 'utf-8', function(){
            Repo.load(name).then(function(repo){
                REPOS[name] = repo;
                cb(repo);
            });
        });
    });
}

function onPayload(repo, payload){
    var simple = simplifyPayload(payload);
    RECENT_COMMITS.push(simple);
    Object.keys(sockets).forEach(function(id){
        sockets[id].emit('commit', simple);
    });
    saveRecentCommits();
}

init(function(repos){
    repos.forEach(function(repo){
        repo.gith.on('all', function(payload){
            console.log('got payload', JSON.stringify(payload, null, 4));
            onPayload(repo, payload);
        });
    });
});

app.get('/repos', function(req, res){
    res.render('list-repos', {
        'repos': Object.keys(REPOS)
    });
});

app.get('/', function(req, res){
    res.render('index', {
        'repos': Object.keys(REPOS),
        'recentCommits': RECENT_COMMITS.slice(0).reverse()
    });
});

app.get('/add-repo', function(req, res){
    if(!req.param('token')){
        return redirectToGithub(res);
    }
    res.render('add-repo', {'token': req.param('token')});
});

app.post('/add-repo', function(req, res){
    addRepo(req.param('repo'), req.param('token'), function(repo){
        res.redirect("/");
    });
});

app.get('/oauth', function(req, res){
    exchangeGithubToken(req, function(token){
        res.redirect('/add-repo?token=' + token);
    });
});

app.get('/repo/:user/:name', function(req, res){
    var name = req.param('user') + "/" + req.param('name'),
        contribs,
        readme;

    if(REPOS[name]){
        getRepoContibutors(name).then(function(c){
            contribs = c;
            getReadme(name).then(function(c){
                readme = markdown.toHTML(new Buffer(c, 'base64').toString('utf-8'));
                res.render('repo',
                    {
                        'repo': REPOS[name],
                        'contribs': contribs,
                        'readme': readme
                    }
                );
            });
        });
    }
    else{
        return res.send(404);
    }
});

function redirectToGithub(res){
    var url = "https://github.com/login/oauth/authorize?client_id=" + nconf.get('client_id') + "&scope=public_repo";
    res.redirect(url);
}

function exchangeGithubToken(req, cb){
    request.post("https://github.com/login/oauth/access_token").send({
        'client_id': nconf.get('client_id'),
        'client_secret': nconf.get('client_secret'),
        'code': req.param('code')
    })
    .set("Accept", "application/json")
    .end(function(res){
        cb(res.body.access_token);
    });
}

function getRepoContibutors(name){
    var d = when.defer();
    request
        .get('https://api.github.com/repos/'+name+'/contributors')
        .set("Accept", "application/json")
        .end(function(res){
            d.resolve(res.body);
        });
    return d.promise;
}

function getReadme(name){
    var d = when.defer();
    request
        .get('https://api.github.com/repos/'+name+'/readme')
        .set("Accept", "application/json")
        .end(function(res){
            d.resolve(res.body.content);
        });
    return d.promise;
}

function simplifyPayload(payload){
    var image = "https://secure.gravatar.com/avatar/"+crypto.createHash('md5').update(payload.original.head_commit.author.email).digest("hex")+"?s=160";
    return {
        'username': payload.original.pusher.name,
        'repoName': payload.original.repository.owner.name + "/" +payload.original.repository.name,
        'message':  payload.original.head_commit.message,
        'url': payload.original.head_commit.url,
        'timestamp': new Date(payload.original.head_commit.timestamp),
        'id': payload.original.head_commit.id,
        'image': image
    };
}

var sockets = {};
io.sockets.on('connection', function(socket){
    sockets[socket.id] = socket;
    socket.on('disconnect', function(){
        delete sockets[socket.id];
    });
});

server.listen(12000);