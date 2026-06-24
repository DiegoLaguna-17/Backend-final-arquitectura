-- DDL for NeoLend Event Store Table

CREATE TABLE IF NOT EXISTS public."EventosCredito" (
    id BIGSERIAL PRIMARY KEY,
    credit_id UUID NOT NULL, -- Identificador único del crédito (Aggregate ID)
    event_type VARCHAR(100) NOT NULL, -- e.g., 'CreditoSolicitado', 'ScoringRecibido', 'CreditoAprobado'
    payload JSONB NOT NULL, -- Datos específicos del evento
    firma TEXT NOT NULL, -- Firma digital criptográfica para auditoría (Superintendencia)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying events of a specific credit quickly
CREATE INDEX IF NOT EXISTS idx_creditevents_credit_id ON public."EventosCredito" (credit_id);
