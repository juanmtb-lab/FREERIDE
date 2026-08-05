import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "FREERIDE Cycling Telemetry & AI Coach"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://freeride_user:freeride_password@localhost:5432/freeride"
    )
    
    # AI Engine
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "ollama") # ollama, openai, anthropic
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    
    # Default Cyclist Profile (for Garmin Edge 130 telemetry & power estimations)
    DEFAULT_RIDER_WEIGHT_KG: float = 72.0
    DEFAULT_BIKE_WEIGHT_KG: float = 9.5
    DEFAULT_MAX_HR: int = 190
    DEFAULT_RESTING_HR: int = 55
    DEFAULT_FTP_WATTS: int = 250

    class Config:
        case_sensitive = True

settings = Settings()
