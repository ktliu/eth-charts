var _ = require('lodash');
var logger = require('logger');
var chalk = require('chalk');
var http = require('http');

// Similar to NetStats - init WS SECRET
var WS_SECRET;

if( !_.isUndefined(process.env.WS_SECRET) && !_.isNull(process.env.WS_SECRET) )
{
	if( process.env.WS_SECRET.indexOf('|') > 0 )
	{
		WS_SECRET = process.env.WS_SECRET.split('|');
	}
	else
	{
		WS_SECRET = [process.env.WS_SECRET];
	}
}
else
{
	try {
		var tmp_secret_json = require('./ws_secret.json');
		WS_SECRET = _.values(tmp_secret_json);
	}
	catch (e)
	{
		console.error("WS_SECRET NOT SET!!!");
	}
}

var banned = [];

// Init http server
if( process.env.NODE_ENV !== 'production' )
{
	var app = require('./express');
	server = http.createServer(app);
}
else
	server = http.createServer();

// Init socket vars
var Primus = require('primus');
var api;
var client;
var server;


// Init API Socket connection
api = new Primus(server, {
	transformer: 'websockets',
	pathname: '/api',
	parser: 'JSON'
});

api.plugin('emit', require('primus-emit'));
api.plugin('spark-latency', require('primus-spark-latency'));

// Init Client Socket connection
client = new Primus(server, {
	transformer: 'websockets',
	pathname: '/primus',
	parser: 'JSON'
});

client.plugin('emit', require('primus-emit'));

// Init API Socket events
api.on('connection', function (spark)
{
	console.info('API', 'CON', 'Open:', spark.address.ip);
	console.log('connection!')

	spark.on('hello', function (data)
	{
		console.info('API', 'CON', 'Hello', data['id']);

		if( _.isUndefined(data.secret) || WS_SECRET.indexOf(data.secret) === -1 || banned.indexOf(spark.address.ip) >= 0 )
		{
			spark.end(undefined, { reconnect: false });
			console.error('API', 'CON', 'Closed - wrong auth', data);

			return false;
		}

		if( !_.isUndefined(data.id) && !_.isUndefined(data.info) )
		{
			data.ip = spark.address.ip;
			data.spark = spark.id;
			data.latency = spark.latency || 0;

			spark.emit('ready');
		}
	});
 
	spark.on('casper', function (data)
	{
		if( !_.isUndefined(data.id) && !_.isUndefined(data.casper) )
		{

			client.write({
				action: 'casper',
				data: data
			});

		}
		else
		{
			console.error('API', 'CPR', 'Casper websocket error:', data);
		}
	});
 
	spark.on('pending', function (data)
	{
		if( !_.isUndefined(data.id) && !_.isUndefined(data.stats) )
		{
			//Pending
		}
		else
		{
			console.error('API', 'TXS', 'Pending error:', data);
		}
	});

	spark.on('stats', function (data)
	{
		if( !_.isUndefined(data.id) && !_.isUndefined(data.stats) )
		{
			client.write({
				action: 'stats',
				data: data.stats
			});

		}
		else
		{
			console.error('API', 'STA', 'Stats error:', data);
		}
	});

	spark.on('block', function (data)
	{
		if( !_.isUndefined(data.id) && !_.isUndefined(data.block) )
		{

			client.write({
				action: 'block',
				data: data.block
			});

		}
		else
		{
			console.error('API', 'BLK', 'Block error:', data);
		}
	});


	spark.on('node-ping', function (data)
	{
		var start = (!_.isUndefined(data) && !_.isUndefined(data.clientTime) ? data.clientTime : null);

		spark.emit('node-pong', {
			clientTime: start,
			serverTime: _.now()
		});

		console.info('API', 'PIN', 'Ping from:', data['id']);
	});

	spark.on('end', function (data)
	{
		 // end the connection
	});
});



client.on('connection', function (clientSpark)
{
	clientSpark.on('ready', function (data)
	{
		clientSpark.emit('init', { nodes: 'hi' });
	});

	clientSpark.on('client-pong', function (data)
	{
		var serverTime = _.get(data, "serverTime", 0);
		var latency = Math.ceil( (_.now() - serverTime) / 2 );

		clientSpark.emit('client-latency', { latency: latency });
	});
});

var latencyTimeout = setInterval( function ()
{
	client.write({
		action: 'client-ping',
		data: {
			serverTime: _.now()
		}
	});
}, 5000);

server.listen(process.env.PORT || 3000);

module.exports = server;