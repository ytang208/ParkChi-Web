import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, GoogleAuthProvider, onAuthStateChanged, setPersistence, signInWithPopup, signOut, type User } from 'firebase/auth';
import { get, getDatabase, ref, serverTimestamp, set, update } from 'firebase/database';

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);

function services() {
  if (!firebaseConfigured) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth: getAuth(app), db: getDatabase(app) };
}

export type SignedInUser = Pick<User, 'uid' | 'displayName' | 'email' | 'photoURL'>;

export function observeUser(callback: (user: User | null) => void) {
  const current = services();
  if (!current) { callback(null); return () => undefined; }
  void setPersistence(current.auth, browserLocalPersistence);
  return onAuthStateChanged(current.auth, callback);
}

export async function signInWithGoogle() {
  const current = services();
  if (!current) throw new Error('Firebase has not been connected yet.');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(current.auth, provider);
  await update(ref(current.db, `users/${result.user.uid}/profile`), {
    displayName: result.user.displayName ?? null,
    email: result.user.email ?? null,
    provider: 'google.com',
    lastSignInAt: serverTimestamp(),
  });
  return result.user;
}

export async function signOutUser() {
  const current = services();
  if (current) await signOut(current.auth);
}

export async function loadParkChiData<T>(uid: string) {
  const current = services(); if (!current) return null;
  const snapshot = await get(ref(current.db, `users/${uid}/apps/parkchi/data`));
  return snapshot.exists() ? snapshot.val() as T : null;
}

export async function saveParkChiData(uid: string, data: unknown) {
  const current = services(); if (!current) return;
  await set(ref(current.db, `users/${uid}/apps/parkchi`), { data, updatedAt: serverTimestamp() });
}
