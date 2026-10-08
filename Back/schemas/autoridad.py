from pydantic import BaseModel, Field
from typing import Optional, List

class AutoridadCreate(BaseModel):
    id_sufijo: str = Field(..., description="Identificador único para la URI (ej. 'grupo_eln', 'muni_cucuta')")
    tipo_autoridad: str = Field(..., description="Persona, Organizacion, GrupoCriminal, FuerzasArmadas, Materia, Lugar")
    termino_autorizado: str
    idioma: str = "es"
    termino_alternativo: Optional[str] = None
    descripcion: Optional[str] = None
    
    # Descripción complementaria
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    direccion: Optional[str] = None
    contacto: Optional[str] = None
    sitio_web: Optional[str] = None
    
    # Relaciones entre instancias (URIs de autoridades)
    esta_ubicado_en: Optional[str] = None
    relacionado_con: Optional[str] = None
    integrante_de: Optional[str] = None
    
    # Enlaces externos
    wikidata: Optional[str] = None
    tiktok: Optional[str] = None
    facebook: Optional[str] = None
    twitter: Optional[str] = None
    notas: Optional[str] = None