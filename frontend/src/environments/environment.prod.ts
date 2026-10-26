declare global {
  interface Window {
    SIMET_API_URL?: string;
  }
}

export const environment = {
  production: true,
  apiUrl: window.SIMET_API_URL || '/api',
};