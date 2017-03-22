'use strict';

/**
 * @file Manages stats API endpoints
 */

var stats = require(__dirname + "/../libs/stats.js");

module.exports = (app, db) => {

	app.post('/stats/get', (req, res) => {
		stats.get(db, (err, statsObj) => {
			if(err) {
				var errorMessage = err.message;
			} else {
				var errorMessage = null;
			}

			res.json({ error: errorMessage, stats: statsObj });
		});
	});

};