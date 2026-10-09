# Executar o Verdi Tech Gestão com Docker

O Docker Compose inicia o site e o Google Maps Scraper juntos. O scraper fica
somente na rede interna do Compose; apenas o site fica publicado em `localhost`.

## Iniciar

Com o Docker Desktop aberto, na pasta do projeto execute:

```powershell
$env:Path = "C:\Program Files\Docker\Docker\resources\bin;$env:Path"
docker compose up --build -d
```

Abra <http://localhost:4174>. O primeiro início baixa as imagens necessárias e
pode levar alguns minutos.

## Parar e iniciar novamente

```powershell
$env:Path = "C:\Program Files\Docker\Docker\resources\bin;$env:Path"
docker compose stop
docker compose start
```

Para acompanhar os registros:

```powershell
$env:Path = "C:\Program Files\Docker\Docker\resources\bin;$env:Path"
docker compose logs -f app scraper
```

Os dados persistentes do scraper ficam no volume `scraper-data`. O arquivo
`.env` não é copiado para a imagem.

## Mudar a porta do site

Se a porta `4174` já estiver ocupada, defina `APP_PORT` antes de iniciar:

```powershell
$env:APP_PORT = "4176"
$env:Path = "C:\Program Files\Docker\Docker\resources\bin;$env:Path"
docker compose up --build -d
```

Depois acesse <http://localhost:4176>.

> O Compose é para Docker local ou um VPS com Docker. A Vercel não executa este
> conjunto de containers; para publicar o site lá, o scraper precisa continuar
> hospedado separadamente e a integração de produção deve usar HTTPS e acesso
> protegido.
