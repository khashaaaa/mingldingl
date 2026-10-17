/** The engine. Development builds pin the LAN address in eas.json; preview/production set it on EAS. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5150').replace(/\/$/, '');
