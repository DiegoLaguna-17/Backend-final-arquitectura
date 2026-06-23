const supabase = require('../config/supabaseClient');

exports.testDb = async (req, res) => {
  try {
    if (!supabase) {
       return res.json({
         service: 'onboarding_service',
         db: 'error',
         error: 'Supabase client is not initialized.'
       });
    }
    
    const { data, error } = await supabase.from('test_table_mock').select('*').limit(1);
    
    if (error && error.code === '42P01') {
      return res.json({
        service: 'onboarding_service',
        db: 'connected',
        error: null
      });
    } else if (error) {
      return res.json({
        service: 'onboarding_service',
        db: 'error',
        error: error.message || error
      });
    }

    res.json({
      service: 'onboarding_service',
      db: 'connected',
      error: null
    });
  } catch (err) {
    res.json({
      service: 'onboarding_service',
      db: 'error',
      error: err.message
    });
  }
};
