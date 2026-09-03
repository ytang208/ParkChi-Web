import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, GoogleAuthProvider, onAuthStateChanged, setPersistence, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);

function services() {
  if (!firebaseConfigured) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth: getAuth(app), db: getFirestore(app) };
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
  await setDoc(doc(current.db, 'users', result.user.uid), {
    displayName: result.user.displayName ?? null,
    email: result.user.email ?? null,
    provider: 'google.com',
    lastSignInAt: serverTimestamp(),
  }, { merge: true });
  return result.user;
}

export async function signOutUser() {
  const current = services();
  if (current) await signOut(current.auth);
}

export async function loadParkChiData<T>(uid: string) {
  const current = services(); if (!current) return null;
  const snapshot = await getDoc(doc(current.db, 'users', uid, 'apps', 'parkchi'));
  return snapshot.exists() ? snapshot.data().data as T : null;
}

export async function saveParkChiData(uid: string, data: unknown) {
  const current = services(); if (!current) return;
  await setDoc(doc(current.db, 'users', uid, 'apps', 'parkchi'), { data, updatedAt: serverTimestamp() }, { merge: true });
}
