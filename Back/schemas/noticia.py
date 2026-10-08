from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class AgenteInvolucrado(BaseModel):
    autoridad_uri: str
    tipo_participacion: str  # Victimario o Afectado
    autor: Optional[str] = None
    tipo_afiliacion: Optional[str] = None
    rol: Optional[str] = None

class EventoRelacionado(BaseModel):
    id_sufijo: str
    titulo: str
    fuente: Optional[str] = None
    titulo_alterno: Optional[str] = None
    resumen: Optional[str] = None
    idioma: str = "es"
    notas: Optional[str] = None
    
    # Lugar de ocurrencia (URIs de autoridades tipo Lugar)
    municipio_uri: str
    subdivision_uri: Optional[str] = None
    complemento: Optional[str] = None
    
    # Categoría / Materia
    materia_uri: str
    codigo_clasificacion: Optional[str] = None
    tipo_fuente_materia: Optional[str] = None
    
    # Agentes
    agentes: List[AgenteInvolucrado] = []

class TitularNoticiaCreate(BaseModel):
    id_sufijo: str
    titulo: str
    cuerpo: str
    fuente: str
    fecha_publicacion: datetime
    fecha_actualizacion: Optional[datetime] = None
    materia_uri: str
    eventos: List[EventoRelacionado] = []