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
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

const reqCol = (uid) => collection(db, 'users', uid, 'requests')
const keyCol = (uid) => collection(db, 'users', uid, 'apikeys')
const sessCol = (uid) => collection(db, 'users', uid, 'sessions')

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
