# safety: listo para usar

Reportar y bloquear a otra persona desde cualquier pantalla (perfil completo, chat…). Importa desde
`src/features/safety` (ruta relativa, p. ej. `../../safety`).

## `SafetySheet`

```tsx
import { SafetySheet } from "../../safety";

const [safetyOpen, setSafetyOpen] = useState(false);

<IconButton icon="more" size="sm" accessibilityLabel="Más opciones" onPress={() => setSafetyOpen(true)} />
<SafetySheet
  visible={safetyOpen}
  profileId={other.id}
  displayName={other.displayName ?? "esta persona"}
  onClose={() => setSafetyOpen(false)}
  onBlocked={() => router.back()}      // la hoja ya se ha cerrado y ha avisado con un toast
  onReported={() => {}}                // opcional; la hoja sigue abierta ofreciendo «Bloquear también»
/>
```

Props: `visible`, `profileId`, `displayName`, `onClose()`, `onBlocked?()`, `onReported?()`, `testID?`
(def. `safety-sheet`).

Flujo (hoja inferior del sistema de diseño: se cierra con el velo, arrastrando, con ✕ o con atrás de Android):
1. Menú: «Reportar a {nombre}» (`safety-sheet-report`) · «Bloquear a {nombre}» (`safety-sheet-block`).
2. Reportar: motivos del contrato `REPORT_REASONS` en español (radio, `safety-sheet-reason-<motivo>`) + detalles
   opcionales (máx. 1000, `safety-sheet-details`) → «Enviar reporte» (`safety-sheet-send-report`) →
   `POST /api/users/:id/report` → «Gracias por contárnoslo» con «Bloquear también» (`safety-sheet-block-too`).
3. Bloquear: confirmación clara («No os volveréis a ver ni podréis escribiros…») → «Sí, bloquear»
   (`safety-sheet-confirm-block`) → `POST /api/users/:id/block` → toast + `onClose()` + `onBlocked()`.

Errores: se quedan en el paso con un mensaje claro (sin conexión, perfil ya no disponible, detalles demasiado largos…).
Bloquear a alguien que ya no existe cuenta como bloqueado.

## Lógica suelta (si necesitas tu propia UI)

- `blockProfile(deps, profileId)` / `reportProfile(deps, profileId, reason, details?)` → `{ ok: true, value } |
  { ok: false, message }` (mensajes en español, listos para mostrar).
- `useSafetyFlow({ profileId, deps, onBlocked?, onReported? })`: estado del flujo (`step`, `reason`, `details`,
  `submitting`, `error`…) y acciones (`startReport`, `startBlock`, `selectReason`, `setDetails`, `submitReport`,
  `confirmBlock`, `back`, `reset`).
- `useSafetyApiDeps()`: deps de producción (API autenticada).
- `REPORT_REASON_OPTIONS` (`{ value, label, hint }[]`), `reportReasonLabel(reason)`, `normalizeReportDetails(text)`.
