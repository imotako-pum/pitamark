// OpenAPI 3.1 document configuration consumed by `app.doc31(...)`.
// Centralised here so route files stay focused on schemas/handlers.
// Not `as const` — `app.doc31` requires a mutable `TagObject[]`.
export const openApiDocConfig = {
  openapi: '3.1.0' as const,
  info: {
    title: 'pitamark API',
    version: '0.0.0',
    description: 'Image annotation rooms (PRD-driven)',
  },
  tags: [
    { name: 'rooms', description: 'Room CRUD' },
    { name: 'images', description: 'Image binary delivery' },
  ],
};
