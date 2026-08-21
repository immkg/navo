import axios from "axios";

// Falls back to whatever host the page itself was loaded from (with the
// API's port) instead of hardcoding "localhost", so this also works when
// the app is opened from another device on the LAN (e.g. a phone hitting
// the dev machine's IP) rather than only from the dev machine itself.
const defaultBaseURL = `http://${window.location.hostname}:3001`;

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || defaultBaseURL,
});

export default apiClient;
