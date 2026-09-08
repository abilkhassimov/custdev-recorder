import { getEnv } from '../../lib/env.js';
import { requireSession } from '../../lib/session.js';
import { sendJson, sendError, assertMethod } from '../../lib/http.js';
export function createSessionHandler(envSource) { return async function handler(req,res) { try { assertMethod(req,'GET'); const env=envSource || getEnv(); const {email}=requireSession(req,env.SESSION_SECRET); sendJson(res,200,{authenticated:true,email}); } catch(e) { sendError(res,e); } }; }
export default createSessionHandler();
