import httpx
import json
from config import settings
from ai.prompts import POST_RIDE_SYSTEM_PROMPT, WEEKLY_PLAN_SYSTEM_PROMPT
from typing import Dict, Any, Optional

class AICoachService:
    """
    Service for generating Spanish Cycling Coach analysis and plans.
    Supports local Ollama, OpenAI API, Anthropic API, or intelligent heuristic fallback.
    """

    @staticmethod
    async def analyze_activity(activity_data: Dict[str, Any], user_profile: Dict[str, Any]) -> str:
        prompt_content = f"""
        DATOS DE LA SALIDA DEL CICLISTA:
        - Título: {activity_data.get('title', 'Salida sin título')}
        - Tipo de Actividad Detectada: {activity_data.get('activity_type', 'DESCONOCIDA')} (Puntuación Técnica MTB: {activity_data.get('mtb_technical_score', 0)}/10)
        - Tiempo en Movimiento: {round(activity_data.get('moving_time_sec', 0) / 60, 1)} minutos
        - Distancia: {round(activity_data.get('total_distance_m', 0) / 1000, 2)} km
        - Desnivel Positivo: {activity_data.get('elevation_gain_m', 0)} m
        - Velocidad Media: {activity_data.get('avg_speed_kmh', 0)} km/h (Máx: {activity_data.get('max_speed_kmh', 0)} km/h)
        - Frecuencia Cardíaca Media: {activity_data.get('avg_hr', 'N/A')} bpm (Máx: {activity_data.get('max_hr', 'N/A')} bpm)
        - Cadencia Media: {activity_data.get('avg_cadence', 'N/A')} rpm
        - Potencia Media Estimada: {activity_data.get('avg_watts_est', 0)} W (Potencia Normalizada: {activity_data.get('normalized_power', 0)} W)
        - Distribución Zonas FC (%): {json.dumps(activity_data.get('hr_zone_distribution', {}))}
        - Distribución Cadencia (%): {json.dumps(activity_data.get('cadence_distribution', {}))}
        - Perfil del Ciclista: Peso: {user_profile.get('weight_kg', 72)} kg, FTP: {user_profile.get('ftp_watts', 250)} W, FC Máx: {user_profile.get('max_hr', 190)} bpm.
        """

        if settings.AI_PROVIDER == "ollama":
            return await AICoachService._call_ollama(POST_RIDE_SYSTEM_PROMPT, prompt_content)
        elif settings.AI_PROVIDER == "openai" and settings.OPENAI_API_KEY:
            return await AICoachService._call_openai(POST_RIDE_SYSTEM_PROMPT, prompt_content)
        elif settings.AI_PROVIDER == "anthropic" and settings.ANTHROPIC_API_KEY:
            return await AICoachService._call_anthropic(POST_RIDE_SYSTEM_PROMPT, prompt_content)
        else:
            return AICoachService._generate_fallback_analysis(activity_data)

    @staticmethod
    async def generate_weekly_plan(user_profile: Dict[str, Any], load_metrics: Dict[str, Any]) -> str:
        prompt_content = f"""
        ESTADO FISIOLÓGICO Y CARGA DE ENTRENAMIENTO ACTUAL:
        - Ciclista: {user_profile.get('name', 'Ciclista')}
        - FTP: {user_profile.get('ftp_watts', 250)} W, Peso: {user_profile.get('weight_kg', 72)} kg
        - Estado de Forma (CTL / Fitness): {load_metrics.get('ctl', 45.0)}
        - Fatiga Acumulada (ATL / Fatigue): {load_metrics.get('atl', 52.0)}
        - Balance de Forma (TSB / Form): {load_metrics.get('tsb', -7.0)} (Valores negativos indican fatiga acumulada)
        """

        if settings.AI_PROVIDER == "ollama":
            return await AICoachService._call_ollama(WEEKLY_PLAN_SYSTEM_PROMPT, prompt_content)
        elif settings.AI_PROVIDER == "openai" and settings.OPENAI_API_KEY:
            return await AICoachService._call_openai(WEEKLY_PLAN_SYSTEM_PROMPT, prompt_content)
        else:
            return AICoachService._generate_fallback_plan(load_metrics)

    @staticmethod
    async def _call_ollama(system_prompt: str, user_prompt: str) -> str:
        url = f"{settings.OLLAMA_BASE_URL}/api/generate"
        payload = {
            "model": settings.OLLAMA_MODEL,
            "system": system_prompt,
            "prompt": user_prompt,
            "stream": False
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    return resp.json().get('response', '')
        except Exception:
            pass
        return AICoachService._generate_fallback_analysis({})

    @staticmethod
    async def _call_openai(system_prompt: str, user_prompt: str) -> str:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.7
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    return resp.json()['choices'][0]['message']['content']
        except Exception:
            pass
        return AICoachService._generate_fallback_analysis({})

    @staticmethod
    async def _call_anthropic(system_prompt: str, user_prompt: str) -> str:
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": settings.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"
        }
        payload = {
            "model": "claude-3-haiku-20240307",
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
            "max_tokens": 1000
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    return resp.json()['content'][0]['text']
        except Exception:
            pass
        return AICoachService._generate_fallback_analysis({})

    @staticmethod
    def _generate_fallback_analysis(data: Dict[str, Any]) -> str:
        is_mtb = data.get('activity_type') == 'MOUNTAIN_BIKE'
        dist = round(data.get('total_distance_m', 0) / 1000, 1)
        elev = data.get('elevation_gain_m', 0)
        np_w = data.get('normalized_power', 0)

        return f"""
# 🚴 Análisis de Salida FREERIDE AI

### 📊 Resumen de la Sesión
- **Modalidad Detectada:** {'Mountain Bike (MTB)' if is_mtb else 'Ciclismo de Carretera'}
- **Distancia:** {dist} km | **Desnivel Positivo:** {elev} m
- **Potencia Normalizada Estimada:** {np_w} W

### 📊 Análisis Técnico de Telemetría
- {'Excelente trabajo en tramos técnicos de alta cadencia y respuesta a picos de pulsaciones en las subidas.' if is_mtb else 'Ritmo constante y sostenible con buena distribución de pedaleo en zona aeróbica.'}
- Se observa una gestión de esfuerzo eficiente adaptada a las características del terreno.

### 💡 Recomendación del Entrenador
- **Recuperación:** Hidratación adecuada con sales minerales y recarga de carbohidratos en las primeras 2 horas posteriores al entrenamiento.
- **Próxima Sesión:** 45 minutos de recuperación activa Z1 o descanso total si la fatiga muscular es elevada.
"""

    @staticmethod
    def _generate_fallback_plan(load_metrics: Dict[str, Any]) -> str:
        tsb = load_metrics.get('tsb', 0.0)
        is_fatigued = tsb < -10.0

        return f"""
# 🗓️ Plan Semanal Adaptativo FREERIDE

### 📊 Evaluación del Estado de Forma
- **Forma Actual (TSB):** {tsb} ({'Estado de alta fatiga - Priorizar recuperación' if is_fatigued else 'Estado óptimo para asimilar carga'})

### 🗓️ Propuesta Semanal
- **Lunes:** Descanso Total / Estiramientos.
- **Martes:** 1h 30m - Rodaje Z2 Resistencia Aeróbica.
- **Miércoles:** 1h 15m - Series Sweetspot (3x10 min al 88-92% FTP).
- **Jueves:** 1h - Rodaje de Recuperación Z1.
- **Viernes:** Descanso Activo.
- **Sábado:** 2h 30m - Salida Larga de Fondo (Carretera o MTB según objetivo).
- **Domingo:** 1h 45m - Salida Social o MTB en Z2 con tramos libres.
"""
