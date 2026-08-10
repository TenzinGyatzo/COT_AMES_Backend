export enum Roles {
  OPERATIVO = 'operativo',
  ADMIN_TENANT = 'admin_tenant',
  ADMIN_SISTEMA = 'admin_sistema',
}

/** Roles con acceso a superficies de negocio (AD-11). Plataforma (listar tenants) ≠ este array. */
export const AMES_ROLES: Roles[] = [
  Roles.OPERATIVO,
  Roles.ADMIN_TENANT,
  Roles.ADMIN_SISTEMA,
];
