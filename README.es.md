[ENGLISH](README.md) | **ESPAÑOL**
Mantenido por Criptonautas. Sin afiliación ni respaldo de la Ghost Foundation ni de DeepL.

# criptonautas-ghost-translate

El código que mantiene a en.criptonautas.co como gemelo en inglés de criptonautas.co. Divide un post de Ghost en bloques, los hashea, reutiliza las traducciones guardadas, revisa las nuevas y reescribe los enlaces internos. Corre dentro de nodos Code de n8n.

## Correr las pruebas

Requiere Node 24. No hay nada que instalar.

```bash
node --test
```

## Emitir un nodo Code

Esto imprime el cuerpo para pegar en un nodo Code de n8n:

```bash
node ghost-translate/emit-node.js prepare
```

Los nombres son `prepare`, `finish`, `payload`, `snapshot`, `search-doc` y `source-head`.

## Licencia

Código bajo [MIT](LICENSE). Texto de este README bajo [CC BY-NC-SA 4.0](CC-BY-NC-SA-4.0.txt).
