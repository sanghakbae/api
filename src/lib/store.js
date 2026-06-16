// Firestore data layer for saved API requests and the API key vault.
// All documents are scoped under the signed-in user's uid so the app is
// single-user/personal by default (each user only sees their own data).
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

const reqCol = (uid) => collection(db, 'users', uid, 'requests')
const keyCol = (uid) => collection(db, 'users', uid, 'apikeys')
const sessCol = (uid) => collection(db, 'users', uid, 'sessions')
const histCol = (uid) => collection(db, 'users', uid, 'history')

// ---- Saved requests ----
export async function listRequests(uid) {
  const snap = await getDocs(query(reqCol(uid), orderBy('updatedAt', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function saveRequest(uid, data) {
  const payload = { ...data, updatedAt: serverTimestamp() }
  if (data.id) {
    const { id, ...rest } = payload
    await setDoc(doc(reqCol(uid), data.id), rest, { merge: true })
    return data.id
  }
  const ref = await addDoc(reqCol(uid), { ...payload, createdAt: serverTimestamp() })
  return ref.id
}

export async function deleteRequest(uid, id) {
  await deleteDoc(doc(reqCol(uid), id))
}

// ---- API key vault ----
export async function listKeys(uid) {
  const snap = await getDocs(query(keyCol(uid), orderBy('name')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function saveKey(uid, data) {
  if (data.id) {
    const { id, ...rest } = data
    await setDoc(doc(keyCol(uid), id), rest, { merge: true })
    return id
  }
  const ref = await addDoc(keyCol(uid), data)
  return ref.id
}

export async function deleteKey(uid, id) {
  await deleteDoc(doc(keyCol(uid), id))
}

// ---- Sessions (cookie jar) ----
export async function listSessions(uid) {
  const snap = await getDocs(query(sessCol(uid), orderBy('name')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function saveSession(uid, data) {
  if (data.id) {
    const { id, ...rest } = data
    await setDoc(doc(sessCol(uid), id), rest, { merge: true })
    return id
  }
  const ref = await addDoc(sessCol(uid), data)
  return ref.id
}

export async function deleteSession(uid, id) {
  await deleteDoc(doc(sessCol(uid), id))
}

// ---- Request history (persisted in DB, viewable anytime/anywhere) ----
export async function addHistory(uid, entry) {
  await addDoc(histCol(uid), {
    method: entry.method || 'GET',
    url: entry.url || '',
    headers: entry.headers || [],
    params: entry.params || [],
    body: entry.body || '',
    status: entry.status ?? null,
    elapsed: entry.elapsed ?? null,
    createdAt: serverTimestamp(),
  })
}

export async function listHistory(uid, max = 300) {
  const snap = await getDocs(query(histCol(uid), orderBy('createdAt', 'desc'), limit(max)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function deleteHistory(uid, id) {
  await deleteDoc(doc(histCol(uid), id))
}

export async function clearHistory(uid) {
  const snap = await getDocs(histCol(uid))
  // Firestore batches cap at 500 ops; chunk to be safe.
  const docs = snap.docs
  for (let i = 0; i < docs.length; i += 450) {
    const batch = writeBatch(db)
    docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
}
