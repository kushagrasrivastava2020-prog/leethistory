// Runs the sign-in screen and connects the signed-in person to their own ticks
import {
  createAccount, resetPassword, saveTick, signInWithEmail, signInWithGoogle, signOutUser, watchProgress, watchUser,
} from './firebase.js';
import { loginMapCells, setStatus, setTicks, startTracker } from './tracker.js';

const $ = id => document.getElementById(id);

const ERRORS = {
  'auth/invalid-credential': 'That email and password don’t match. Check them, or create an account if you’re new.',
  'auth/wrong-password': 'That email and password don’t match. Check them, or create an account if you’re new.',
  'auth/user-not-found': 'That email and password don’t match. Check them, or create an account if you’re new.',
  'auth/email-already-in-use': 'That email already has an account. Sign in instead, or use Forgot password.',
  'auth/weak-password': 'Use at least 6 characters for your password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site, then try again.',
  'auth/operation-not-supported-in-this-environment': 'Google sign-in doesn’t work inside this app. Open this page in Chrome or Safari.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
  'auth/operation-not-allowed': 'This sign-in method isn’t turned on yet.',
};
const SILENT = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];

let uid = null;
let stopProgress = null;
let creating = false;

function show(view) {
  $('bootView').hidden = view !== 'boot';
  $('loginView').hidden = view !== 'login';
  $('appView').hidden = view !== 'app';
}

function note(text, tone) {
  $('formNote').hidden = !text;
  $('formNote').textContent = text || '';
  $('formNote').dataset.tone = tone || 'error';
}

function setBusy(busy) {
  for (const id of ['google', 'emailSubmit', 'forgot', 'switchMode']) $(id).disabled = busy;
}

async function attempt(action) {
  note('');
  setBusy(true);
  try {
    await action();
  } catch (e) {
    if (!SILENT.includes(e.code)) note(ERRORS[e.code] || 'Sign-in didn’t work. Try again.');
  }
  setBusy(false);
}

function setMode(create) {
  creating = create;
  note('');
  $('emailSubmit').textContent = create ? 'Create account' : 'Sign in';
  $('switchMode').textContent = create ? 'Already have an account? Sign in' : 'New here? Create an account';
  $('password').autocomplete = create ? 'new-password' : 'current-password';
  $('forgot').hidden = create;
}

function statusFor(meta) {
  if (!meta.hasPendingWrites && !meta.fromCache) return 'saved';
  if (meta.fromCache && (meta.hasPendingWrites || !navigator.onLine)) return 'offline';
  return meta.hasPendingWrites ? 'saving' : 'loading';
}

function openProgress(user) {
  uid = user.uid;
  $('who').textContent = user.displayName || user.email;
  setStatus('loading');
  let first = true;
  stopProgress = watchProgress(uid, (ticks, meta) => {
    setTicks(ticks, first);
    first = false;
    setStatus(statusFor(meta));
  }, () => setStatus('failed'));
}

function closeProgress() {
  if (stopProgress) stopProgress();
  stopProgress = null;
  uid = null;
  setTicks({}, true);
}

$('loginMap').innerHTML = loginMapCells();
startTracker((id, on) => saveTick(uid, id, on).catch(() => setStatus('failed')));

$('google').addEventListener('click', () => attempt(signInWithGoogle));
$('emailForm').addEventListener('submit', e => {
  e.preventDefault();
  const email = $('email').value.trim();
  const password = $('password').value;
  attempt(() => (creating ? createAccount(email, password) : signInWithEmail(email, password)));
});
$('switchMode').addEventListener('click', () => setMode(!creating));
$('forgot').addEventListener('click', () => {
  const email = $('email').value.trim();
  if (!email) return note('Enter your email above first.');
  attempt(async () => {
    await resetPassword(email);
    note('If that email has an account, a reset link is on its way.', 'ok');
  });
});
$('signOut').addEventListener('click', () => signOutUser());

watchUser(user => {
  closeProgress();
  if (user) {
    openProgress(user);
    show('app');
  } else {
    $('password').value = '';
    show('login');
  }
});
