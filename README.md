# Gestaoleads

## Busca de leads no Render

- Configure `GOOGLE_MAPS_SCRAPER_URL` com a URL real do serviço do scraper (não deixe o valor vazio).
- Configure `SUPABASE_SERVICE_ROLE_KEY` somente nas variáveis privadas do Render para permitir o cadastro de funcionários. Nunca publique essa chave no Git ou no navegador.
- O modo padrão é `fast`: consulta atual ao Google Maps, sem abrir Chromium, com até 21 resultados por consulta e campos possivelmente incompletos. Não é uma lista salva nem uma garantia de todas as empresas da cidade.
- Cidade e UF são obrigatórios. A localização aproximada é calculada com a malha municipal oficial do [IBGE](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3). Somente essa geografia é mantida em cache por 24 horas; resultados comerciais são consultados de novo em cada pesquisa.
- Os resultados podem incluir empresas próximas ou relacionadas. Confira o endereço e o link do Maps antes de importar um lead.
- No scraper, use `google-maps-scraper -web -addr :10000 -data-folder /tmp/gmapsdata -c 1`.
- `GOOGLE_MAPS_SCRAPER_MODE=full` reativa o modo Chromium para servidores com mais memória. O modo completo ultrapassou os 512 MB do Render Free nos testes reais; apenas aumentar o tempo de espera não resolve essa queda.
- O serviço gratuito pode hibernar. O site acorda o scraper antes de criar a busca e tenta novamente consultas de andamento quando há falhas transitórias, sem criar trabalhos duplicados.

Testes: `node --test tests/*.test.mjs`.

