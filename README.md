# English Learning

Plataforma web para estudiar vocabulario en inglés con conjuntos de estudio, flashcards,
cuestionarios y repetición espaciada (SRS).

- **Frontend:** Angular 21 (standalone, zoneless, Signals, Reactive Forms), SCSS, Poppins.
- **Backend gestionado:** Supabase (PostgreSQL + Auth) mediante `@supabase/supabase-js`.
- **Pruebas:** Vitest (`ng test`).

## Puesta en marcha

Requisitos: Node 24 LTS (recomendado; Node 25 funciona pero no es LTS) y npm.

```bash
npm install
npm start          # http://localhost:4200
npm test -- --watch=false
npm run build      # salida en dist/english-learning/browser
```

### Configuración de Supabase (una sola vez)

1. **Autenticación por correo y contraseña** (Dashboard → Authentication → Sign In / Providers):
   - _Email_ debe estar activado (lo está por defecto).
   - _Confirm email_: si está activo, quien se registre recibe un enlace y debe abrirlo antes de
     iniciar sesión (el correo integrado de Supabase tiene un límite muy bajo de envíos por hora).
     Para desarrollo puede desactivarse; la app funciona con ambas opciones.
   - **Desactivar _Allow anonymous sign-ins_**: las políticas RLS permiten el rol `authenticated`
     y los usuarios anónimos también lo usan, así que dejarlo activo permitiría crear cuentas
     sin pasar por el registro.
2. Las migraciones de [`supabase/migrations/`](supabase/migrations/) ya están aplicadas en el
   proyecto **Cards**. Para otro proyecto: `supabase link --project-ref <ref>` y `supabase db push`.
3. La URL y la **clave publicable** están en [`src/environments/environment.ts`](src/environments/environment.ts).

## Arquitectura

Organización por funcionalidades + Atomic Design para la interfaz.

```text
src/app/
  core/                    servicios únicos de la aplicación
    supabase/              cliente tipado, tipos generados, mapeo de errores
    auth/                  AuthService (signals), guards de rutas
    session/               id del usuario autenticado para los repositorios
    theme/  feedback/      tema claro/oscuro, toasts, confirmaciones
    models/                tipos compartidos (dirección de estudio)
  shared/
    ui/atoms|molecules|organisms   componentes visuales sin lógica de negocio
    layouts/               estructura (topbar, navegación móvil, capas globales)
    styles/                design tokens, temas, tipografía, mixins
    utils/                 texto, fechas, aleatoriedad, formularios
  features/<funcionalidad>/
    pages/                 pantallas (coordinan estado, datos y navegación)
    components/            componentes propios de la funcionalidad
    data/                  repositorios: única capa que habla con Supabase
    state/                 stores con Signals
    domain/                lógica pura y probada (sin Angular ni Supabase)
  dev/                     catálogo del sistema de diseño (/design-system, solo desarrollo)
```

Flujo de datos: **página → store (signals) → repositorio (supabase-js)**; las reglas de negocio
viven en `domain/` como funciones puras.

| Ruta                      | Pantalla                           |
| ------------------------- | ---------------------------------- |
| `/login`, `/registro`     | Acceso (públicas)                  |
| `/sets` (inicio)          | Mis conjuntos                      |
| `/sets/:setId`            | Detalle del conjunto y vocabulario |
| `/sets/:setId/flashcards` | Flashcards de un conjunto          |
| `/sets/:setId/quiz`       | Cuestionario                       |
| `/review`                 | Repasar (repetición espaciada)     |
| `/progress`               | Progreso                           |

Todas las rutas salvo `/login` y `/registro` exigen sesión: sin ella se redirige a `/login`
(recordando la ruta pedida en `returnUrl`, solo si es interna). Quien ya tiene sesión y abre
`/login` va directo a `/sets`.

## Autenticación y seguridad

- **Correo y contraseña** con Supabase Auth ([`auth.service.ts`](src/app/core/auth/auth.service.ts)).
  Sin recuperación de contraseña ni proveedores externos por ahora. La sesión persiste en el navegador
  y se sincroniza entre pestañas: si se cierra en una, la otra vuelve a `/login`.
- Los mensajes de error no revelan si falló el correo o la contraseña.
- Al cerrar sesión o cambiar de usuario se vacía el estado en memoria (no queda nada de la cuenta anterior).
- Todas las tablas tienen **RLS** y políticas solo para el rol `authenticated` con
  `owner_id = auth.uid()`. El rol `anon` no tiene permisos. No existen políticas públicas.
