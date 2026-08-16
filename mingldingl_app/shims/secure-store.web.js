// Web-only dev polyfill for expo-secure-store (unsupported on web).
// Not used on ios/android, where the real SecureStore module is used.
exports.getItemAsync = async (key) => {
  try { return window.localStorage.getItem(key); } catch { return null; }
};
exports.setItemAsync = async (key, value) => {
  try { window.localStorage.setItem(key, value); } catch {}
};
exports.deleteItemAsync = async (key) => {
  try { window.localStorage.removeItem(key); } catch {}
};
