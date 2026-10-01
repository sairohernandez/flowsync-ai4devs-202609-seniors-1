

## Prompt 1

**Modelo:** Sonnet 4.6
**Herramienta:** Claude Code

como hacer un buen promt para sacar un documento PRD a partir del codigo, que incluya ingenieria inversa y utilizando criterios de when/then para una implementacion de sdd

## Prompt 2

Actúa como un arquitecto de software senior especializado en documentación técnica.
Analiza el siguiente código fuente y genera un PRD (Product Requirements Document)
completo usando ingeniería inversa.

## CONTEXTO
- Módulo/Sistema: [NOMBRE DEL MÓDULO]
- Lenguaje/Stack: [ej. Java + Spring Boot / React + Node]
- Módulo ERP relacionado: [ej. SIIGC-CXP, SIIGC-INV]
- Audiencia del documento: [Analistas / Arquitectos / QA]


## INSTRUCCIONES DE INGENIERÍA INVERSA

A partir del código, infiere y documenta:

1. **Propósito funcional** — ¿Qué problema de negocio resuelve este código?
2. **Actores y roles** — ¿Quién lo usa? Dedúcelo de los endpoints, permisos o variables.
3. **Entidades y modelo de datos** — Extrae entidades, campos, tipos y relaciones
   (clases, DTOs, tablas referenciadas).
4. **Flujos de negocio** — Describe el flujo principal paso a paso, incluyendo
   validaciones, condiciones de error y caminos alternativos.
5. **Reglas de negocio implícitas** — Documenta toda lógica condicional (if/switch/
   validaciones) como regla explícita nombrada.
6. **Integraciones** — Servicios externos, APIs, bases de datos o módulos llamados.
7. **Supuestos de diseño** — Lo que el código asume pero no documenta
   (marca como [SUPUESTO]).

---

## ESTRUCTURA DEL PRD A GENERAR

### 1. Resumen Ejecutivo
   Descripción de alto nivel del componente en 3-5 oraciones.

### 2. Alcance
   - Incluido en este componente
   - Excluido / fuera de alcance

### 3. Entidades y Modelo de Datos
   Tabla por entidad: Campo | Tipo | Requerido | Descripción | Regla

### 4. Flujos Funcionales
   Diagrama textual (paso numerado) del flujo principal y flujos alternativos.

### 5. Reglas de Negocio
   Tabla: ID Regla | Descripción | Condición | Consecuencia

### 6. Criterios de Aceptación (When/Then para SDD)

   Para CADA flujo o regla de negocio identificada, genera criterios en este formato:

   **CA-XX: [Nombre del escenario]**
   - **GIVEN** (Dado que): [estado previo / precondición del sistema]
   - **WHEN** (Cuando): [acción o evento que dispara el flujo]
   - **THEN** (Entonces): [resultado esperado verificable — incluir campos,
     estados, mensajes y efectos en BD si aplica]

   Cubrir obligatoriamente:
   - ✅ Escenario exitoso (happy path)
   - ❌ Escenario con datos inválidos
   - 🔒 Escenario sin permisos / acceso denegado
   - 🔲 Escenario con datos vacíos o nulos
   - ⚠️ Escenario de error de integración (si hay llamadas externas)

### 7. Requisitos No Funcionales
   Infiere del código: rendimiento esperado, seguridad, logging, manejo de errores.


## REGLAS DE CALIDAD PARA EL ANÁLISIS

- NO inventes valores de negocio que no estén en el código.
- Si algo es ambiguo, documentarlo como [SUPUESTO] o [POR DEFINIR].
- Los criterios When/Then deben ser verificables por un QA sin leer el código.
- Cada regla de negocio encontrada debe tener al menos un CA asociado.
- Usa terminología del dominio que el código ya usa (nombres de métodos, variables
  de negocio, constantes).
- Guarda el documento docs\en spec-viva con el el nombre sairohernandez.md