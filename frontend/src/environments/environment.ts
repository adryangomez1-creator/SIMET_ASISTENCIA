declare global {
  interface Window {
    API_URL?: string;
    SIMET_API_URL?: string;
  }
}

export const environment = {
  production: false,
  apiUrl: window.API_URL || window.SIMET_API_URL || '/api',
};