- Claves foráneas compuestas `(id, owner_id)` impiden asociar datos a recursos de otro usuario.
- Privilegios mínimos: el historial (`review_events`) es de solo inserción y lectura.
- Las funciones RPC son `security invoker` (respetan RLS) y no se pueden ejecutar como `anon`.
- En el frontend solo existe la clave **publicable**. Nunca usar `service_role` ni contraseñas de base de datos.
- Las pantallas de acceso no validan nada de seguridad en el cliente: la contraseña mínima de 8
  caracteres es una ayuda; la política real la define Supabase (Authentication → Policies).
- Las sesiones anónimas de versiones anteriores se descartan en el navegador; sus datos quedan
  huérfanos en la base y no se migran a ninguna cuenta.

## Modelo de datos

| Tabla                 | Contenido                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `study_sets`          | Conjuntos (nombre único por usuario, descripción opcional).                                                                                                  |
| `vocabulary_items`    | Palabra en inglés, traducción, ejemplo, notas y pronunciación aproximada (`pronunciation_es`), opcionales.                                                   |
| `review_events`       | Historial inmutable de intentos: grado (`again`/`hard`/`good`), tipo de pregunta, dirección, origen, modo, estado resultante e id de intento (idempotencia). |
| `review_states`       | Estado de aprendizaje por palabra: estado, dominio, dificultad, rachas, retención, estadísticas por dirección, intervalo y próximo repaso. Sin fila = nueva. |
| `pronunciation_audio` | Índice de audios generados (caché, bloqueo de duplicados y consumo). Solo la usa la Edge Function.                                                           |

Borrados en cascada: conjunto → palabras → historial y estado de aprendizaje. Las estadísticas no se
almacenan: se calculan con conteos en la base de datos (`get_learning_overview`, `get_weekly_progress`).

## Reglas de estudio

### Aprendizaje adaptativo

Cada respuesta —flashcards, cuestionarios y Repasar— actualiza la palabra. El algoritmo es una
función pura ([`learning-state.ts`](src/app/features/spaced-repetition/domain/learning-state.ts)) y
todos sus umbrales están en [`learning-config.ts`](src/app/features/spaced-repetition/domain/learning-config.ts)
(se pueden cambiar ahí o proveer otra configuración con `LEARNING_CONFIG`).

**Evaluación.** Flashcards y Repasar: **No la sabía** · **Me costó** · **La sabía** (teclas 1, 2, 3).
Girar la tarjeta no cuenta. Cuestionarios: un error es «No la sabía»; un acierto, «La sabía» (una
tilde de menos no es un fallo de memoria).

**Peso de cada acierto** = tipo de pregunta × grado: escrita 1 · flashcard 0,8 · selección
múltiple 0,5; «Me costó» vale la mitad.

**Tiempo entre intentos de la misma palabra:**

| Separación    | Interpretación                                                          |
| ------------- | ----------------------------------------------------------------------- |
| < 10 min      | Repetición inmediata: cuenta en el historial, no suma dominio ni racha. |
| 10 min – 12 h | Intento independiente: suma dominio y racha.                            |
| ≥ 12 h        | Comprobación de retención (vale el doble tras 7 días sin verla).        |

Un fallo repetido de inmediato no se castiga dos veces.

**Estados** (cada palabra está en uno solo):

| Estado                    | Criterio                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| Nueva                     | Sin intentos.                                                                                             |
| En aprendizaje            | Practicada, sin dominio suficiente.                                                                       |
| Difícil                   | ≥ 3 intentos, ≥ 2 fallos y dificultad ≥ 45. Deja de serlo con dificultad < 30 (histéresis).               |
| Dominada provisionalmente | Dominio ≥ 70, ≥ 3 puntos de aciertos seguidos y racha que abarca ≥ 2 h. Posible en un solo día.           |
| Aprendida                 | Lo anterior + ≥ 1,5 puntos de retención (2 comprobaciones en días distintos) y racha que abarca ≥ 3 días. |

- **Dominio actual** (0–100): cada acierto suma `0,35 × peso` de lo que falta hasta 100; un fallo lo reduce a la mitad.
- **Dificultad** (0–100): 50 % errores recientes (últimos 8), 20 % historial completo (suavizado),
  15 % olvidos de palabras ya dominadas, 15 % dirección que más cuesta; cada acierto seguido la reduce
  un 15 % (hasta 4). No depende solo del porcentaje histórico.
- Un fallo de una palabra dominada o aprendida es un **olvido**: vuelve a aprendizaje y su retención
  se comprueba de nuevo.

