# Política de validación y exposición de datos

- Toda Server Action y ruta que reciba datos de navegador debe validar el payload con Zod antes de consultar o mutar Prisma.
- Los IDs son opacos, las fechas se validan antes de construir `Date`, y los enums se validan contra los enums de Prisma.
- Las acciones determinan siempre organización y permisos desde la sesión; nunca desde el payload.
- Los listados de miembros (incluidos email y rol) requieren `members:*`. Los clientes sin ese permiso reciben arreglos vacíos.
- Login y alta de organización tienen rate limit por IP. Para despliegue horizontal, sustituir el adaptador en memoria por Redis/Upstash.
- Todo HTML de correo escapa valores de usuario/tenant; los enlaces se restringen al origen configurado de la aplicación.
- La CSP y headers anti-embedding se aplican desde middleware. Cualquier proveedor nuevo debe añadirse explícitamente a la CSP.
