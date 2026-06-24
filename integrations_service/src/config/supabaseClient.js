require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey && supabaseUrl !== 'https://placeholder.supabase.co') {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('[Supabase] Cliente inicializado correctamente');
} else {
  console.warn('[Supabase] Variables de entorno no configuradas. Usando modo mock.');
}

module.exports = supabase;
