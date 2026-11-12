import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

const env = (typeof import.meta !== 'undefined' && (import.meta as any)?.env) || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyFakeKeyForTestingEnvironment00000',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'gestaofinanceira-5afd9.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'gestaofinanceira-5afd9',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'gestaofinanceira-5afd9.appspot.com',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: env.VITE_FIREBASE_APP_ID || '1:000000000000:web:0000000000000000000000',
};

// Inicializa o Firebase apenas se ainda não houver app inicializado
let app: any;
try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
} catch {
  app = {} as any;
}

// Inicializa a autenticação
let authInstance: any;
try {
  authInstance = getAuth(app);
} catch {
  authInstance = {} as any;
}
export const auth = authInstance;

// Provedor do Google Auth
let googleProviderInstance: any;
try {
  googleProviderInstance = new GoogleAuthProvider();
  googleProviderInstance.setCustomParameters({
    prompt: 'select_account',
  });
} catch {
  googleProviderInstance = {} as any;
}
export const googleProvider = googleProviderInstance;

// Inicializa o Firestore no banco padrão (default)
let dbInstance;
try {
  dbInstance = initializeFirestore(app, { ignoreUndefinedProperties: true });
} catch {
  dbInstance = getFirestore(app);
}
export const db = dbInstance;

export default app;
