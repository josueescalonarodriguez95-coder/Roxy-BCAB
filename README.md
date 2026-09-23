# ABA Desk (nombre provisional)

Espacio de trabajo para analistas de conducta (BCBA / BCaBA): empresas, clientes, horas,
ganancias, pagos, pendientes y advertencias automáticas. **Bilingüe (inglés / español)** y
**multiusuario**: cada persona crea su cuenta y sólo ve sus propios datos, así se puede ofrecer
a otras personas más adelante.

Vive en esta carpeta, separada de la app de bodega (raíz del repo): tiene su propio
`package.json` y no afecta al deploy de Storage Control.

## Correr en local

```bash
cd aba-focus
npm install
npm run dev
```

Sin variables de entorno arranca en **modo demo**: sin login real, los datos quedan sólo en el
navegador. Sirve para probarla sin configurar nada.

## Conectar Supabase (cuentas reales)

1. Crear un proyecto **nuevo** en Supabase (recomendado: no mezclarlo con el de la bodega, que
   tiene las tablas abiertas sin login).
2. SQL Editor → pegar `supabase/schema.sql` → Run. Crea las tablas con Row Level Security: cada
   usuario sólo puede leer y escribir sus propias filas.
3. Copiar `.env.example` a `.env.local` y poner `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
   (Project Settings → API).
4. Authentication → Providers → Email habilitado. Si "Confirm email" está activo, al crear
   cuenta llega un correo de confirmación.

## Deploy en Vercel

Nuevo proyecto en Vercel apuntando a este mismo repo, con **Root Directory = `aba-focus`**, y
las dos variables de arriba en Environment Variables.

## Qué hay

| Pestaña | Qué hace |
|---|---|
| Inicio | Horas y ganancias del mes, saldo pendiente, advertencias y tareas |
| Clientes | Iniciales o nombre, empresa, fechas de autorización |
| Horas | Registro de horas clínicas y administrativas pagadas |
| Empresas | Agencias con su tarifa clínica y administrativa |
| Supervisión | RBTs y estudiantes de fieldwork: horas del mes, supervisión dada vs. requerida (5% / 10%), contactos, observación con cliente, % grupal, próxima reunión y avance de fieldwork (2,000 / 1,500 h). No aparece si la credencial es RBT; fieldwork sólo para BCBA |
| Ganancias | Esperado por empresa (horas × tarifa), ganancias por supervisión (horas × tarifa del supervisado), pagos recibidos, saldo, ahorro para impuestos |
| Pendientes | Libreta de tareas |
| Advertencias | Sin horas en el mes, autorizaciones por vencer, pagos atrasados, fecha de certificación / primer año BCBA, contrato de supervisión faltante, horas del mes anterior sin registrar, requisito de supervisión no cumplido, sin próxima reunión |
| Ajustes | Nombre, credencial, fecha de certificación, idioma, % de impuestos |

El botón **Iniciales / Nombres completos** del encabezado oculta los nombres de clientes
(privacidad si alguien ve la pantalla).

## Reglas de supervisión

Están todas en `src/lib/supervision.ts` (`RULES`) para poder actualizarlas en un solo lugar si
la BACB las cambia. La pantalla recuerda verificarlas en los manuales de la BACB.

Si ya habías corrido `schema.sql` antes, vuelve a correrlo completo: agrega las tablas nuevas
(`supervisees`, `supervision_sessions`, `supervisee_months`) sin tocar lo que ya existe.

## Privacidad

Es un organizador personal, no un expediente clínico. Guardar lo mínimo de cada cliente
(iniciales o nombre y fechas de autorización); nunca diagnósticos ni notas clínicas.

## Próximas fases

- Documentos requeridos con fecha de vencimiento
- Calendario
- Reporte de pagos en PDF

## Nombre y mensaje personal

`src/config.ts`: `APP_NAME` (y el `<title>` de `index.html`) para el nombre, y `DEDICATION`
para un mensaje opcional en la pantalla de inicio de sesión.
