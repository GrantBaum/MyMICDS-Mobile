'use strict';

/**
 * @file Background management functions
 * @module backgrounds
 */
const config = require(__dirname + '/config.js');

const _ = require('underscore');
const fs = require('fs-extra');
const Jimp = require('jimp');
const multer = require('multer');
const path = require('path');
const utils = require(__dirname + '/utils.js');

const { promisify } = require('util');

// Valid MIME Types for image backgrounds
const validMimeTypes = {
	'image/png': 'png',
	'image/jpeg': 'jpg'
};
// These are only for finding what kind of image the user has saved.
// This DOES NOT check whether an uploaded image is valid! Configure that via MIME Types!
const validExtensions = [
	'.png',
	'.jpg'
];

// Where public accesses backgrounds
const userBackgroundUrl = config.hostedOn + '/user-backgrounds';
// Where to store user backgrounds
const userBackgroundsDir = __dirname + '/../public/user-backgrounds';
// Default user background
const defaultBackgroundUser = 'default';
const defaultExtension = '.jpg';

const defaultVariants = {
	normal: userBackgroundUrl + '/' + defaultBackgroundUser + '/normal' + defaultExtension,
	blur: userBackgroundUrl + '/' + defaultBackgroundUser + '/blur' + defaultExtension
};

// How many pixels to apply gaussian blur radius by default
const defaultBlurRadius = 10;

/**
 * Returns a function to upload a user background. Can be used as Express middleware, or by itself.
 * @function uploadBackground
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {function}
 */

function uploadBackground() {

	const storage = multer.diskStorage({
		destination: (req, file, cb) => {
			// Delete current background
			deleteBackground(req.apiUser, err => {
				if (err) {
					cb(err, null);
					return;
				}

				// Make sure directory is created for user backgrounds
				const userDir = userBackgroundsDir + '/' + req.apiUser + '-' + Date.now();
				fs.ensureDir(userDir, err => {
					if (err) {
						cb(new Error('There was a problem ensuring the image directory!'), null);
						return;
					}
					cb(null, userDir);
				});
			});
		},

		filename: (req, file, cb) => {
			// Get valid extension
			const extension = validMimeTypes[file.mimetype];
			// Set base file name to username
			const filename = 'normal.' + extension;

			cb(null, filename);
		}
	});

	const upload = multer({
		storage,
		fileFilter: (req, file, cb) => {
			if (!req.apiUser) {
				cb(new Error('You must be logged in!'), null);
				return;
			}
			const extension = validMimeTypes[file.mimetype];
			if (typeof extension !== 'string') {
				cb(new Error('Invalid file type!'), null);
				return;
			}

			cb(null, true);
		}
	});

	return upload.single('background');
}

/**
 * Gets the extension of the user's background
 * @function getCurrentFiles
 *
 * @param {string} user - Username
 * @param {getCurrentFilesCallback} callback - Callback
 */

/**
 * Returns a string containing extension
 * @callback getCurrentFilesCallback
 *
 * @param {Object} err - Null if success, error object if failure.
 * @param {string} dirname - Name of directory containing background. Null if error or user doesn't have background.
 * @param {string} extension - String containing extension of user background. Contains the dot (.) at the beginning of the extension. Null if error or user doesn't have background.
 */

async function getCurrentFiles(user) {
	if (typeof user !== 'string' || !utils.validFilename(user)) throw new Error('Invalid username!');

	let userDirs;
	try {
		userDirs = await promisify(fs.readdir)(userBackgroundsDir);
	} catch (e) {
		throw new Error('There was a problem reading the user backgrounds directory!');
	}

	// Look through all the directories
	let userDir = null;
	for (const _dir of userDirs) {
		const dir = path.parse(_dir);
		const dirname = dir.name;
		const dirnameSplit = dirname.split('-');

		// Check directory isn't deleted
		if (dirnameSplit[0] === 'deleted') {
			continue;
		}

		// Get rid of timestamp and get name
		dirnameSplit.pop();

		// Directory owner's username (which may have dashes in it)
		const directoryOwner = dirnameSplit.join('-');

		// Check if background belongs to user
		if (directoryOwner === user) {
			userDir = dirname;
			break;
		}
	}

	// User doesn't have any background
	if (userDir === null) return { dirname: null, extension: null };

	const extension = await getDirExtension(userDir);

	return { dirname: userDir, extension };
}

/**
 * Deletes all images of user
 * @function deleteBackground
 *
 * @param {string} user - Username
 * @param {deleteBackgroundCallback} callback - Callback
 */

/**
 * Returns an error if any
 * @callback deleteBackgroundCallback
 *
 * @param {Object} err - Null if success, error object if failure.
 */

async function deleteBackground(user) {
	if (typeof user !== 'string' || !utils.validFilename(user)) throw new Error('Invalid username!');

	// Find out user's current directory
	const { dirname, extension } = await getCurrentFiles(user);

	// Check if no existing background
	if (dirname === null || extension === null) return;

	const currentPath = userBackgroundsDir + '/' + dirname;
	const deletedPath = userBackgroundsDir + '/deleted-' + dirname;

	try {
		await promisify(fs.rename)(currentPath, deletedPath);
	} catch (e) {
		throw new Error('There was a problem deleting the directory!');
	}
}

/**
 * Returns a URL to display as a background for a certain user
 * @function getBackground
 *
 * @param {string} user - Username
 * @param {getBackgroundCallback} callback - Callback
 */

