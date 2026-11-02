// Every call to Firebase lives here: who is signed in, and each person's saved ticks
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, onAuthStateChanged,
  sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  connectFirestoreEmulator, doc, initializeFirestore, onSnapshot, persistentLocalCache,
  persistentMultipleTabManager, setDoc,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// The local cache lets ticks made offline survive a reload and send themselves later
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (location.hostname === 'localhost') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
}

export const watchUser = callback => onAuthStateChanged(auth, callback);
export const signInWithEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const createAccount = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const resetPassword = email => sendPasswordResetEmail(auth, email);
export const signOutUser = () => signOut(auth);

export function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
}

const progressDoc = uid => doc(db, 'users', uid);

export function watchProgress(uid, onData, onError) {
  return onSnapshot(progressDoc(uid), { includeMetadataChanges: true }, snap => {
    const data = snap.data();
    onData((data && data.ticks) || {}, snap.metadata);
  }, onError);
}

// merge writes only this box, so two devices ticking different boxes never overwrite each other
export const saveTick = (uid, id, on) => setDoc(progressDoc(uid), { ticks: { [id]: on } }, { merge: true });
