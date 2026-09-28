# seed_mongo.py
from pymongo import MongoClient

def poblar_mongo():
    # Conexión local a MongoDB
    client = MongoClient("mongodb://localhost:27017/")
    db = client["prensa_db"]
    noticias_collection = db["noticias"]

    # Limpiar datos previos si existen
    noticias_collection.drop()

    noticias = [
        {
            "_id": "noticia-001",
            "titulo": "Ataques simultáneos en el suroccidente del país generan alerta máxima",
            "medio": "El Tiempo",
            "fecha_publicacion": "2024-05-20",
            "cuerpo": "Durante las primeras horas de la mañana se reportaron hostigamientos con ráfagas de fusil y explosivos contra la subestación de Policía. Autoridades señalan a las disidencias bajo el mando de Mordisco.",
            "uri_eventos": [
                "http://example.org/hostigamiento-cauca-2024"
            ]
        },
        {
            "_id": "noticia-002",
            "titulo": "Paralización del transporte de carga en vías de Antioquia",
            "medio": "El Colombiano",
            "fecha_publicacion": "2024-06-12",
            "cuerpo": "Grupos armados ilegales atravesaron automotores y amenazaron a transportadores sobre el corredor vial. Unidades del Ejército se desplazan al punto para asegurar la zona.",
            "uri_eventos": [
                "http://example.org/bloqueo-vial-antioquia"
            ]
        }
    ]

    result = noticias_collection.insert_many(noticias)
    print(f"Base de datos 'prensa_db' poblada exitosamente.")
    print(f"Documentos insertados: {len(result.inserted_ids)}")

if __name__ == "__main__":
    poblar_mongo()