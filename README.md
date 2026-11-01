[ESPAÑOL](README.es.md) | **ENGLISH**
Maintained by Criptonautas. Not affiliated with or endorsed by the Ghost Foundation or DeepL.

# criptonautas-ghost-translate

Keeps a second Ghost site as a translated twin of the first one, through n8n and DeepL. It runs in production on [criptonautas.co](https://criptonautas.co) and [en.criptonautas.co](https://en.criptonautas.co).

- Translates only the blocks that changed, so an edit does not pay for the whole post again.
- Keeps hand edits made on the translated site, until the source block changes.
- Rejects a translation that changes tags or links, instead of publishing it.
- Rewrites internal links and adds `hreflang` on both sites.
- Copies the visibility of each post: paid posts stay paid, and their text stays out of the search index.
- Unpublishes or deletes the twin only after the source Ghost confirms it.

## What you need

- n8n with Data Tables, and `crypto` allowed in Code nodes (`NODE_FUNCTION_ALLOW_BUILTIN=crypto`).
- Two Ghost sites, with an Admin API key for each. Use an empty target: this does not adopt posts that already exist there.
- A DeepL API key. Free keys use `https://api-free.deepl.com`, paid keys `https://api.deepl.com`.
- Node 24, to build the workflows.
- Optional: Typesense for search, and a cover service for covers with the title drawn on them.

## Install

1. In n8n, create a Data Table named `ghost_translations` with these string columns: `slug`, `type`, `state`, `en_id`, `en_slug`, `source_id`. Keep its id.
2. Create the credentials with these names, so the nodes find them. The first three are required:

   | Name | Type |
   |---|---|
   | `source-ghost-admin` | Ghost Admin API, source site |
   | `target-ghost-admin` | Ghost Admin API, target site |
   | `deepl` | DeepL API |
   | `typesense-source-write`, `typesense-target-write` | Header Auth, `X-TYPESENSE-API-KEY` |
   | `cover-service-token` | Header Auth |

3. Create the config and a random webhook path:

   ```bash
   cp config.example.json config.json
   openssl rand -hex 16
   ```

   Put the result in `webhook_path`, then fill in your URLs, languages and `data_table_id`. `config.json` and `build/` are ignored by git.
4. Build, and import what comes out of `build/` into n8n:

   ```bash
   node ghost-translate/build-workflows.js
   ```

5. Copy the ids of the imported workflows into `translate_post_workflow_id` and `search_index_workflow_id`, build again and import `ghost-translate-sync` and `ghost-translate-batch`.
6. Try it before going live. Run `ghost-translate-batch` by hand: a manual run is a dry run over 3 posts. It writes nothing to Ghost, but it does spend DeepL characters.
7. For the first real run, set `dry_run` to `false` and `limit` to `0` in its Settings node. Check your DeepL quota first: this translates the whole site.
8. Publish `ghost-translate-post`, `ghost-translate-sync` and `ghost-translate-batch`.
9. In the source Ghost, under a custom integration, add one webhook per event:

   `post.published`, `post.published.edited`, `post.unpublished`, `post.deleted`, `page.published`, `page.published.edited`, `page.unpublished`, `page.deleted`

   ```text
   https://YOUR-N8N/webhook/YOUR_WEBHOOK_PATH?event=post.published
   ```

The batch also runs every day at 05:30, to catch anything a webhook missed. Runs where nothing changed spend no DeepL characters.

## Options

| Key | Effect |
|---|---|
| `deepl_glossary_id` | Uses a DeepL glossary. |
| `typesense_url`, `typesense_source_collection`, `typesense_target_collection` | Keeps both search collections current. Empty turns those nodes off. Without search you can also skip `search_index_workflow_id`. |
| `cover_service_url`, `cover_default_category` | Draws a new cover for images named `cover.webp` or `cover.png` (or `cover-1.webp`). Empty shares every image by URL. |
| `skip_slugs`, `skip_title_regex` | Posts that are never translated. |
| `allow_lost` | Per post, the inline tags a translation may lose, as in `{"my-post": ["s"]}`. |
| `error_workflow_id` | Your n8n error workflow. Set one: without it, failures are silent. |

## Security and limits

- **The webhook has no signature.** Its random path is the only thing hiding it, so keep it private. A forged request cannot delete or unpublish anything, because the source Ghost has the last word, but it can start executions.
- **Gated text goes to DeepL**, like any other text. Exclude those posts with `skip_slugs` if that is a problem.
- **Tiers:** a post gated by tier needs a tier with the same slug on the target, or Ghost refuses the write and the run fails. Members are not shared between the two sites.
- **Authors** are not copied: Ghost assigns the target post to the owner of the API key.
- **Search rebuild:** the manual rebuild of `ghost-search-index` reads up to 100 posts and 100 pages, and refuses to delete below 20 documents.
- Node names say Spanish and English because that is the production pair. Any pair DeepL supports works.

## Development

There is nothing to install.

```bash
node --test
node ghost-translate/emit-node.js prepare
```

`emit-node.js` prints a Code node body. To refresh the templates from raw n8n exports, which never enter this repository:

```bash
node ghost-translate/export-workflows.js PATH_TO_RAW_EXPORTS
```

## License

Code under [MIT](LICENSE). Text of this README under [CC BY-NC-SA 4.0](CC-BY-NC-SA-4.0.txt).
