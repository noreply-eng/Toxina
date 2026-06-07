import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Consultation } from '../types/clinical';
import type { IdMapping, OutboxEntry } from '../types/offlineSync';
import type { PatientRecord } from '../types/patient';

const DB_NAME = 'toxina-offline';
const DB_VERSION = 2;

export interface ClinicalCacheMeta {
  userId: string;
  lastSyncedAt: string;
  patientsCount: number;
  consultationsCount: number;
  pendingSyncCount?: number;
}

interface ToxinaOfflineDB extends DBSchema {
  patients: {
    key: string;
    value: PatientRecord;
    indexes: { 'by-user': string };
  };
  consultations: {
    key: string;
    value: Consultation;
    indexes: { 'by-user': string; 'by-patient': string };
  };
  meta: {
    key: string;
    value: ClinicalCacheMeta;
  };
  outbox: {
    key: string;
    value: OutboxEntry;
    indexes: { 'by-user': string; 'by-status': OutboxStatusIndex };
  };
  idMappings: {
    key: string;
    value: IdMapping;
    indexes: { 'by-user': string };
  };
}

type OutboxStatusIndex = OutboxEntry['status'];

let dbPromise: Promise<IDBPDatabase<ToxinaOfflineDB>> | null = null;

function createBaseStores(db: IDBPDatabase<ToxinaOfflineDB>) {
  const patients = db.createObjectStore('patients', { keyPath: 'id' });
  patients.createIndex('by-user', 'user_id');

  const consultations = db.createObjectStore('consultations', { keyPath: 'id' });
  consultations.createIndex('by-user', 'user_id');
  consultations.createIndex('by-patient', 'patient_id');

  db.createObjectStore('meta', { keyPath: 'userId' });
}

function createSyncStores(db: IDBPDatabase<ToxinaOfflineDB>) {
  const outbox = db.createObjectStore('outbox', { keyPath: 'id' });
  outbox.createIndex('by-user', 'userId');
  outbox.createIndex('by-status', 'status');

  const mappings = db.createObjectStore('idMappings', { keyPath: 'localId' });
  mappings.createIndex('by-user', 'userId');
}

export function getOfflineDb(): Promise<IDBPDatabase<ToxinaOfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ToxinaOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          createBaseStores(db);
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('outbox')) {
            createSyncStores(db);
          }
        }
      },
    });
  }
  return dbPromise;
}
