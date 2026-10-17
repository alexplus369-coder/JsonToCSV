# JSON → Hoja de cálculo · Tips Converter

Web app para convertir archivos JSON de tips de apuestas (formatos **MultiTips** y **Prime Betting**) en hojas de cálculo Excel (.xlsx) y CSV. Procesamiento 100% en el navegador.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4 + shadcn/ui (New York)
- SheetJS (xlsx) para exportación Excel/CSV
- React 19

## Requisitos

- Node.js 18+ o Bun 1.x

## Instalación

```bash
bun install
# o
npm install
```

## Arrancar en desarrollo

```bash
bun run dev
# o
npm run dev
```

Abrir `http://localhost:3000`.

## Build de producción

```bash
bun run build
bun run start
```

## Uso

1. Sube un archivo `.json` (drag-drop o clic), **o** pega el contenido JSON en el textarea, **o** pulsa el botón **"Ejemplo"** para cargar un JSON de muestra.
2. La tabla muestra todas las predicciones con columnas: Categoría / Sección / Hora / Liga / Local / Visitante / Predicción / Cuota / Marcador Local / Marcador Visitante / Estado.
3. Filtra por categoría (pestañas FREE / VIP / BEST_OFFERS), por sección, por estado (Ganada / No iniciada / Perdida) o busca libremente por liga, equipo o predicción.
4. Exporta:
   - **Excel (una hoja)** → todas las filas en una sola hoja.
   - **Excel (por categoría)** → una hoja por FREE / VIP / BEST_OFFERS.
   - **CSV** → UTF-8 con BOM (compatible con Excel).
   - **JSON parseado** → estructura ya procesada para re-importar.

## Estructura esperada del JSON

```json
{
  "app": "com.multitips",
  "timestamp": "2026-10-16 16:57:42",
  "FREE": [
    {
      "name": "Football Tips",
      "section_key": "uuid",
      "section_id": "1145",
      "api_url": "https://...",
      "predictions": [
        "{Time: 19:30, League: Germany Bundesliga, Home: Bayern Munich, Away: RB Leipzig, Prediction: Over+ 2,5 Goals, Rate: 1.35, ScoreHome: 0, ScoreAway: 0, CompetitionStatus: notStarted}"
      ]
    }
  ],
  "VIP": [ ... ],
  "BEST_OFFERS": [ ... ]
}
```

El parser también acepta el formato Prime (`FREE` / `VIP` sin `BEST_OFFERS`) y cualquier JSON donde el top-level tenga arreglos con objetos `{ name, predictions: [string, ...] }`.

## Archivos clave

- `src/app/page.tsx` — UI completa (uploader, tabla, filtros, pestañas, exportación).
- `src/lib/jsonParser.ts` — parser de predicciones (formato pseudo-dict string) y flatten para spreadsheet.
- `src/lib/exportUtils.ts` — generación de .xlsx y CSV con columnas etiquetadas en español.
- `public/sample.json` — JSON de ejemplo.
- `prisma/schema.prisma` — esquema de base de datos (no usado por esta app, pero incluido para consistencia del scaffold).

## Notas

- El parser maneja correctamente comas dentro de valores como `"Over+ 2,5 Goals"` o `"Score 1-1 or 1-2"`.
- Toda la conversión ocurre en el navegador; no se envían datos a ningún servidor.
