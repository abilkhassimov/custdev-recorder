import { assertMethod, sendJson } from '../lib/http.js';

export function createConfigHandler(source = process.env) {
  return async function config(req, res) {
    try {
      assertMethod(req, 'GET');
      const googlePickerApiKey = source.GOOGLE_PICKER_API_KEY;
      const googleProjectNumber = source.GOOGLE_CLOUD_PROJECT_NUMBER;
      const googleClientId = source.GOOGLE_CLIENT_ID;
      if (!googlePickerApiKey || !/^\d+$/.test(googleProjectNumber || '') || !googleClientId) {
        return sendJson(res, 503, { error: 'Google Picker is not configured', code: 'config_unavailable' });
      }
      sendJson(res, 200, { googlePickerApiKey, googleProjectNumber, googleClientId });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message, code: error.code || 'internal_error' });
    }
  };
}

export default createConfigHandler();
