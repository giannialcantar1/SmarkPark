from app.services.vehiculo_service import vehiculo_service
import traceback

try:
    print(vehiculo_service.registrar_entrada('TEST123'))
except Exception as e:
    print('ERROR_TYPE:', type(e).__name__)
    print('ERROR_STR:', str(e))
    print(traceback.format_exc())
