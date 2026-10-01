/**
 * Variables de configuration, lues une par une : c'est la seule forme qu'Expo remplace par leur valeur
 * au moment de la construction (lire `process.env` en entier ne marche pas dans l'appli).
 * Elles viennent de solo/.env (mêmes valeurs publiques que app/.env : même projet Firebase).
 */
export const ENV: Record<string, string | undefined> = {
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_DATABASE_URL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  EXPO_PUBLIC_ONLINE_BACKEND: process.env.EXPO_PUBLIC_ONLINE_BACKEND,
};
