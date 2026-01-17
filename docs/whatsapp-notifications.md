# Notificaciones de WhatsApp (Meta Cloud API) - Especificaciones

## 1. Objetivo del Feature
Implementar un sistema de notificaciones automáticas vía WhatsApp para alertar al administrador de la plataforma cuando una cotización sea aceptada y se genere una orden de trabajo.

## 2. Evento que Dispara la Notificación
La notificación se dispara única y exclusivamente cuando el estado de una cotización cambia a **Aceptada**.
Este cambio ocurre en los siguientes flujos del `CotizacionesService`:
- Aceptación por cliente autenticado (`aceptarCotizacion`).
- Aceptación vía Magic Token/Link Público (`aceptarCotizacionByMagicToken`).
- NO SE IMPLEMENTARÁ LA NOTIFICACIÓN DURANTE: Aceptación por administrador (`aceptarCotizacionAdmin`).

## 3. Flujo de Negocio Resumido
1. El cliente o el admin acepta una cotización vigente.
2. El sistema genera la Orden de Trabajo correspondiente.
3. Tras la creación exitosa de la orden, el sistema invoca al servicio de WhatsApp.
4. El servicio de WhatsApp envía un mensaje basado en una plantilla pre-aprobada al número configurado del administrador.

## 4. Módulos Involucrados
- **`CotizacionesModule`**: Punto de origen del evento de aceptación.
- **`OrdenesTrabajoModule`**: Módulo que gestiona la creación de la orden que dispara la alerta.
- **`WhatsappModule` (Nuevo)**: Módulo encargado de la comunicación con Meta Cloud API.
- **`ConfigModule`**: Para la gestión de secretos (Tokens, IDs de teléfono y número destino).

## 5. Exclusiones Explícitas (Fuera de Alcance)
- NO se notificarán otros estados (creación, rechazo, vencimiento, etc.).
- NO se enviarán mensajes a los clientes.
- NO se recibirán ni procesarán mensajes entrantes (Webhooks de respuesta).
- NO se gestionarán múltiples destinatarios (solo un número de administrador fijo).
- NO se implementará lógica de creación o edición de plantillas en Meta desde el backend.

## 6. Supuestos Importantes
- Se cuenta con una cuenta de Meta Business configurada y una App de WhatsApp activa.
- Existe una plantilla (template) proactiva ya aprobada por Meta.
- El Token de Acceso Permanente y el Phone Number ID están disponibles para ser configurados en el `.env`.

## 7. Riesgos Conocidos
- **Costo**: El envío de plantillas proactivas tiene un costo asociado por conversación según las políticas de Meta.
- **Expiración de Tokens**: Dependencia de la validez del Access Token de Meta.
- **Límites de Envío**: Restricciones de Meta sobre la cantidad de mensajes según el nivel de calidad del número.
