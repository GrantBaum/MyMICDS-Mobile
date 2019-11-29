import { Db } from 'mongodb';
import * as cryptoUtils from './cryptoUtils';
import * as users from './users';

export enum Scope {
	ALL = 'ALL',
	ANNOUNCEMENTS = 'ANNOUNCEMENTS',
	FEATURES = 'FEATURES'
}

/**
 * Unsubscribes a user from a certain set of emails.
 * @param db Database connection.
 * @param user Username.
 * @param hash Unsubscription hash.
 * @param scopes Scope(s) to unsubscribe from.
 */
export async function unsubscribe(db: Db, user: string, hash: string | boolean, scopes: Scope | Scope[]) {
	if (typeof db !== 'object') { throw new Error('Invalid database connection!'); }
	if (typeof user !== 'string') { throw new Error('Invalid username!'); }
	if (typeof hash !== 'string' && hash !== true) { throw new Error('Invalid hash!'); }
	if (typeof scopes !== 'string' && typeof scopes !== 'object') { throw new Error('Invalid scope(s)!'); }

	if (typeof scopes === 'string') { scopes = [scopes]; }
	for (const scope of scopes) {
		if (!Object.values(Scope).includes(scope)) {
			throw new Error(`"${scope}" is an invalid email type!`);
		}
	}

	// Make sure valid user and get user id
	const { isUser, userDoc } = await users.get(db, user);
	if (!isUser) { throw new Error('User doesn\'t exist!'); }

	const dbHash = userDoc!.unsubscribeHash!;

	if (hash === true || cryptoUtils.safeCompare(hash, dbHash)) {
		// Hash matches, unsubscribe account!
		const userdata = db.collection('users');

		try {
			await userdata.updateOne({ user }, { $addToSet: { unsubscribed: { $each: scopes } } });
		} catch (e) {
			throw new Error('There was a problem updating the database!');
		}
	} else {
		// Hash does not match
		throw new Error('Hash not valid!');
	}
}