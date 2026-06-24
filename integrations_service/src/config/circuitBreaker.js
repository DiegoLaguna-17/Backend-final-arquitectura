const CircuitBreaker = require('opossum');
const supabase = require('./supabaseClient');

// ==============================================================
// Función que SIMULA llamar al mainframe IBM Z del buró de crédito
// Hardcodeamos un delay de 9 segundos para forzar el TIMEOUT
// y demostrar el Circuit Breaker en acción
// ==============================================================
const llamarBuroIBMZ = async (carnet) => {
  console.log(`\n[IBM Z] ⏳ Conectando con mainframe buró de crédito para carnet: ${carnet}...`);
  console.log('[IBM Z] Estado: SOAP request enviado al sistema IBM Z mainframe...');

  // SIMULACIÓN: delay de 9 segundos → esto dispara el timeout del Circuit Breaker
  await new Promise((resolve) => setTimeout(resolve, 9000));

  // En producción real, aquí iría el llamado SOAP al buró
  return {
    carnet,
    score_buro: 750,
    fuente: 'IBM_Z_MAINFRAME_REAL',
    timestamp: new Date().toISOString()
  };
};

// ==============================================================
// Función FALLBACK: cuando el circuito está ABIERTO
// Lee el puntaje cacheado desde Supabase
// ==============================================================
const fallbackCache = async (error, carnet) => {
  console.log('\n[Circuit Breaker] 🔴 FALLBACK CACHE RESPONDED');
  console.log(`[Circuit Breaker] Razón del fallback: ${error?.message || 'Circuito abierto'}`);

  await logCircuitBreaker('FALLBACK', carnet, { razon: error?.message });

  if (supabase) {
    const { data, error: dbErr } = await supabase
      .from('buro_cache')
      .select('*')
      .eq('carnet', carnet)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!dbErr && data) {
      console.log(`[Cache] ✅ Score encontrado en caché para carnet ${carnet}: ${data.score_buro}`);
      return {
        carnet,
        score_buro: data.score_buro,
        fuente: 'FALLBACK_CACHE',
        detalle: data.detalle,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Si no hay caché en BD, usar valor por defecto hardcodeado
  console.log('[Cache] ⚠️  Sin caché en BD. Usando score por defecto: 500');
  return {
    carnet,
    score_buro: 500,
    fuente: 'FALLBACK_DEFAULT',
    timestamp: new Date().toISOString()
  };
};

// ==============================================================
// Opciones del Circuit Breaker (opossum)
// ==============================================================
const circuitBreakerOptions = {
  timeout: 5000,          // 5 segundos → la llamada a IBM Z tarda 9s → TIMEOUT
  errorThresholdPercentage: 50,  // Abre si 50% de calls fallan
  resetTimeout: 30000,    // Intenta cerrar el circuito cada 30 segundos (HALF_OPEN)
  volumeThreshold: 1      // Con 1 fallo ya puede abrir (demo rápida)
};

// Crear el Circuit Breaker envolviendo la función del buró
const breaker = new CircuitBreaker(llamarBuroIBMZ, circuitBreakerOptions);

// ==============================================================
// Listeners para loggear los cambios de estado del circuito
// ==============================================================
breaker.on('fire', (carnet) => {
  console.log(`\n[Circuit Breaker] 🟢 Estado: CLOSED | Ejecutando llamada al buró para carnet: ${carnet}`);
  logCircuitBreaker('CLOSED', carnet, { evento: 'REQUEST_FIRED' });
});

breaker.on('timeout', (carnet) => {
  console.log(`\n[Circuit Breaker] ⚠️  Estado: TIMEOUT | La llamada a IBM Z tardó más de ${circuitBreakerOptions.timeout / 1000}s`);
  logCircuitBreaker('TIMEOUT', carnet, { timeout_ms: circuitBreakerOptions.timeout });
});

breaker.on('open', () => {
  console.log('\n[Circuit Breaker] 🔴 Estado: OPEN | Circuito ABIERTO. Bloqueando llamadas al buró.');
  logCircuitBreaker('OPEN', null, { mensaje: 'Circuito abierto. Usando caché.' });
});

breaker.on('halfOpen', () => {
  console.log('\n[Circuit Breaker] 🟡 Estado: HALF_OPEN | Probando si el buró volvió...');
  logCircuitBreaker('HALF_OPEN', null, { mensaje: 'Intento de reconexión con IBM Z' });
});

breaker.on('close', () => {
  console.log('\n[Circuit Breaker] 🟢 Estado: CLOSED | Circuito CERRADO. Buró recuperado.');
  logCircuitBreaker('CLOSED', null, { mensaje: 'Circuito cerrado. IBM Z respondió.' });
});

breaker.on('fallback', (result) => {
  console.log('[Circuit Breaker] 🔁 Fallback ejecutado. Respuesta desde caché.');
});

// Registrar el fallback
breaker.fallback(fallbackCache);

// ==============================================================
// Helper para guardar logs en Supabase
// ==============================================================
const logCircuitBreaker = async (estado, carnet, detalle) => {
  if (!supabase) return;
  try {
    await supabase.from('circuit_breaker_logs').insert({
      estado,
      evento: estado,
      carnet,
      detalle
    });
  } catch (e) {
    // No bloquear si el log falla
  }
};

module.exports = { breaker };
