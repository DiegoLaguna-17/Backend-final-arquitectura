const supabase = require('../config/supabaseClient');
const { breaker } = require('../config/circuitBreaker');
const axios = require('axios');

// URL del Scoring Engine (Microservicio 2)
const SCORING_SERVICE_URL = process.env.SCORING_SERVICE_URL || 'http://localhost:3003';

// ==============================================================
// GET /api/legacy/buro?carnet=1234567
// Consulta al buró de crédito IBM Z con Circuit Breaker
// Busca usuario por carnet y envía datos al Scoring Engine
// ==============================================================
exports.consultarBuro = async (req, res) => {
  const { carnet } = req.query;

  if (!carnet) {
    return res.status(400).json({
      success: false,
      error: 'El parámetro "carnet" es requerido. Ej: GET /api/legacy/buro?carnet=1234567'
    });
  }

  console.log('\n============================================================');
  console.log(`[Gateway] 📥 Nueva solicitud de consulta buró para carnet: ${carnet}`);
  console.log('============================================================');

  try {
    // PASO 1: Buscar usuario en Supabase por carnet
    console.log(`\n[DB] 🔍 Buscando usuario con carnet: ${carnet} en Supabase...`);
    let usuario = null;

    if (supabase) {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('carnet', carnet)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[DB] ❌ Error consultando Supabase:', error.message);
      }

      if (data) {
        usuario = data;
        console.log(`[DB] ✅ Usuario encontrado: ${data.nombre} ${data.apellido}`);
      }
    }

    // Si no se encuentra en BD, usar datos simulados
    if (!usuario) {
      console.log(`[DB] ⚠️  Usuario no encontrado en BD. Usando datos simulados para demo.`);
      usuario = generarUsuarioSimulado(carnet);
    }

    // PASO 2: Llamar al buró IBM Z con Circuit Breaker
    console.log('\n[Gateway] 🔌 Iniciando consulta al buró de crédito IBM Z...');
    let resultadoBuro;

    try {
      resultadoBuro = await breaker.fire(carnet);
    } catch (circuitError) {
      // El fallback ya fue ejecutado dentro del breaker
      // Este catch es por si el propio fallback falla
      console.error('[Circuit Breaker] Error crítico en fallback:', circuitError.message);
      resultadoBuro = {
        carnet,
        score_buro: 500,
        fuente: 'EMERGENCY_DEFAULT',
        timestamp: new Date().toISOString()
      };
    }

    // PASO 3: Construir payload con datos alternativos para el Scoring Engine
    const payloadScoring = construirPayloadScoring(usuario, resultadoBuro);

    console.log('\n[Gateway] 📤 Enviando datos al Scoring Engine (Microservicio 2)...');
    console.log('[Payload]', JSON.stringify(payloadScoring, null, 2));

    // PASO 4: Llamar al Scoring Engine (Microservicio 2)
    let scoringResult = null;
    try {
      const scoringResponse = await axios.post(
        `${SCORING_SERVICE_URL}/api/score`,
        payloadScoring,
        { timeout: 10000 }
      );
      scoringResult = scoringResponse.data;
      console.log(`\n[Scoring Engine] ✅ Score recibido: ${scoringResult?.score}`);
    } catch (scoringError) {
      console.warn(`\n[Scoring Engine] ⚠️  No se pudo contactar el servicio de scoring: ${scoringError.message}`);
      console.warn('[Scoring Engine] Continuando sin score externo...');
    }

    // PASO 5: Respuesta final al cliente
    const respuesta = {
      success: true,
      carnet,
      usuario: {
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        telefono: usuario.telefono
      },
      buro: {
        score_buro: resultadoBuro.score_buro,
        fuente: resultadoBuro.fuente,
        detalle: resultadoBuro.detalle || null,
        timestamp: resultadoBuro.timestamp
      },
      datos_alternativos: payloadScoring.datos_alternativos,
      scoring_engine: scoringResult
        ? {
            score_final: scoringResult.score,
            shap_values: scoringResult.shap_values,
            decision: scoringResult.decision || null
          }
        : { mensaje: 'Scoring Engine no disponible', score_estimado: resultadoBuro.score_buro },
      circuit_breaker: {
        estado: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
        stats: breaker.stats
      }
    };

    console.log('\n[Gateway] ✅ Respuesta enviada al cliente');
    console.log('============================================================\n');

    return res.status(200).json(respuesta);

  } catch (error) {
    console.error('[Gateway] ❌ Error inesperado:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      carnet
    });
  }
};

// ==============================================================
// GET /api/legacy/circuit-status
// Consulta el estado actual del Circuit Breaker
// ==============================================================
exports.estadoCircuito = async (req, res) => {
  let logs = [];

  if (supabase) {
    const { data } = await supabase
      .from('circuit_breaker_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    logs = data || [];
  }

  return res.json({
    circuit_breaker: {
      estado: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
      stats: breaker.stats,
      options: {
        timeout_ms: 5000,
        error_threshold: '50%',
        reset_timeout_ms: 30000
      }
    },
    logs_recientes: logs
  });
};

// ==============================================================
// HELPERS
// ==============================================================

function generarUsuarioSimulado(carnet) {
  const usuarios = {
    '1234567': { carnet, nombre: 'Carlos', apellido: 'Mendoza', email: 'carlos@email.com', telefono: '77012345', pago_luz: 45.50, pago_agua: 12.00, pago_telefonia: 35.00, recargas_moviles: 20.00, compras_ecommerce: 150.00, meses_historial: 18 },
    '7654321': { carnet, nombre: 'Ana', apellido: 'Quispe', email: 'ana@email.com', telefono: '71234567', pago_luz: 30.00, pago_agua: 8.50, pago_telefonia: 25.00, recargas_moviles: 10.00, compras_ecommerce: 80.00, meses_historial: 24 },
  };

  return usuarios[carnet] || {
    carnet,
    nombre: 'Usuario',
    apellido: 'Simulado',
    email: `user_${carnet}@neolend.com`,
    telefono: '00000000',
    pago_luz: 35.00,
    pago_agua: 10.00,
    pago_telefonia: 25.00,
    recargas_moviles: 15.00,
    compras_ecommerce: 100.00,
    meses_historial: 12
  };
}

function construirPayloadScoring(usuario, buro) {
  return {
    carnet: usuario.carnet,
    datos_alternativos: {
      pago_luz: usuario.pago_luz || 35.00,
      pago_agua: usuario.pago_agua || 10.00,
      pago_telefonia: usuario.pago_telefonia || 25.00,
      recargas_moviles: usuario.recargas_moviles || 15.00,
      compras_ecommerce: usuario.compras_ecommerce || 100.00,
      meses_historial: usuario.meses_historial || 12
    },
    score_buro_previo: buro.score_buro,
    fuente_buro: buro.fuente,
    timestamp: new Date().toISOString()
  };
}
