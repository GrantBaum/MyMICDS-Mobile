'use strict';

/**
 * @file Manages regularly scheduled tasks (similar to Cron-Jobs)
 */

try {
	const config = require(__dirname + '/libs/config.js');
} catch(e) {
	throw new Error('***PLEASE CREATE A CONFIG.JS ON YOUR LOCAL SYSTEM. REFER TO LIBS/CONFIG.EXAMPLE.JS***');
}

const admins = require(__dirname + '/libs/admins.js');
const dailyBulletin = require(__dirname + '/libs/dailyBulletin.js');
const later = require('later');
const MongoClient = require('mongodb').MongoClient;
const weather = require(__dirname + '/libs/weather.js');

// Only run these intervals in production so we don't waste our API calls
if(config.production) {

	console.log('Starting tasks server!');

	MongoClient.connect(config.mongodb.uri, (err, db) => {
		if(err) throw err;

		const fiveMinuteInterval = later.parse.text('every 5 min');

		/*
		 * Get Daily Bulletin every 5 minutes
		 */

		const updateBulletin = later.setInterval(() => {
			console.log('[' + new Date() + '] Check for latest Daily Bulletin');

			dailyBulletin.queryLatest(err => {
				if (err) {
					console.log('[' + new Date() + '] Error occured for Daily Bulletin! (' + err + ')');

					// Alert admins if there's an error querying the Daily Bulletin
					admins.sendEmail(db, {
						subject: 'Error Notification - Daily Bulletin Retrieval',
						html: 'There was an error when retrieving the daily bulletin.<br>Error message: ' + err
					}, err => {
						if (err) {
							console.log('[' + new Date() + '] Error occured when sending admin error notifications! (' + err + ')');
							return;
						}
						console.log('[' + new Date() + '] Alerted admins of error! (' + err + ')');
					});
				} else {
					console.log('[' + new Date() + '] Successfully got latest Daily Bulletin!');
				}
			});

		}, fiveMinuteInterval);

		/*
		 * Get new weather info every 5 minutes
		 */

		const updateWeather = later.setInterval(() => {
			console.log('[' + new Date() + '] Update Weather');

			weather.update((err, weatherJSON) => {
				if (err) {
					console.log('[' + new Date() + '] Error occured for weather! (' + err + ')');

					// Alert admins if problem getting weather
					admins.sendEmail(db, {
						subject: 'Error Notification - Weather Retrieval',
						html: 'There was an error when retrieving the weather.<br>Error message: ' + err
					}, err => {
						if (err) {
							console.log('[' + new Date() + '] Error occured when sending admin error notifications! (' + err + ')');
							return;
						}
						console.log('[' + new Date() + '] Alerted admins of error! (' + err + ')');
					});
				} else {
					console.log('[' + new Date() + '] Successfully updated weather!');
				}
			});

		}, fiveMinuteInterval);
	});
} else {
	console.log('Not starting tasks server because we are not on production.');
}
