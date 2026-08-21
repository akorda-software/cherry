# Identidad visual

Sistema de diseño de la app móvil: arquitectura de tokens, tema activo e inventario de componentes. La arquitectura es estable; la dirección visual actual está en revisión (ver decisiones).

## Arquitectura de tokens

Capas con dependencia unidireccional:

```
tokens/primitives → tokens/semantics → themes → providers → primitives → composites → screens
```

- **Primitivos** (`src/shared/ui/tokens/primitives/`): valores crudos — color, typography, border, elevation, spacing.
- **Semánticos**: roles (surface, primary, text, danger…) que los componentes consumen; prohibido usar primitivos crudos en componentes.
- **Temas** (`themes/light-theme.ts`): mapean roles → valores; intercambiables por contrato sin tocar componentes.
- **Providers**: `ThemeProvider` + `useTheme()` centralizan la resolución.

Regla: `shared/ui` no contiene nada de producto; rebrandear = editar tokens/tema.

## Tema activo («neobrutal», en curso)

Tema claro con azul primario `#3A41E0` y estética neobrutal aplicada en el trabajo en curso de onboarding/discovery (sin commitear a la fecha de este documento). Definido en `themes/light-theme.ts` + `tokens/primitives/color.ts`.

> Pendiente de decisión: la paleta dating planificada (Cream/Coral/Mint/Lavender, explícitamente no azul SaaS) fue definida en el plan de pantallas original (recuperable del historial de git). Decidir cuál es la dirección final antes de pulir pantallas de producto.

## Tipografía y layout

- Fuentes del sistema; escala definida en `tokens/primitives/typography.ts`.
- Ritmo de espaciado basado en 8 pt; touch targets ≥48.
- Radios y elevaciones propios del tema activo (`border.ts`, `elevation.ts`).

## Inventario de componentes

**Primitivas** (`shared/ui/primitives/`): Button (variantes), Surface, y demás bases consumidas por features.

**Composites** (`shared/ui/composites/`): AppHeader y similares.

**Específicos de dating** (viven en features, no en shared): stepper de onboarding, tag pills, grilla de discovery, hoja de detalle de perfil, modal de match.

## Reglas

- Nuevos componentes genéricos → `primitives`/`composites`; específicos de producto → carpeta de feature.
- Los tests de tema/tokens verifican el contrato (`test/ui/tokens-theme.test.tsx`).
