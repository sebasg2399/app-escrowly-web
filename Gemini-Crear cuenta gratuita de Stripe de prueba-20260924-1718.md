# Crear cuenta gratuita de Stripe de prueba

**Created:** 9/24/2026 1:11:12  
**Updated:** 9/24/2026 17:16:00  
**Exported:** 9/24/2026 17:18:44  
**Link:** [https://gemini.google.com/app/d7a17fef44fca9f2](https://gemini.google.com/app/d7a17fef44fca9f2)  

## Gemini:

> 9/24/2026 17:14:12

> **Thinking steps**
>
> **Defining the Scope**
>
> I have established the project's scope, aiming for an MVP PRD with feature choices for "Escrowly."
>
> **Defining Features**
>
> I have started defining 5 key features, including a dispute resolution mechanism to refine Escrowly's scope.
>
> **Analyzing Feature Options**
>
> I've outlined options for multi-milestone contracts and a notification engine for Escrowly features.
>
> **Refining Feature Detail**
>
> I have clarified advanced feature specifics, including multi-milestone contracts and dispute resolution flows.

¡Excelente elección! **Escrowly** tiene mucha fuerza y suena exactamente como un producto SaaS B2B real. 

Para que este proyecto destaque en tu portafolio y demuestre tu capacidad para resolver problemas de negocio complejos, redactaremos este **Documento de Requisitos del Producto (PRD)** enfocado en el MVP (Producto Mínimo Viable).

Aquí tienes la base del PRD y, al final, la lista de 5 funcionalidades clave para que decidas cuáles incluimos en el alcance final.

---

## PRD MVP: Escrowly
**Objetivo del Producto:** Proveer una plataforma segura para transacciones de servicios B2B, donde los fondos del cliente quedan retenidos (escrow) y solo se liberan al vendedor cuando se aprueban los entregables.

### 1. Actores del Sistema (User Personas)
* **Cliente (Comprador):** Quien financia el proyecto. Necesita garantías de que no perderá su dinero si el trabajo no se entrega.
* **Vendedor (Freelancer/Agencia):** Quien ejecuta el trabajo. Necesita garantías de que el dinero ya está asegurado antes de empezar a trabajar.
* **Admin / Plataforma (Escrowly):** Orquesta los pagos, cobra comisiones (Application Fees) y resuelve bloqueos.

### 2. Flujos Críticos del MVP (Core Journeys)
1. **Onboarding Financiero:** El Vendedor se registra y conecta su cuenta bancaria mediante Stripe Connect (Express/Custom) para poder recibir fondos.
2. **Creación del Contrato:** El Cliente o Vendedor crea un "Acuerdo" por un monto específico (ej. $1,000 USD).
3. **Fondeo (Checkout):** El Cliente ingresa su tarjeta. El dinero es capturado por Stripe, pero **no** se transfiere al Vendedor. Queda en el saldo de la plataforma.
4. **Entrega y Aprobación:** El Vendedor sube el trabajo. El Cliente lo revisa y presiona "Aprobar".
5. **Liquidación (Payout & Fees):** El backend detecta la aprobación, calcula la comisión de Escrowly (ej. 10%) y usa la API de transferencias de Stripe para enviar el 90% restante a la cuenta conectada del Vendedor.

---

### 3. Las 5 Funcionalidades Clave (Menú de opciones)
Para que el proyecto pase de ser un "tutorial avanzado" a un **proyecto de portafolio de nivel senior**, necesitamos agregarle fricciones del mundo real. 

**Revisa estas 5 opciones y dime cuáles 2 o 3 quieres integrar al MVP** (intentar hacer las 5 puede alargar demasiado el desarrollo):

1. **Contratos Multi-hitos (Milestone Funding):** 
   * *El reto:* En lugar de un pago único, el contrato se divide (ej. 30% Diseño, 70% Desarrollo). Cada hito es un pago independiente que se retiene y libera por separado. Demuestra dominio en modelado de base de datos relacional y manejo múltiple de *PaymentIntents*.
2. **Flujo de Disputas ("Human-in-the-loop"):**
   * *El reto:* ¿Qué pasa si el Cliente rechaza el trabajo pero el Vendedor dice que está perfecto? Implementaríamos **AWS Step Functions** para pausar la liberación de fondos, emitir una alerta (AWS SNS) a un "Moderador" y esperar una llamada manual a la API para hacer un *Refund* parcial o total, o forzar la transferencia.
3. **Billetera del Vendedor (Payouts programados):**
   * *El reto:* En lugar de enviarle el dinero al banco del Vendedor inmediatamente al aprobar el trabajo, el dinero se acumula en su "Balance" de la plataforma. El Vendedor debe solicitar un "Retiro de fondos" (Payout) manual, demostrando tu capacidad para manejar saldos virtuales y control de liquidez.
4. **Monetización Híbrida (Suscripción + Transacción):**
   * *El reto:* Los Vendedores "Gratuitos" pagan 10% de comisión por trabajo. Los Vendedores "Premium" pagan una suscripción de $20/mes (Stripe Billing) que les reduce la comisión al 2%. Demuestra que sabes mezclar *Stripe Connect* con el motor de recurrencia.
5. **Gestión Segura de Artefactos (S3 Presigned URLs):**
   * *El reto:* Para que el Cliente apruebe el trabajo, el Vendedor debe subir el entregable. El backend genera una URL prefirmada de S3 con caducidad de 15 minutos para que el Cliente lo descargue. Garantiza que los archivos del contrato no sean públicos.

<FollowUp label="¿Cuáles de estas funcionalidades te gustaría incluir en el alcance?" query="Me interesan estas funcionalidades para el MVP: [Menciona tus elegidas]. Avancemos con la arquitectura y el esquema de datos."/>

## User:

> 9/24/2026 17:16:00

las 5 primeras

## Gemini:

> 9/24/2026 17:16:00

> **Thinking steps**
>
> **Defining the Scope**
>
> I have clarified the user's need to prioritize the initial five MVP features for Escrowly's PRD.
>
> **Detailing Architecture Choices**
>
> I've decided to propose RDS (Postgres) as the database, emphasizing its suitability for multi-milestone contracts and financial ledgers.
>
> **Mapping the Data Structure**
>
> My focus has shifted to establishing the core data entities and their relationships within the system.

Integrar las 5 funcionalidades convierte a **Escrowly** en un sistema *Enterprise-grade*. Demostrará tu capacidad para manejar concurrencia, estados distribuidos, seguridad de archivos y flujos de dinero complejos. 

Dado que el alcance es amplio, estructuraremos la arquitectura técnica y el modelo de datos para soportar todas estas reglas de negocio.

## Arquitectura en AWS (LocalStack)

Para soportar las 5 funcionalidades de manera escalable y desacoplada, utilizaremos una arquitectura orientada a eventos (*Event-Driven Architecture*):

*   **API Gateway + AWS Lambda:** Exposición de endpoints RESTful para tu frontend. Cada lambda maneja un dominio específico (Contratos, Pagos, Usuarios).
*   **AWS Step Functions (Flujo de Disputas y Aprobaciones):** Orquesta el ciclo de vida del dinero. El flujo de un hito será una máquina de estados: `Fondos Retenidos` $\rightarrow$ `Esperando Revisión` $\rightarrow$ bifurcación lógica entre `Aprobado` (libera fondos) o `Disputado` (pausa y notifica al moderador).
*   **Amazon S3 (Gestión Segura de Artefactos):** Almacenamiento de los entregables del Vendedor. Lambda generará URLs prefirmadas (`Presigned URLs`) con un TTL (Time-To-Live) de 15 minutos para que el Cliente los descargue.
*   **Amazon SQS + EventBridge (Asincronismo):** Los webhooks de Stripe llegarán a un endpoint que publicará el evento en SQS. Las Lambdas consumirán estos eventos para actualizar la base de datos sin bloquear la respuesta a Stripe.
*   **Amazon SNS:** Notificaciones push/email simuladas para alertar a los administradores de una disputa o al Vendedor de que su pago fue liberado.

## Estrategia de Flujo de Dinero (Stripe Connect)

El manejo del dinero usará la topología **Separate Charges and Transfers** de Stripe, la única que permite retener fondos por tiempo indefinido y dividir los pagos en hitos.

1.  **Fondeo del Hito (Charge):** El Cliente paga el Hito 1. Se crea un `PaymentIntent` en la cuenta de Escrowly. El dinero reposa en el saldo de la plataforma.
2.  **Cálculo Dinámico de Comisión (Monetización Híbrida):** Al aprobarse el hito, el sistema consulta si el Vendedor tiene una suscripción activa de Stripe Billing (Plan Premium). Si la tiene, calcula el 2% de comisión; si no, el 10%.
3.  **Transferencia al Vendedor (Transfer):** Se ejecuta una transferencia (`Transfer`) desde el saldo de Escrowly hacia la cuenta conectada (`Connected Account`) del Vendedor por el monto neto.
4.  **Billetera y Retiro (Manual Payouts):** La cuenta de Stripe Connect del Vendedor estará configurada con `payouts={schedule: manual}`. El Vendedor verá su saldo en el frontend de Escrowly y deberá ejecutar una petición a tu API para transferir ese dinero a su cuenta bancaria real.

## Modelo de Datos Core (Esquema Relacional)

Para transacciones financieras y estados complejos, una base de datos relacional (como PostgreSQL) es ideal. Este es el esquema principal:

| Tabla | Columnas Clave | Propósito |
| :--- | :--- | :--- |
| **Users** | `id`, `role` (client, seller, admin), `stripe_customer_id`, `stripe_account_id` (Connect), `subscription_status` (free, premium). | Identidad y vinculación con las entidades de Stripe. |
| **Contracts** | `id`, `client_id`, `seller_id`, `total_amount`, `status` (draft, active, completed, cancelled). | Agrupa múltiples hitos bajo un mismo acuerdo comercial. |
| **Milestones** | `id`, `contract_id`, `amount`, `title`, `status` (pending, funded, in_review, disputed, approved, paid), `stripe_payment_intent_id`. | La unidad financiera del proyecto. Cada hito se fondea y se libera por separado. |
| **Deliverables** | `id`, `milestone_id`, `s3_object_key`, `uploaded_at`. | Referencia al archivo en S3 que el Vendedor entrega para desbloquear el hito. |
| **Disputes** | `id`, `milestone_id`, `reason`, `status` (open, resolved_seller, resolved_client). | Registro de auditoría si el Step Function entra en estado de disputa. |

---

<ElicitationsGroup message="¿Por dónde quieres empezar a codificar o configurar?">
  <Elicitation label="Definir la infraestructura con Terraform" query="Genera el código de Terraform para levantar API Gateway, Lambdas, SQS y S3 en LocalStack."/>
  <Elicitation label="Diseñar la API y el código Lambda" query="Diseña los endpoints de la API y muéstrame cómo estructurar el código de la Lambda que genera las Presigned URLs en S3."/>
  <Elicitation label="Configurar la máquina de estados" query="Crea la definición en JSON de AWS Step Functions para el flujo de aprobación y disputa de los hitos."/>
</ElicitationsGroup>

Powered by Gemini Exporter (https://www.ai-chat-exporter.com)
