import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, GoogleAuthProvider, onAuthStateChanged, setPersistence, signInWithPopup, signOut, type User } from 'firebase/auth';
import { get, getDatabase, onValue, push, ref, remove, serverTimestamp, set, update } from 'firebase/database';

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
export type BarRanking = { uid: string; displayName: string; barId: string; barName: string; neighborhood: string; choice: 'like' | 'pass'; postText?: string; updatedAt: number };
export type BarReaction = { uid: string; displayName: string; type: 'like' | 'dislike'; updatedAt: number };
export type BarComment = { id: string; uid: string; displayName: string; text: string; createdAt: number };
export type BarSocialData = { rankings: BarRanking[]; reactions: Record<string, BarReaction[]>; comments: Record<string, BarComment[]> };

export function observeUser(callback: (user: User | null) => void) {
  const current = services();
  if (!current) { callback(null); return () => undefined; }
  void setPersistence(current.auth, browserLocalPersistence);
  return onAuthStateChanged(current.auth, callback);
}

export async function signInWithGoogle() {
  const current = services();
  if (!current) throw new Error('Google sign-in has not been connected yet.');
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
  const firebaseSafeData = JSON.parse(JSON.stringify(data));
  await set(ref(current.db, `users/${uid}/apps/parkchi`), { data: firebaseSafeData, schemaVersion: 2, updatedAt: serverTimestamp() });
}

export async function loadPinnedApps(uid: string) {
  const current = services(); if (!current) return null;
  const snapshot = await get(ref(current.db, `users/${uid}/preferences/pinnedApps`));
  if (!snapshot.exists()) return null;
  const value = snapshot.val() as string[] | { items?: string[] };
  return Array.isArray(value) ? value : Array.isArray(value.items) ? value.items : [];
}

export async function savePinnedApps(uid: string, appIds: string[]) {
  const current = services(); if (!current) return;
  await set(ref(current.db, `users/${uid}/preferences/pinnedApps`), { items: appIds, updatedAt: Date.now() });
}

export function observeBarSocial(callback: (data: BarSocialData) => void) {
  const current = services(); if (!current) { callback({ rankings: [], reactions: {}, comments: {} }); return () => undefined; }
  let rankings: BarRanking[] = []; let reactions: Record<string, BarReaction[]> = {}; let comments: Record<string, BarComment[]> = {};
  const emit = () => callback({ rankings, reactions, comments });
  const stops = [
    onValue(ref(current.db, 'barRankings'), (snapshot) => {
      const value = snapshot.val() as Record<string, Record<string, BarRanking & { score?: number }>> | null;
      rankings = value ? Object.values(value).flatMap((items) => Object.values(items)).map((item) => ({ ...item, choice: item.choice || ((item.score ?? 0) >= 3 ? 'like' : 'pass') })) : []; emit();
    }),
    onValue(ref(current.db, 'barPostReactions'), (snapshot) => { const value = snapshot.val() as Record<string, Record<string, BarReaction>> | null; reactions = value ? Object.fromEntries(Object.entries(value).map(([key, items]) => [key, Object.values(items)])) : {}; emit(); }),
    onValue(ref(current.db, 'barPostComments'), (snapshot) => { const value = snapshot.val() as Record<string, Record<string, Omit<BarComment, 'id'>>> | null; comments = value ? Object.fromEntries(Object.entries(value).map(([key, items]) => [key, Object.entries(items).map(([id, item]) => ({ ...item, id })).sort((a, b) => a.createdAt - b.createdAt)])) : {}; emit(); }),
  ];
  return () => stops.forEach((stop) => stop());
}

export async function saveBarRanking(user: SignedInUser, ranking: Pick<BarRanking, 'barId' | 'barName' | 'neighborhood' | 'choice'>) {
  const current = services(); if (!current) throw new Error('Account sync is unavailable.');
  await set(ref(current.db, `barRankings/${ranking.barId}/${user.uid}`), {
    ...ranking,
    uid: user.uid,
    displayName: user.displayName || user.email?.split('@')[0] || 'Chicago user',
    updatedAt: Date.now(),
  });
}

export async function deleteBarRanking(user: SignedInUser, barId: string) {
  const current = services(); if (!current) throw new Error('Account sync is unavailable.');
  await remove(ref(current.db, `barRankings/${barId}/${user.uid}`));
}

export async function updateBarPostText(user: SignedInUser, barId: string, choice: 'like' | 'pass', postText: string) {
  const current = services(); if (!current) throw new Error('Account sync is unavailable.');
  await update(ref(current.db, `barRankings/${barId}/${user.uid}`), { choice, postText: postText.trim(), updatedAt: Date.now() });
}

export async function setBarReaction(user: SignedInUser, postKey: string, type: 'like' | 'dislike' | null) {
  const current = services(); if (!current) throw new Error('Account sync is unavailable.');
  const target = ref(current.db, `barPostReactions/${postKey}/${user.uid}`);
  if (!type) await remove(target);
  else await set(target, { uid: user.uid, displayName: user.displayName || user.email?.split('@')[0] || 'Chicago user', type, updatedAt: Date.now() });
}

export async function addBarComment(user: SignedInUser, postKey: string, text: string) {
  const current = services(); if (!current) throw new Error('Account sync is unavailable.');
  await set(push(ref(current.db, `barPostComments/${postKey}`)), { uid: user.uid, displayName: user.displayName || user.email?.split('@')[0] || 'Chicago user', text: text.trim(), createdAt: Date.now() });
}
