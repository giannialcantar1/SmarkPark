# Integracion de Stripe en SmartPark

Esta integracion usa Stripe Checkout. SmartPark no captura ni guarda numeros de tarjeta ni CVV; cuando el usuario elige tarjeta, se redirige a la pagina segura de Stripe.

## Donde aplica

- Cobros de salida de vehiculos: `frontend/src/pages/Payments.jsx`.
- Pagos de planes mensuales: `frontend/src/components/PaymentModal/PaymentModal.jsx` y `frontend/src/pages/MonthlyPlans.jsx`.
- Webhook y confirmacion de pago: `backend/routes/payments.py`.

## Variables de entorno

Agrega estas variables en `backend/.env` o en el `.env` de la raiz del proyecto:

```env
FRONTEND_BASE_URL=http://localhost:5173
STRIPE_SECRET_KEY=sk_test_tu_clave_secreta
STRIPE_WEBHOOK_SECRET=whsec_tu_webhook_secret
STRIPE_CURRENCY=dop
STRIPE_AMOUNT_MULTIPLIER=100
```

Notas:

- `STRIPE_SECRET_KEY` es obligatoria.
- `STRIPE_WEBHOOK_SECRET` es recomendada para produccion y para probar webhooks locales.
- `STRIPE_CURRENCY=dop` cobra en pesos dominicanos.
- `STRIPE_AMOUNT_MULTIPLIER=100` convierte pesos a centavos. Cambialo solo si tu cuenta/moneda requiere otra unidad minima.
- No pongas claves secretas en `frontend/.env`; Checkout se crea desde backend.

## Instalar dependencia

Desde la raiz del proyecto:

```bash
pip install -r backend/requirements.txt
```

## Probar localmente

1. Inicia backend y frontend.
2. Abre Stripe CLI y ejecuta:

```bash
stripe listen --forward-to http://127.0.0.1:5000/api/payments/stripe/webhook
```

3. Copia el `whsec_...` que imprime Stripe CLI y pegalo en `STRIPE_WEBHOOK_SECRET`.
4. Reinicia el backend.
5. Paga con una tarjeta de prueba de Stripe, por ejemplo:

```text
4242 4242 4242 4242
Fecha futura
CVC cualquiera
ZIP cualquiera
```

## Flujo

1. El frontend pide al backend crear una sesion Checkout.
2. Stripe muestra su formulario seguro.
3. Al pagar, Stripe redirige a SmartPark.
4. SmartPark confirma la sesion con Stripe y registra el pago.
5. En produccion, el webhook tambien finaliza el pago aunque el usuario cierre la pestaña antes de volver.
