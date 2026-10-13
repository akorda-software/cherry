export interface FeatureFlagState {
  enabled: boolean;
}

/**
 * Quién gestiona la instancia a la que habla la app (una por país; ver `TRADEMARKS.md`). Lo
 * configura cada instancia con `INSTANCE_*` en el backend. Los campos opcionales son `null` si la
 * instancia no los ha definido.
 */
export interface InstanceInfo {
  /** Nombre visible («Cherry», «Cherry España»…). */
  name: string;
  /** País al que sirve, ISO 3166-1 alfa-2 («ES»). */
  country: string;
  /** Idioma por defecto, etiqueta BCP 47 («es-ES»). */
  locale: string;
  /** Quién gestiona la instancia (persona o entidad responsable). */
  operator: string | null;
  contactEmail: string | null;
  privacyUrl: string | null;
  termsUrl: string | null;
  /** Código fuente de la versión del servidor (AGPL-3.0). */
  sourceUrl: string | null;
}

export interface BootstrapConfig {
  features: Record<string, FeatureFlagState>;
  /** Ausente con servidores anteriores a esta versión del contrato. */
  instance?: InstanceInfo;
  /** Edad mínima de la instancia (18 por defecto); ausente con servidores anteriores. */
  ageVerification?: { minimumAge: number };
}

export function createBootstrapConfig(config: BootstrapConfig): BootstrapConfig {
  return {
    features: Object.fromEntries(
      Object.entries(config.features).map(([key, value]) => [key, { enabled: value.enabled }])
    ),
    ...(config.instance ? { instance: { ...config.instance } } : {}),
    ...(config.ageVerification ? { ageVerification: { minimumAge: config.ageVerification.minimumAge } } : {})
  };
}
