[ENGLISH](README.md) | **ESPAÑOL**
Mantenido por Criptonautas. Sin afiliación ni respaldo de la Ghost Foundation ni de DeepL.

# criptonautas-ghost-translate

Mantiene un segundo sitio Ghost como gemelo traducido del primero, con n8n y DeepL. Corre en producción en [criptonautas.co](https://criptonautas.co) y [en.criptonautas.co](https://en.criptonautas.co).

- Traduce solo los bloques que cambiaron, así que una edición no vuelve a pagar el post entero.
- Conserva las ediciones a mano del sitio traducido, hasta que cambie el bloque original.
- Rechaza una traducción que altere etiquetas o enlaces, en lugar de publicarla.
- Reescribe los enlaces internos y agrega `hreflang` en los dos sitios.
- Copia la visibilidad de cada post: lo pago sigue pago y su texto queda fuera del índice de búsqueda.
- Despublica o borra el gemelo solo después de que el Ghost de origen lo confirma.

## Qué necesitas

- n8n con Data Tables y `crypto` permitido en los nodos Code (`NODE_FUNCTION_ALLOW_BUILTIN=crypto`).
- Dos sitios Ghost, con una clave de Admin API para cada uno. Usa un destino vacío: esto no adopta posts que ya existan allí.
- Una clave de la API de DeepL. Las gratuitas usan `https://api-free.deepl.com` y las de pago `https://api.deepl.com`.
- Node 24, para construir los workflows.
- Opcional: Typesense para la búsqueda y un servicio de portadas para dibujar el título sobre ellas.

## Instalación

1. En n8n, crea una Data Table llamada `ghost_translations` con estas columnas de texto: `slug`, `type`, `state`, `en_id`, `en_slug`, `source_id`. Guarda su id.
2. Crea las credenciales con estos nombres, para que los nodos las encuentren. Las tres primeras son obligatorias:

   | Nombre | Tipo |
   |---|---|
   | `source-ghost-admin` | Ghost Admin API, sitio de origen |
   | `target-ghost-admin` | Ghost Admin API, sitio de destino |
   | `deepl` | DeepL API |
   | `typesense-source-write`, `typesense-target-write` | Header Auth, `X-TYPESENSE-API-KEY` |
   | `cover-service-token` | Header Auth |

3. Crea la configuración y una ruta aleatoria para el webhook:

   ```bash
   cp config.example.json config.json
   openssl rand -hex 16
   ```

   Pon el resultado en `webhook_path` y completa tus URL, idiomas y `data_table_id`. Git ignora `config.json` y `build/`.
4. Construye e importa en n8n lo que salga en `build/`:

   ```bash
   node ghost-translate/build-workflows.js
   ```

5. Copia los ids de los workflows importados en `translate_post_workflow_id` y `search_index_workflow_id`, construye de nuevo e importa `ghost-translate-sync` y `ghost-translate-batch`.
6. Pruébalo antes de activarlo. Ejecuta `ghost-translate-batch` a mano: una ejecución manual es una prueba en seco sobre 3 posts. No escribe en Ghost, pero sí gasta caracteres de DeepL.
7. Para la primera pasada real, pon `dry_run` en `false` y `limit` en `0` en su nodo Settings. Revisa antes tu cuota de DeepL: esto traduce todo el sitio.
8. Publica `ghost-translate-post`, `ghost-translate-sync` y `ghost-translate-batch`.
9. En el Ghost de origen, dentro de una integración personalizada, agrega un webhook por evento:

   `post.published`, `post.published.edited`, `post.unpublished`, `post.deleted`, `page.published`, `page.published.edited`, `page.unpublished`, `page.deleted`

   ```text
   https://TU-N8N/webhook/TU_WEBHOOK_PATH?event=post.published
   ```

El batch además corre todos los días a las 05:30, para recoger lo que un webhook haya perdido. Las pasadas sin cambios no gastan caracteres de DeepL.

## Opciones

| Clave | Efecto |
|---|---|
| `deepl_glossary_id` | Usa un glosario de DeepL. |
| `typesense_url`, `typesense_source_collection`, `typesense_target_collection` | Mantiene al día las dos colecciones de búsqueda. Vacío apaga esos nodos. Sin búsqueda también puedes omitir `search_index_workflow_id`. |
| `cover_service_url`, `cover_default_category` | Dibuja una portada nueva para imágenes llamadas `cover.webp` o `cover.png` (o `cover-1.webp`). Vacío comparte todas las imágenes por URL. |
| `skip_slugs`, `skip_title_regex` | Posts que nunca se traducen. |
| `allow_lost` | Por post, las etiquetas en línea que una traducción puede perder, como `{"mi-post": ["s"]}`. |
| `error_workflow_id` | Tu workflow de errores de n8n. Configura uno: sin él, los fallos pasan en silencio. |

## Seguridad y límites

- **El webhook no tiene firma.** Su ruta aleatoria es lo único que lo oculta, así que mantenla privada. Una petición falsa no puede borrar ni despublicar nada, porque decide el Ghost de origen, pero sí puede iniciar ejecuciones.
- **El texto restringido va a DeepL**, como cualquier otro. Excluye esos posts con `skip_slugs` si es un problema.
- **Tiers:** un post restringido por tier necesita un tier con el mismo slug en el destino; si no, Ghost rechaza la escritura y la ejecución falla. Los miembros no se comparten entre los dos sitios.
- **Autores:** no se copian. Ghost asigna el post de destino al dueño de la clave de API.
- **Reconstrucción de la búsqueda:** la reconstrucción manual de `ghost-search-index` lee hasta 100 posts y 100 páginas, y se niega a borrar con menos de 20 documentos.
- Los nodos dicen Spanish y English porque ese es el par en producción. Funciona con cualquier par que admita DeepL.

## Desarrollo

No hay nada que instalar.

```bash
node --test
node ghost-translate/emit-node.js prepare
```

`emit-node.js` imprime el cuerpo de un nodo Code. Para actualizar las plantillas desde exports crudos de n8n, que nunca entran a este repositorio:

```bash
node ghost-translate/export-workflows.js RUTA_A_LOS_EXPORTS
```

## Licencia

Código bajo [MIT](LICENSE). Texto de este README bajo [CC BY-NC-SA 4.0](CC-BY-NC-SA-4.0.txt).
