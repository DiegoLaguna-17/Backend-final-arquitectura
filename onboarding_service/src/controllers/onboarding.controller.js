const supabase = require('../config/supabaseClient'); 

const BD_IDENTIDADES_ROBADAS = [
    {
        numero_documento: "00000000",
        motivo_reporte: "Robo de billetera físico reportado a la policía",
        fecha_reporte: "2026-05-12T10:00:00Z",
        nivel_riesgo: "CRÍTICO",
        fuente: "Registro Nacional de Policía"
    },
    {
        numero_documento: "12345678",
        motivo_reporte: "Patrón biométrico asociado a suplantación en e-commerce",
        fecha_reporte: "2026-06-01T14:30:00Z",
        nivel_riesgo: "ALTO",
        fuente: "Buró de Fraude Digital"
    }
];

// NUEVA FUNCIÓN: Sube un archivo físico (recibido por multer) a Supabase
const subirArchivoSupabase = async (archivo, prefijoNombre, numeroDocumento) => {
    if (!archivo) return null;

    // Extraer la extensión original (ej. jpg, png)
    const extension = archivo.originalname.split('.').pop();
    const nombreArchivo = `${prefijoNombre}_${numeroDocumento}_${Date.now()}.${extension}`;

    // Subir el buffer del archivo a Supabase
    const { error: uploadError } = await supabase.storage
        .from('documentos_biometricos')
        .upload(nombreArchivo, archivo.buffer, {
            contentType: archivo.mimetype,
            upsert: true
        });

    if (uploadError) {
        throw new Error(`Error subiendo la imagen a Supabase: ${uploadError.message}`);
    }

    // Obtener y retornar la URL pública
    const { data: publicUrlData } = supabase.storage
        .from('documentos_biometricos')
        .getPublicUrl(nombreArchivo);

    return publicUrlData.publicUrl;
};

const registrarUsuario = async (req, res) => {
    try {
        // Los datos de texto vienen en req.body
        const { nombres, apellidos, numero_documento, monto } = req.body;
        
        // Los archivos físicos vienen en req.files gracias a multer
        const archivoDoc = req.files?.['imagen_doc']?.[0];
        const archivoSelfie = req.files?.['imagen_selfie']?.[0];

        // 1. Validación de Fraude Simulado
        const alertaFraude = BD_IDENTIDADES_ROBADAS.find(
            (registro) => registro.numero_documento === numero_documento
        );

        if (alertaFraude) {
            return res.status(403).json({
                error: "RECHAZO_POR_FRAUDE",
                mensaje: "Operación bloqueada. El documento coincide con alertas de seguridad activas.",
                detalles_bloqueo: {
                    motivo: alertaFraude.motivo_reporte,
                    nivel_riesgo: alertaFraude.nivel_riesgo,
                    fuente_reporte: alertaFraude.fuente
                }
            });
        }

        // Validación extra: Asegurarnos de que enviaron las imágenes
        if (!archivoDoc || !archivoSelfie) {
            return res.status(400).json({ error: "Faltan las imágenes del documento o la selfie." });
        }

        // 2. Simulación de validación biométrica local (Data Residency)
        await new Promise(resolve => setTimeout(resolve, 800));

        // 3. Subida REAL de las imágenes a Supabase
        let urlDocumentoReal = "";
        let urlSelfieReal = "";

        try {
            [urlDocumentoReal, urlSelfieReal] = await Promise.all([
                subirArchivoSupabase(archivoDoc, 'doc', numero_documento),
                subirArchivoSupabase(archivoSelfie, 'selfie', numero_documento)
            ]);
        } catch (uploadErr) {
            return res.status(500).json({ error: uploadErr.message });
        }

        // 4. Guardar en Base de Datos
        const { data, error } = await supabase
            .from('usuarios_onboarding')
            .insert([
                {
                    nombres,
                    apellidos,
                    numero_documento,
                    url_documento: urlDocumentoReal, 
                    url_selfie: urlSelfieReal,       
                    biometria_validada: true,
                    procesado_localmente: true, 
                    fraude_detectado: false,
                    cursos_completados: 0,
                    monto: monto ? parseFloat(monto) : 0
                }
            ])
            .select();

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: "El documento ya se encuentra registrado." });
            }
            throw error;
        }

       

        return res.status(201).json({
            mensaje: "Identidad verificada y solicitante registrado exitosamente.",
            usuario: data[0],
        });

    } catch (error) {
        console.error("Error en registrarUsuario:", error);
        // Ahora Postman te dirá exactamente qué explotó
        return res.status(500).json({ 
            error: "Error interno del servidor.", 
            detalle: error.message || error 
        });
    }
};

module.exports = { registrarUsuario };