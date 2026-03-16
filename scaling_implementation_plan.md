# 🚀 Plan de Implementación: Escalamiento a 200k+ y Auto-Bucketing Dinámico

Este documento detalla la arquitectura, frameworks y algoritmos a implementar para que la aplicación Quantum Scale pueda procesar de manera confiable listas de hasta **200,000+ contactos**, automatizando la creación de clusters (cero fugas a "General") y respetando los límites de RAM del servidor.

---

## 1. El Problema Actual (Diagnóstico)

1. **Out of Memory (OOM) en Render:** Node.js (V8) y Next.js por defecto consumen alrededor de 250MB de RAM en reposo. Al procesar arrays en memoria con 60,000+ valores únicos y mapearlos asíncronamente, los "Garbage Collectors" de Node no alcanzan a limpiar la memoria a tiempo, superando los `512MB` del plan gratuito de Render, lo que resulta en un "Kill" silencioso (Timeout/Crash).
2. **Cola Larga (The Long Tail):** Mandar a "General" los registros no coincidentes ocurre porque, actualmente, el sistema solo asimila contra las opciones preexistentes del JSON o las descubiertas por la IA (limitada a los primeros 2,500).

---

## 2. Solución Arquitectónica (Stack Tecnológico)

Para lograr esto de forma robusta y profesional:

### A. Para el Procesamiento Masivo (Eliminar OOM y Timeouts)
Seguiremos utilizando **BullMQ + Redis**, pero cambiaremos la forma en que el Worker procesa el CSV.
*   **Tecnología Propuesta:** **DuckDB** (modulo `duckdb` o `duckdb-async` de Node.js).
*   **¿Por qué?:** DuckDB es una base de datos analítica local en archivo (como SQLite pero para datos gigantes). En lugar de leer el CSV y hacer conteos en la RAM de Node (`{}` objects, arrays), cargaremos los 200k registros directamente en un archivo temporal de DuckDB. Las operaciones de *Fuzzy Matching*, conteo y agrupamiento se harán mediante SQL súper rápido (en C++) directamente en disco, consumiendo **casi 0 MB de RAM de Node**.

### B. Para el Auto-Bucketing ("Cero General")
Para descubrir clusters automáticamente en la basura restante (los 33k) **sin** usar millones de tokens de la API de IA:
*   **Tecnología Propuesta:** NLP (Natural Language Processing) Local.
*   **Librerías sugeridas:** `compromise` (para extraer sustantivos/entidades del texto) o algoritmos de distancia híbridos (TF-IDF local + Cosine Similarity).
*   **Estrategia (N-Gram Clustering):** 
    1. Se limpian todas las celdas no mapeadas (stopwords, puntuación).
    2. Se agrupan por palabras clave comunes ("Real Estate", "Software", "Consulting").
    3. Si un grupo de palabras clave reúne más de `X` contactos, se "promueve" a un Bucket Nuevo automáticamente.

---

## 3. Plan de Desarrollo Paso a Paso (Roadmap)

### Fase 1: Filtro de Usuario en la Interfaz (UI)
*   Modificar el componente `<ColumnSelector />` en el Frontend.
*   Agregar un **Slider o Input** para que el usuario defina: `Mínimo de contactos para formar un nuevo Bucket` (Ej. defecto: 50).
*   Pasar esta variable (`minClusterSize`) en el payload del Job a `BullMQ`.

### Fase 2: Implementación de DuckDB en el Worker (Estabilidad)
*   Instalar dependencias: `npm install duckdb`
*   Reescribir el paso 4 del `worker/index.ts`:
    *   En lugar de `PapaParse` escribiendo IDs en RAM, usar DuckDB para leer el CSV y guardar el mapeo intermedio.
    *   La clasificación se maneja actualizando una columna virtual `assigned_bucket` temporal.

### Fase 3: Auto-Discovery Algorithm (Rompiendo el 'General')
*   Crear la función `autoClusterRemaining(unmappedValues, minClusterSize)`.
*   **Lógica:**
    1. Iterar sobre todos los textos que cayeron en "General".
    2. Usar una función de *Keyword Extraction* para sacar las palabras más significativas de cada título de empresa/cargo.
    3. Contar la frecuencia de estas palabras.
    4. **Regla de ORO:** Si una palabra clave (ej. "Distribution") aparece en `>= minClusterSize` filas, **se extrae del General y se crea automáticamente el bucket de carpeta "⚙️ Distribution (Auto)"**.
    5. Los elementos se inyectan a este nuevo bucket.

### Fase 4: Opcional (Embedding Vector Search - Pro Tier)
*   Si los resultados de la Fase 3 no son lo suficientemente "inteligentes" (ej. no agrupa "Lawyer" con "Attorney"), implementar **OpenAI Embeddings (`text-embedding-3-small`)** o los de **Cohere**.
*   Proyectar esos embeddings a través de un algoritmo de clustering (`K-Means` o `HDBScan`) para descubrir las bolsas de forma semántica, y luego usar Gemini Flash para "nombrar" el centro de ese cluster detectado.

---

## 4. Requerimientos de Infraestructura (Render)

Llegar a la marca de los 200,000 contactos **requiere obligatoriamente** dejar el *Free Tier*. El plan gratuito es excelente para prototipos, pero en servidores de producción reales, los OOM Killers de Linux no perdonan las variaciones de RAM.

*   **Plan Mínimo Recomendado:** **Starter Plan ($7 / mes)**. 
    *   Este plan entrega recursos estables, sin apagados por inactividad.
*   **Plan Óptimo:** **Standard Plan ($25 / mes)**.
    *   Ofrece **2GB de RAM**, vitales para manejar matrices de memoria en V8 cuando Node.js carga y guarda JSONs finales de gran formato antes de mandarlos a la UI en el Frontend.

---

### Resumen del Flujo Futuro:
1. Sube CSV (200k).
2. UI Ajuste: "Mínimo 100 contactos por Bucket".
3. Worker ingestará todo a DuckDB (0% RAM Crash).
4. AI Mapea las bolsas principales.
5. El *Auto-Discovery* escanea lo que sobró, busca patrones semánticos repetidos +100 veces, crea las carpetas, las nombra y saca la información del General.
6. El JSON finalizado es entregado y pintado en la Web.
