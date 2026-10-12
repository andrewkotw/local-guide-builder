import type { ProjectData } from '../types'
import { assertValidStoredProject } from './serialization'

const DB_NAME = 'local-guide-builder'; const STORE = 'projects'; const KEY = 'current'; const VERSION = 1
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE) }
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
  })
}
export async function saveLocalProject(project: ProjectData): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(project, KEY); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error) })
  } finally { db.close() }
}
export async function loadLocalProject(): Promise<ProjectData | null> {
  const db = await openDb()
  try {
    const value = await new Promise<unknown>((resolve, reject) => { const request = db.transaction(STORE).objectStore(STORE).get(KEY); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    if (value === undefined) return null
    assertValidStoredProject(value)
    return { ...value, recommendationEn: value.recommendationEn ?? '', noticeEn: value.noticeEn ?? '', reflections: value.reflections ?? [], customCss: value.customCss ?? '', customCssFileName: value.customCssFileName ?? '' }
  } finally { db.close() }
}
export async function clearLocalProject(): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(KEY); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error) })
  } finally { db.close() }
}
