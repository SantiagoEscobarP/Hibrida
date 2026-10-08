import jwt
from jwt import PyJWKClient, PyJWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.config import settings

# Extrae automáticamente el token del header 'Authorization: Bearer <token>'
security_scheme = HTTPBearer()

# Cliente para recuperar y cachear las claves públicas (JWKS)
jwks_client = PyJWKClient(settings.JWKS_URI)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> dict:
    """
    Valida el token Bearer emitido por Keycloak contra sus claves públicas.
    Retorna el payload decodificado con la información y roles del usuario.
    """
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # 1. Obtener la clave pública correspondiente según el 'kid' del header del token
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # 2. Decodificar y verificar firma, expiración e emisor
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=settings.ISSUER_URL,
            options={
                "verify_aud": False,  # Keycloak a menudo asigna audience en 'account' salvo mapper específico
                "verify_exp": True,
            }
        )
        return payload

    except PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Fallo de autenticación: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_role(required_role: str):
    """
    Dependencia reutilizable para proteger endpoints exigiendo un Realm Role de Keycloak.
    """
    def role_checker(user: dict = Depends(get_current_user)):
        # Keycloak entrega los roles de realm dentro de 'realm_access.roles'
        realm_roles = user.get("realm_access", {}).get("roles", [])
        if required_role not in realm_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permisos insuficientes: se requiere el rol '{required_role}'"
            )
        return user
    return role_checker