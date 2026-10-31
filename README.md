[ESPAÑOL](README.es.md) | **ENGLISH**
Maintained by Criptonautas. Not affiliated with or endorsed by the Ghost Foundation or DeepL.

# criptonautas-ghost-translate

The code that keeps en.criptonautas.co as an English twin of criptonautas.co. It splits a Ghost post into blocks, hashes them, reuses stored translations, checks new ones and rewrites internal links. It runs inside n8n Code nodes.

## Run the tests

Needs Node 24. There is nothing to install.

```bash
node --test
```

## Emit a Code node

This prints the body to paste into an n8n Code node:

```bash
node ghost-translate/emit-node.js prepare
```

The names are `prepare`, `finish`, `payload`, `snapshot`, `search-doc` and `source-head`.

## License

Code under [MIT](LICENSE). Text of this README under [CC BY-NC-SA 4.0](CC-BY-NC-SA-4.0.txt).
