'use strict';

/**
 * @file Manages Json Web Token authentication for our API
 * @module jwt
 */

var config = require(__dirname + '/config.js');

var _          = require('underscore');
var expressJWT = require('express-jwt');
var jwt        = require('jsonwebtoken');
var users      = require(__dirname + '/users.js');

var authorize = expressJWT({ secret: config.jwt.secret });

/**
 * Generates a JSON Web Token that should be stored on the client
 * and sent in the header with every API call required authentication.
 * @function generateJWT
 *
 * @param {Object} db - Database connection
 * @param {string} user - Username
 * @param {generateJWTCallback} callback - Callback
 */

/**
 * Returns a valid JWT token to give to user
 * @callback generateJWTCallback
 *
 * @param {Object} err - Null if success, error object if failure.
 * @param {string} token - JWT token. Error if null.
 */

function generateJWT(db, user, rememberMe, callback) {
	if(typeof callback !== 'function') return;

	if(typeof db !== 'object') {
		callback(new Error('Invalid database connection!'), null);
		return;
	}
	if(rememberMe) {
		var expiration = '30 days';
	} else {
		var expiration = '1 day';
	}

	users.getUser(db, user, function(err, isUser, userDoc) {
		if(err) {
			callback(err, null);
			return;
		}
		if(!isUser) {
			callback(new Error('User doesn\'t exist!'), null);
			return;
		}

		// Default scope
		var scopes = {
			'pleb': true
		};

		if(_.isArray(userDoc['scopes'])) {
			for(var i = 0; i < userDoc['scopes'].length; i++) {
				var scope = userDoc['scopes'][i];
				scopes[scope] = true;
			}
		}

		jwt.sign({
			user: user,
			firstName: userDoc['firstName'],
			lastName: userDoc['lastName'],
			gradYear: userDoc['gradYear'],
			grade: users.gradYearToGrade(userDoc['gradYear']),
			scopes: scopes

		}, config.jwt.secret, {
			subject: 'MyMICDS API',
			algorithm: 'HS256',
			expiresIn: expiration,
			audience: config.hostedOn,
			issuer: config.hostedOn

		}, function(err, token) {
			if(err) {
				callback(new Error('There was a problem generating a JWT!'), null);
				return;
			}

			callback(null, token);

		});
	});
}

module.exports.generateJWT = generateJWT;