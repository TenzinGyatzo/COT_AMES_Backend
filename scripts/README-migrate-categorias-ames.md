# Migración AMES → categorías dinámicas (Story 5.4 / AD-24)

Script **one-shot documentado** que:

1. Upsertea las 8 categorías MED…OTR en tenants `queretaro` y `los-mochis`
2. Remapea ítems legacy (`categoria` string) → `categoriaId`
3. Asigna `tipo=servicio` a todos los ítems AMES (incl. VDP)
4. `$unset` del campo enum `categoria`

**No** corre en `onModuleInit` ni en onboard (AD-13).

## Orden ops (obligatorio)

1. **Backup** de Mongo del entorno
2. Asegurar que el código con API `categoriaId` (Story 5.3) está desplegable
3. `cd backend && npm run migrate:categorias-ames`
4. Verificar counts (abajo)
5. **Release / usar** el hard-cut en prod AMES

> Migrar **antes** de depender del hard-cut en producción AMES. Greenfield tenants no usan este script.

## Requisitos

- Variable `MONGODB_URI` (mismo `backend/.env` que la app)
- Tenants con `clave` exacta: `queretaro`, `los-mochis` (no inventa tenants; aborta si falta alguno)

## Comando

```bash
cd backend
npm run migrate:categorias-ames
```

## Idempotencia

Re-ejecutar es seguro:

- Categorías: upsert por `(tenantId, codigo)`; **no** pisa `nombre` si ya existía (CRUD)
- Reactiva categoría inactiva (`activo: true`)
- Ítems ya con `categoriaId` y `tipo` no se corrompen; solo backfill de `tipo` si falta

## Verificación post-migración

Por cada tenant AMES:

- `categorias_servicio`: 8 docs con códigos MED, SH, CAP, PC, EAL, RME, VDP, OTR
- `servicios`: ninguno sin `categoriaId`; todos con `tipo: "servicio"`; sin campo `categoria`
- Soft-delete de categoría con ítems activos → **409** (FR57)
- Alta multi-tenant con código MED en QRO+LM → OK (FR17)

### Queries mongosh (ejemplo)

```js
const qro = db.tenants.findOne({ clave: 'queretaro' })._id;
const lm = db.tenants.findOne({ clave: 'los-mochis' })._id;

// 8 categorías por tenant
db.categorias_servicio.countDocuments({ tenantId: qro, activo: true }); // 8
db.categorias_servicio.distinct('codigo', { tenantId: qro });
// → ['CAP','EAL','MED','OTR','PC','RME','SH','VDP'] (orden puede variar)

// Residuales legacy / huecos
db.servicios.countDocuments({ tenantId: qro, categoria: { $exists: true } }); // 0
db.servicios.countDocuments({ tenantId: qro, categoriaId: { $exists: false } }); // 0
db.servicios.countDocuments({
  tenantId: qro,
  $or: [{ tipo: { $exists: false } }, { tipo: null }, { tipo: '' }],
}); // 0

// Repetir con lm
```

## Notas

- Códigos desconocidos / vacíos en legacy → **OTR** (warning en log)
- **VDP** queda `tipo=servicio`; reclasificar a producto es edición manual en Epic 6 (AD-19)
- Tenants no-AMES no se tocan
