const supabase = require('../config/supabaseClient');
const crypto = require('crypto');
const { signEvent, verifyEventSignature, getPublicKey } = require('../services/cryptoService');

const canonicalize = (obj) => {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const parts = keys.map(k => `${JSON.stringify(k)}:${canonicalize(obj[k])}`);
  return '{' + parts.join(',') + '}';
};

/**
 * Helper to append a signed event to the EventosCredito table in Supabase
 */
const appendEvent = async (creditId, eventType, payload) => {
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }

  // Re-order keys of payload to ensure deterministic signature
  const dataToSign = `${creditId}:${eventType}:${canonicalize(payload)}`;
  const signature = signEvent(dataToSign);

  const { data, error } = await supabase
    .from('EventosCredito')
    .insert([
      {
        credit_id: creditId,
        event_type: eventType,
        payload: payload,
        firma: signature
      }
    ])
    .select();

  if (error) {
    throw new Error(`DB Error inserting event ${eventType}: ${error.message}`);
  }

  return data[0];
};

/**
 * Endpoint to request a credit (POST /api/creditos/solicitar)
 */
exports.solicitarCredito = async (req, res) => {
  try {
    const { monto, numero_documento, nombres, apellidos } = req.body;
    
    // Validate request
    const requestedAmount = parseFloat(monto) || 500;
    const docNumber = numero_documento || '12345678';
    const clientNombres = nombres || 'Diego';
    const clientApellidos = apellidos || 'Laguna';

    // Generate unique credit_id (Aggregate ID)
    const creditId = crypto.randomUUID();

    // 1. First event: CreditoSolicitado
    const solPayload = {
      monto: requestedAmount,
      numero_documento: docNumber,
      nombres: clientNombres,
      apellidos: clientApellidos
    };
    const eventSolicitado = await appendEvent(creditId, 'CreditoSolicitado', solPayload);

    // Short artificial delay to simulate processing steps
    await new Promise(resolve => setTimeout(resolve, 100));

    // 2. Second event: ScoringRecibido
    // Generates a mock score. For <= 500, a high score is set to approve automatically.
    const mockScore = requestedAmount <= 500 ? 780 : 520; 
    const scoringPayload = {
      score: mockScore,
      shap_values: {
        historial_servicios: '+45 pts (Pago puntual de luz/agua)',
        comportamiento_ecommerce: '+30 pts (Actividad regular)',
        buro_credito: '-15 pts (Consultas recientes)'
      }
    };
    const eventScoring = await appendEvent(creditId, 'ScoringRecibido', scoringPayload);

    await new Promise(resolve => setTimeout(resolve, 100));

    // 3. Third event: CreditoAprobado or CreditoPendienteRevision
    let decision = 'auto';
    let eventType = 'CreditoAprobado';
    
    if (requestedAmount > 500) {
      decision = 'requiere_revision_manual';
      eventType = 'CreditoPendienteRevision';
    }

    const decisionPayload = {
      decision: decision,
      analisis: requestedAmount <= 500 ? 'Aprobación automática bajo umbral de USD 500' : 'Monto excede USD 500, escalado a analista'
    };
    const eventDecision = await appendEvent(creditId, eventType, decisionPayload);

    // Return the summary and the created events
    res.status(201).json({
      success: true,
      message: 'Solicitud procesada mediante Event Sourcing',
      credit_id: creditId,
      events: [
        {
          id: eventSolicitado.id,
          event_type: eventSolicitado.event_type,
          payload: eventSolicitado.payload,
          firma: eventSolicitado.firma
        },
        {
          id: eventScoring.id,
          event_type: eventScoring.event_type,
          payload: eventScoring.payload,
          firma: eventScoring.firma
        },
        {
          id: eventDecision.id,
          event_type: eventDecision.event_type,
          payload: eventDecision.payload,
          firma: eventDecision.firma
        }
      ]
    });
  } catch (error) {
    console.error('Error processing credit solicitation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get audit trail for a credit (GET /api/creditos/historial/:credit_id)
 */
exports.obtenerHistorial = async (req, res) => {
  try {
    const { credit_id } = req.params;
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase client is not initialized' });
    }

    const { data: events, error } = await supabase
      .from('EventosCredito')
      .select('*')
      .eq('credit_id', credit_id)
      .order('id', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      credit_id,
      events
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Verify integrity of a specific event (GET /api/creditos/verificar/:event_id)
 */
exports.verificarEvento = async (req, res) => {
  try {
    const { event_id } = req.params;
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase client is not initialized' });
    }

    const { data: events, error } = await supabase
      .from('EventosCredito')
      .select('*')
      .eq('id', event_id)
      .single();

    if (error || !events) {
      return res.status(404).json({ error: 'Event not found or database error' });
    }

    // Reconstruct the signed string using the canonical form of the payload
    const dataToVerify = `${events.credit_id}:${events.event_type}:${canonicalize(events.payload)}`;
    
    // Verify
    const isValid = verifyEventSignature(dataToVerify, events.firma);

    res.json({
      event_id: events.id,
      event_type: events.event_type,
      firma: events.firma,
      integro: isValid,
      mensaje: isValid 
        ? 'El evento es válido y no ha sido alterado (Firma digital verificada)' 
        : '¡ALERTA! La firma no coincide con el payload del evento'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Expose Public Key (GET /api/creditos/public-key)
 */
exports.obtenerLlavePublica = (req, res) => {
  res.json({
    public_key: getPublicKey()
  });
};
