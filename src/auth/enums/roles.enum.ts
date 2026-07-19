export enum Roles {
  OPERATIVO = 'operativo',
  ADMIN_SISTEMA = 'admin_sistema',
}

/** Roles AMES con acceso a superficies de negocio v1 (Story 1.3). */
export const AMES_ROLES: Roles[] = [Roles.OPERATIVO, Roles.ADMIN_SISTEMA];
