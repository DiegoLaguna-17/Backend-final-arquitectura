const supabase = require('../config/supabaseClient');

exports.testDb = async (req, res) => {
  try {
    if (!supabase) {
      return res.json({
        service: 'integrations_service',
        db: 'error',
        error: 'Supabase client no inicializado. Revisa SUPABASE_URL y SUPABASE_KEY en .env'
      });
    }

    const { data, error } = await supabase.from('usuarios').select('count').limit(1);

    if (error) {
      return res.json({
        service: 'integrations_service',
        db: 'error',
        error: error.message
      });
    }

    res.json({
      service: 'integrations_service',
      db: 'connected ✅',
      mensaje: 'Conexión a Supabase exitosa',
      error: null
    });
  } catch (err) {
    res.json({
      service: 'integrations_service',
      db: 'error',
      error: err.message
    });
  }
};
