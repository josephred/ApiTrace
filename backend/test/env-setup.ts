/** Variables minimas para los tests e2e. Se aplican antes de cargar la app. */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/apitrace_test';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-con-mas-de-32-caracteres-0001';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-con-mas-de-32-caracteres-0002';
process.env.SWAGGER_ENABLED = 'false';
// El outbox se drena manualmente en los tests para no depender del reloj.
process.env.OUTBOX_ENABLED = 'false';
process.env.THROTTLE_LIMIT = '100000';
// Los tests e2e recorren la emision asincrona completa contra el simulador.
process.env.SENASA_MODE = 'simulado';
// El barrido de vigencia se invoca a mano con un reloj controlado.
process.env.DTE_LIFECYCLE_ENABLED = 'false';
