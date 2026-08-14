import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import staticFirebaseConfig from '../firebase-applet-config.json';

export interface FirebaseAppConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
}

function resolveFirebaseConfig(): FirebaseAppConfig {
  const env = (import.meta as any).env || {};

  const config: FirebaseAppConfig = {
    projectId: env.VITE_FIREBASE_PROJECT_ID || staticFirebaseConfig.projectId || '',
    appId: env.VITE_FIREBASE_APP_ID || staticFirebaseConfig.appId || '',
    apiKey: env.VITE_FIREBASE_API_KEY || staticFirebaseConfig.apiKey || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || staticFirebaseConfig.authDomain || '',
    firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || staticFirebaseConfig.firestoreDatabaseId || '(default)',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || staticFirebaseConfig.storageBucket || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || staticFirebaseConfig.messagingSenderId || '',
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || staticFirebaseConfig.measurementId || '',
    oAuthClientId: env.VITE_FIREBASE_CLIENT_ID || staticFirebaseConfig.oAuthClientId || '',
    recaptchaSiteKey: env.VITE_FIREBASE_RECAPTCHA_SITE_KEY || staticFirebaseConfig.recaptchaSiteKey || '',
  };

  if (!config.apiKey || !config.projectId || !config.appId) {
    const errorMsg =
      'Firebase configuration is missing or malformed. Ensure /public/firebase-applet-config.json is present or configure VITE_FIREBASE_* environment variables in your deployment environment.';
    console.error(`[Firebase Configuration Error] ${errorMsg}`, config);
    throw new Error(errorMsg);
  }

  return config;
}

export const firebaseConfig = resolveFirebaseConfig();

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Perform popup-based Google Authentication Sign-In
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign In Error:', error);
    throw error;
  }
}

// Perform sign out
export async function logOut() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign Out Error:', error);
    throw error;
  }
}