**Programación (SRS):** tras un fallo, 10 min. En aprendizaje: 1 h tras el primer acierto y 4 h
después («Me costó» retrocede un paso). Al dominarla: al día siguiente. Después, el intervalo se
multiplica por 2,5 («Me costó»: × 1,2) según el tiempo que realmente la recordó, hasta 120 días; las
aprendidas nunca salen de los repasos. Un repaso adelantado (antes de la mitad del intervalo)
mantiene la fecha. Los intervalos de días empiezan a medianoche local.

**Persistencia.** `record_learning_attempt` guarda el intento y el estado en una transacción:
idempotente por id de intento (un reenvío por corte de red no duplica) y con control de versión (si
otra pestaña escribió antes, el cliente relee y recalcula). En una sesión de flashcards, la tarjeta
que no sabías se repite una vez al final, pero solo se registra el primer intento.

**Historial previo.** Las 30 respuestas anteriores (binarias) se reprocesaron una vez con este
algoritmo: flashcards como autoevaluación y cuestionarios —cuyo tipo no se guardó— con el peso más
bajo. No se inventó ningún intento.

### Repasar

- **Repaso inteligente** (recomendado): pendientes por prioridad (difíciles, en aprendizaje, por
  verificar, aprendidas) intercaladas con hasta 20 nuevas; máx. 40 tarjetas, con al menos un cuarto
  reservado a nuevas.
- **Mis dificultades**: difíciles y palabras con fallos, aunque no estén pendientes (máx. 20).
- **Aprendidas**: palabras con retención comprobada, las más próximas primero.
- `?mode=difficult` abre directamente un modo.

### Cuestionarios

- Tipos: selección múltiple, respuesta escrita o mixto. Direcciones: EN→ES, ES→EN o ambas.
- Los distractores son traducciones reales del mismo conjunto. Se descartan los equivalentes a
  la respuesta y los de palabras con la misma pregunta. Con pocas respuestas distintas hay menos
  opciones (mínimo 2) o la pregunta pasa a escrita, y se informa al usuario.
- Respuestas escritas: se ignoran mayúsculas, espacios extra y puntuación en los extremos.
  Las alternativas se separan con «/» o «;». Sin tildes se acepta **con aviso**; la **ñ ≠ n**.

### Progreso

- **Barra segmentada** con los cinco estados (gris nuevas, amarillo en aprendizaje, rojo difíciles,
  azul dominadas, verde aprendidas); la suma es el total. También en cada tarjeta de conjunto.
- **% aprendido** = aprendidas / total; **% dominio provisional** = dominadas / total (por separado).
- **Precisión:** aciertos (incluidos «Me costó») / respuestas. Mide respuestas, no palabras.
- **Racha:** días seguidos (hora local) con al menos una respuesta; la de ayer se conserva hasta medianoche.
- Además: palabras que necesitan atención (con su motivo), dominadas hoy, aprendidas recientemente,
  evolución de las últimas 8 semanas, próximos repasos e historial reciente.

## Pronunciación y audio

### Pronunciación escrita

- Campo opcional `pronunciation_es` (máx. 100 caracteres), **escrito a mano**: no se genera
  automáticamente ni se usa IPA. La sílaba acentuada va en mayúsculas: `TRÁ-bol-shú-ting`.
- Se muestra bajo la palabra en el vocabulario y en la cara en inglés de las flashcards y de Repasar.

### Audio con ElevenLabs

Flujo: botón de altavoz → Edge Function [`pronounce`](supabase/functions/pronounce/) → si el audio
existe, devuelve una URL firmada (1 h); si no, lo genera **una sola vez** con ElevenLabs, lo guarda en
Storage y devuelve la URL. Las repeticiones reutilizan el archivo (en memoria del navegador y en Storage).

- **Clave de caché:** `sha256(texto + voz + modelo + formato + idioma)` → `pronunciations/v1/<voz>/<hash>.mp3`.
  Si se edita una palabra cambia el hash, así que nunca se reproduce el audio de la versión anterior.
  Los archivos no se borran: el mismo texto puede usarlo otra palabra o conjunto.
- **Concurrencia:** `claim_pronunciation_audio` reserva la generación en una transacción con bloqueo;
  una segunda petición simultánea espera (el cliente reintenta como máximo 2 veces) y reutiliza el resultado.
- **Seguridad:** la clave de ElevenLabs solo existe como secreto de Edge Functions (`ElevenLabs` o
  `ELEVENLABS_API_KEY`). La función exige un usuario autenticado no anónimo (`verify_jwt` + validación
  en el código, porque la plataforma deja pasar peticiones con solo la clave publicable), acepta únicamente
  el id de una palabra del propio usuario (RLS), nunca texto libre. Bucket `pronunciations` privado, sin
  políticas: solo la función escribe y firma URLs. La tabla `pronunciation_audio` no es accesible desde clientes.
