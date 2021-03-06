import { takeLatest, put } from 'redux-saga/effects';
import types from '../../actions/site/types';
import * as Kin from 'kin-wallet';
import { setTemplateErrors } from '../../actions/errors/actionsErrors';
// to make test net pass true
const bc = new Kin.Blockchain();

function* loading(bool) {
	yield put({
		type: types.SET_LOADER,
		payload: bool
	});
}

/////////////
// Ledger
////////////

function* isLedgerConnected(action) {
	try {
		yield loading(true);
		// prevent previouse connected ledger
		yield put({
			type: types.SET_IS_LEDGER_CONNECTED,
			payload: { ledgerConnected: false }
		});
		// check if ledger connected
		yield Kin.Ledger.getPublicKey("44'/2017'/0'");

		// set connected
		yield put({
			type: types.SET_IS_LEDGER_CONNECTED,
			payload: { ledgerConnected: true }
		});

		yield loading(false);
	} catch (error) {
		yield loading(false);
		// set error
		yield put(setTemplateErrors([error]));
	}
}

function* getPublicKey(action) {
	try {
		// trigger load
		yield loading(true);
		const data = yield Kin.Ledger.getPublicKey(action.payload.trim());
		yield put({
			type: types.SET_PUBLIC_KEY,
			payload: { publicKey: data.publicKey() }
		});
		// trigger end load
		yield loading(false);
	} catch (error) {
		yield loading(false);
		yield put(setTemplateErrors([error]));
	}
}

function* getAccount(action) {
	try {
		// trigger load
		yield loading(true);
		// payload is public key
		const data = yield bc.getAccount(action.payload);
		yield put({
			type: types.SET_ACCOUNT,
			payload: { account: data }
		});
		// trigger load
		yield loading(false);
	} catch (error) {
		yield loading(false);
		if (error.response) {
			yield put(setTemplateErrors([error.response.title]));
		} else {
			yield put(setTemplateErrors([error.message]));
		}
	}
}

function* getUnsignedTransaction(action) {
	const [publicKey, destinationAccount, kinAmount, memo] = action.payload;
	try {
		yield loading(true);
		const account = yield bc.getAccount(publicKey);
		// payload is public key
		const data = yield bc.getUnsignedTransaction(account, destinationAccount, kinAmount, memo);
		yield put({
			type: types.SET_UNSIGNED_TRANSACTION,
			payload: { unsignedTransaction: data }
		});
		yield loading(false);
	} catch (error) {
		yield loading(false);

		yield put(setTemplateErrors([error.toString()]));
	}
}

function* signTransaction(action) {
	const { derviationPath, unsignedTransaction, signedTransaction, tx } = action.payload;
	let data;
	try {
		if (!signedTransaction) {
			data = yield Kin.Ledger.signTransaction(derviationPath, unsignedTransaction);
			yield loading(true);
			yield put({
				type: types.SIGN_TRANSACTION,
				payload: data
			});
		} else {
			const account = yield bc.getAccount(tx.publicKey);
			const newUnsignedTransaction = yield bc.getUnsignedTransaction(account, ...tx.formData);
			data = yield Kin.Ledger.signTransaction(derviationPath, newUnsignedTransaction);
			yield loading(true);
			yield put({
				type: types.SIGN_TRANSACTION,
				payload: data
			});
		}

		const confirm = yield bc.submitTransaction(data);
		yield put({
			type: types.SUBMIT_TRANSACTION,
			payload: confirm
		});
	} catch (error) {
		yield put(setTemplateErrors([error.toString()]));
	}
}

///////////////
// Key Pair
//////////////

function* isKeyPairValid(action) {
	try {
		// // prevent previouse keyPair
		yield put({
			type: types.SET_IS_KEYPAIR_VALID,
			payload: { keyPairValid: false }
		});
		yield loading(true);
		// get keyPair
		const data = yield Kin.KeyPair.fromSecret(action.payload.trim());
		// set valid and set public key
		yield put({
			type: types.SET_IS_KEYPAIR_VALID,
			payload: { keyPairValid: true, secret: action.payload, publicKey: data.publicKey() }
		});
		yield loading(false);
	} catch (error) {
		// set error
		yield loading(false);
		yield put(setTemplateErrors([error.toString()]));
	}
}
function* signTransactionKeyPair(action) {
	const { unsignedTransaction, secret, signedTransaction } = action.payload;
	try {
		yield loading(true);
		let data;
		if (!signedTransaction) {
			data = yield Kin.KeyPair.signTransaction(secret, unsignedTransaction);
			yield put({
				type: types.SIGN_TRANSACTION,
				payload: data
			});
		} else data = signedTransaction;
		yield put({
			type: types.SIGN_TRANSACTION_KEYPAIR,
			payload: data
		});
		const confirm = yield bc.submitTransaction(data);
		yield put({
			type: types.SUBMIT_TRANSACTION,
			payload: confirm
		});
		yield loading(false);
	} catch (error) {
		yield loading(false);

		yield put(setTemplateErrors([error.toString()]));
	}
}

// watcher
function* blockchainSaga() {
	yield takeLatest(types.IS_LEDGER_CONNECTED, isLedgerConnected);
	yield takeLatest(types.GET_PUBLIC_KEY, getPublicKey);
	yield takeLatest(types.GET_ACCOUNT, getAccount);
	yield takeLatest(types.GET_UNSIGNED_TRANSACTION, getUnsignedTransaction);
	yield takeLatest(types.SET_SIGN_TRANSACTION, signTransaction);
	yield takeLatest(types.GET_IS_KEYPAIR_VALID, isKeyPairValid);
	yield takeLatest(types.SET_SIGN_TRANSACTION_KEYPAIR, signTransactionKeyPair);
}

export default blockchainSaga;