/**
 * Returns valid URL
 * @callback getBackgroundCallback
 *
 * @param {Object} err - Null if success, error object if failure.
 * @param {string} variants - Object of background URL variations
 * @param {Boolean} hasDefault - Whether or not user has default background.
 */

async function getBackground(user) {
	if (typeof user !== 'string' || !utils.validFilename(user))	return { variants: defaultVariants, hasDefault: true };

	// Get user's extension
	const { dirname, extension } = await getCurrentFiles(user);

	// Fallback to default background if no custom extension
	if (dirname === null || extension === null) return { variants: defaultVariants, hasDefault: true };

	const backgroundURLs = {
		normal: userBackgroundUrl + '/' + dirname + '/normal' + extension,
		blur: userBackgroundUrl + '/' + dirname + '/blur' + extension
	};

	return { variants: backgroundURLs, hasDefault: false };
}

/**
 * Pairs all users with their background variants
 * @function getAllBackgrounds
 *
 * @param {Object} db - Database connection
 * @param {getAllBackgroundsCallback} callback - Callback
 */

/**
 * Returns object with users and backgrounds
 * @callback getAllBackgroundsCallback
 *
 * @param {Object} err - Null if success, error object if failure
 * @param {Object} backgrounds - Object of all users and backgrounds
 */

async function getAllBackgrounds(db) {
	if (typeof db !== 'object') throw new Error('Invalid database connection!');

	let userDirs;
	try {
		userDirs = await promisify(fs.readdir)(userBackgroundsDir);
	} catch (e) {
		throw new Error('There was a problem reading the user backgrounds directory!');
	}

	const userdata = db.collection('users');

	let users;
	try {
		users = await userdata.find({ confirmed: true }).toArray();
	} catch (e) {
		throw new Error('There was a problem querying the database!');
	}

	const remainingUsers = users.map(u => u.user);
	const result = {};

	for (const userDir of userDirs) {
		const dirname = path.parse(userDir).name;
		const dirnameSplit = dirname.split('-');

		if (dirnameSplit[0] === 'deleted' || dirnameSplit[0] === 'default') continue;

		// Remove timestamp
		dirnameSplit.pop();

		// User might have dashes in their name (i.e. bhollander-bodie)
		const user = dirnameSplit.join('-');

		const extension = await getDirExtension(dirname);

		result[user] = {
			hasDefault: false,
			variants: {
				normal: userBackgroundUrl + '/' + dirname + '/normal' + extension,
				blur: userBackgroundUrl + '/' + dirname + '/blur' + extension
			}
		};
		// Remove user from list of people that don't have backgrounds
		remainingUsers.splice(remainingUsers.indexOf(user), 1);
	}

	for (const user of remainingUsers) {
		result[user] = {
			hasDefault: true,
			variants: defaultVariants
		};
	}

	return result;
}

async function getDirExtension(userDir) {
	let userImages;
	try {
		userImages = await promisify(fs.readdir)(userBackgroundsDir + '/' + userDir);
	} catch (e) {
		throw new Error('There was a problem reading the user\'s background directory!');
	}

	// Loop through all valid files until there's either a .png or .jpg extention
	let userExtension = null;
	for (const _file of userImages) {
		const file = path.parse(_file);
		const extension = file.ext;

		// If valid extension, just break out of loop and return that
		if (_.contains(validExtensions, extension)) {
			userExtension = extension;
			break;
		}
	}

	return userExtension;
}

/**
 * Adds a blur to an image
 * @function addBlur
 *
 * @param {string} fromPath - Path to image (png or jpg only)
 * @param {string} toPath - Path to put blurred image
 * @param {Number} blurRadius - Gaussian blur radius
 * @param {addBlurCallback} callback - Callback
 */

/**
 * Returns error if any
 * @callback addBlurCallback
 *
 * @param {Object} err - Null if success, error object if failure.
 */

async function addBlur(fromPath, toPath, blurRadius) {
	if (typeof fromPath !== 'string') throw new Error('Invalid path to original image!');
	if (typeof toPath !== 'string') throw new Error('Invalid path to blurred image!');
	if (typeof blurRadius !== 'number') {
		blurRadius = defaultBlurRadius;
	}

	let image;
	try {
		image = await Jimp.read(fromPath);
	} catch (e) {
		throw new Error('There was a problem reading the image!');
	}

	try {
		await promisify(image.blur(blurRadius).write)(toPath);
	} catch (e) {
		throw new Error('There was a problem saving the image!');
	}
}

/**
 * Creates a blurred version of a user's background
 * @function blurUser
 *
 * @param {string} user - Username
 * @param {blurUserCallback} callback - Callback
 */

/**
 * Returns error if any
 * @callback blurUserCallback
 *
 * @param {Object} err - Null if success, error object if failure.
 */

async function blurUser(user) {
	if (typeof user !== 'string' || !utils.validFilename(user)) throw new Error('Invalid username!');

	const { dirname, extension } = await getCurrentFiles(user);

	if (dirname === null || extension === null) return;

	const userDir = userBackgroundsDir + '/' + dirname;
	const fromPath = userDir + '/normal' + extension;
	const toPath = userDir + '/blur' + extension;

	return addBlur(fromPath, toPath, defaultBlurRadius);
}

module.exports.get    	= getBackground;
module.exports.upload	= uploadBackground;
module.exports.delete 	= deleteBackground;
module.exports.getAll	= getAllBackgrounds;
module.exports.blurUser = blurUser;
