import os
import random
from datetime import datetime, timezone

from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client

# Carga las variables del archivo .env (PORT, SUPABASE_URL, SUPABASE_KEY, etc.)
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Cliente para hablar con Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="Scoring Engine Service")


# -----------------------------------------------------------
# Esto define la "forma" del JSON que esperamos recibir.
# FastAPI valida automáticamente que lo que llegue tenga
# estos campos. Si falta alguno, responde error solo.
# -----------------------------------------------------------
class ScoreRequest(BaseModel):
    usuario_id: str
    pago_luz_puntual: bool = True
    recargas_mensuales: int = 0
    actividad_ecommerce: str = "media"


@app.post("/api/score")
def calcular_score(datos: ScoreRequest):
    # --- ACA "simulamos" la IA ---
    # En vez de un modelo real, generamos un score pseudo-aleatorio
    # dentro de un rango creíble (300 a 850, como un score crediticio real)
    score = random.randint(300, 850)

    # Decisión simple basada en el score (esto imita la regla de negocio
    # del doc: hasta cierto monto se aprueba automático)
    if score >= 650:
        decision = "aprobado"
    elif score >= 500:
        decision = "revision_manual"
    else:
        decision = "rechazado"

    # Los "shap_values" son pesos falsos que simulan explicabilidad.
    # Deben sumar ~1.0 para que parezca un reparto de importancia real.
    shap_values = {
        "pago_luz": 0.45,
        "recargas_moviles": 0.30,
        "actividad_ecommerce": 0.25
    }

    respuesta = {
        "usuario_id": datos.usuario_id,
        "score": score,
        "decision": decision,
        "shap_values": shap_values
    }

    # --- Guardamos la decisión en Supabase para trazabilidad/auditoría ---
    supabase.table("scoring_decisions").insert({
        "usuario_id": datos.usuario_id,
        "input_data": datos.model_dump(),
        "score": score,
        "decision": decision,
        "shap_values": shap_values,
        "created_at": datetime.now(timezone.utc).isoformat()
    }).execute()

    return respuesta


@app.get("/")
def health_check():
    return {"status": "Scoring Engine corriendo correctamente"}