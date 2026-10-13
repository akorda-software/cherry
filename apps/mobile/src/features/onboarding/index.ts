// Dominio: pasos, reanudación y reglas de los campos.
export * from "./domain/birthday";
export * from "./domain/preferences";
export * from "./domain/profile-fields";
export * from "./domain/resume";
export * from "./domain/steps";

// Aplicación: guardado por paso, borrador del perfil y CTA del marco.
export * from "./application/profile-draft-store";
export * from "./application/step-actions";
export * from "./application/step-cta-store";

// Presentación: marco, pasos y piezas reutilizadas en edición.
export * from "./presentation/onboarding-frame";
export * from "./presentation/step-page";
export * from "./presentation/step-tones";
export * from "./presentation/use-onboarding-navigation";
export * from "./presentation/use-profile-draft";
export * from "./presentation/fields/bio-note";
export * from "./presentation/fields/birthday-field";
export * from "./presentation/fields/choice-card";
export * from "./presentation/fields/profile-options";
export * from "./presentation/steps/bio-step";
export * from "./presentation/steps/birthday-step";
export * from "./presentation/steps/done-step";
export * from "./presentation/steps/gender-step";
export * from "./presentation/steps/intent-step";
export * from "./presentation/steps/interested-step";
export * from "./presentation/steps/location-step";
export * from "./presentation/steps/name-step";
export * from "./presentation/steps/photos-step";
export * from "./presentation/steps/tag-picker-step";

// Edición del perfil (mismas piezas, «guardar y volver»).
export * from "./presentation/edit/edit-basics-screen";
export * from "./presentation/edit/edit-bio-screen";
export * from "./presentation/edit/edit-photos-screen";
export * from "./presentation/edit/edit-scaffold";
export * from "./presentation/edit/edit-tags-screen";