- **Consumo:** 40 audios nuevos por usuario cada 24 h y 15.000 caracteres al mes en total (ambos
  configurables). Sin reintentos automáticos contra ElevenLabs. Nada se genera al abrir un conjunto.
- **Velocidades:** normal (1×) y lenta (0,75×) con `HTMLAudioElement.playbackRate` sobre el mismo archivo.
- **Flashcards y Repasar:** el audio va fuera del botón de la tarjeta (no la gira) y solo aparece con la
  cara en inglés visible: en ES→EN, tras girar. No modifica resultados ni el SRS.
- **Voz y modelo:** Matilda (`XrExE9yKIg1WjnnlVkGX`, inglés estadounidense) con `eleven_flash_v2_5`,
  MP3 de 32 kbps. Según ElevenLabs, las voces predefinidas podrían retirarse el 31/12/2026: los audios
  guardados siguen funcionando y basta con configurar otra voz para los nuevos.

Configuración opcional (Edge Functions → Secrets): `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID`,
`PRONOUNCE_DAILY_LIMIT`, `PRONOUNCE_MONTHLY_CHAR_LIMIT` y `PRONOUNCE_ALLOWED_ORIGINS` (orígenes CORS
separados por comas; por defecto `http://localhost:4200`).

Pruebas de la lógica de la función (sin red): `node --test supabase/functions/pronounce/logic.test.ts`.
Despliegue: `supabase functions deploy pronounce` (con `verify_jwt` activo).

## Diseño y accesibilidad

- Tokens en [`shared/styles/`](src/app/shared/styles/): paleta índigo + coral con contraste
  verificado (texto ≥ 4.5:1, bordes de campos ≥ 3:1), modo claro/oscuro persistente.
- Animaciones según las skills de Emil Kowalski: solo `transform`/`opacity`, curvas propias,
  menos de 300 ms en la interfaz, `prefers-reduced-motion` respetado y sin animar acciones de teclado.
- HTML semántico, foco visible, diálogos nativos `<dialog>`, regiones `aria-live` y atajos de teclado
  en flashcards (Espacio, ←, →) y cuestionarios (1–4).

## Pendientes para el despliegue en Vercel

- [ ] Usar Node 24 LTS en Vercel (Project Settings → Node.js Version).
- [x] Comando de build `npm run build` y salida `dist/english-learning/browser`, definidos en `vercel.json`.
- [x] Fallback SPA para rutas sin extensión; las peticiones a archivos `.js`, `.css`, fuentes e imágenes
      no se convierten en `index.html` cuando falta el recurso.
- [ ] Decidir si la URL/clave publicable se inyectan por variables de entorno en tiempo de build
      (hoy están en `environment.ts`; son públicas por diseño).
- [ ] Activar CAPTCHA (Turnstile/hCaptcha) para el registro y el inicio de sesión, y revisar los límites de Auth.
- [ ] Configurar un SMTP propio si se mantiene _Confirm email_ (el integrado tiene un límite muy bajo).
- [ ] Definir la URL del sitio y las URLs de redirección en Authentication → URL Configuration.
- [ ] Decidir si se añade recuperación de contraseña (hoy no existe).
- [ ] Añadir el dominio de producción a `PRONOUNCE_ALLOWED_ORIGINS` (secreto de Edge Functions).
- [ ] Revisar `get_advisors` de Supabase (seguridad y rendimiento) antes de publicar.
- [ ] Verificar navegación directa y recarga en `/sets/:id`, `/review` y `/progress`.
- [ ] Probar en dispositivos reales (iOS Safari y Android Chrome): giro de tarjetas, teclado virtual, áreas seguras.

### Si aparece «Failed to load module script» con MIME `text/html`

Significa que una URL de JavaScript respondió con HTML. La configuración anterior devolvía
`index.html` incluso para archivos inexistentes y permitía conservar las respuestas `.js` un año.
La configuración actual limita el fallback a rutas sin extensión y exige revalidar HTML, JavaScript
y CSS. Consulta las reglas de [rewrites de Vercel](https://vercel.com/docs/project-configuration/vercel-json#rewrites).

Después de publicar este cambio, haz una recarga completa (`Ctrl + Shift + R`). Si persiste,
abre DevTools → Network, activa **Disable cache** y recarga. No es necesario borrar la sesión
ni el almacenamiento de Supabase. Un módulo válido debe responder `200` con un tipo MIME
JavaScript; un archivo inexistente debe responder `404`, sin devolver el HTML de la aplicación.
