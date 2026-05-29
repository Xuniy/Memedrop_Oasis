# Memedrop Oasis

Memedrop Oasis est un MVP pour envoyer un texte, une image ou une courte video MP4 depuis Discord et le faire apparaitre en overlay sur les PC connectes.

## Architecture

```txt
Discord slash command
        |
        v
apps/server bot Discord
        |
        v
apps/server API + WebSocket relay
        |
        v
apps/overlay Electron app
        |
        v
Popup always-on-top
```

## Ce qui est deja cree

- Un bot Discord avec la commande `/drop`.
- Un serveur relais HTTP + WebSocket.
- Une app desktop Electron avec fenetre transparente always-on-top.
- Un panneau de configuration local dans l'app overlay.
- Des tokens simples pour proteger le relais.
- Le support texte, image PNG/JPG/WEBP/GIF et video MP4.

## Prerequis

- Node.js 20+.
- Un bot Discord cree dans le Discord Developer Portal.
- Pour packager l'app en `.exe`, tu installeras les dependances Electron avec `npm install`.

Rust n'est pas necessaire pour cette version, car le MVP utilise Electron.

## Installation locale

Depuis la racine du projet :

```bash
npm install
```

Copie l'exemple d'environnement :

```bash
copy apps\server\.env.example apps\server\.env
```

Remplis ensuite `apps/server/.env`.

## Configuration Discord

Dans le Discord Developer Portal :

1. Cree une application.
2. Va dans `Bot`, cree le bot et copie son token dans `DISCORD_TOKEN`.
3. Va dans `OAuth2`, copie l'`Application ID` dans `DISCORD_CLIENT_ID`.
4. Invite le bot dans ton serveur avec les scopes `bot` et `applications.commands`.
5. Pour un MVP, mets l'ID de ton serveur dans `DISCORD_GUILD_ID` pour enregistrer la commande rapidement.

Tu n'as pas besoin du Message Content Intent pour ce MVP, car on utilise une slash command.

## Lancer en dev

Terminal 1, serveur relais :

```bash
npm run dev:server
```

Terminal 2, enregistrer la commande Discord :

```bash
npm run register:commands
```

Terminal 3, bot Discord :

```bash
npm run dev:bot
```

Terminal 4, app overlay :

```bash
npm run dev:overlay
```

Dans l'app overlay, garde :

- Server URL: `http://localhost:8787`
- Client token: la valeur de `CLIENT_TOKEN`
- Room: `default`
- Position: au choix, dont `Top center`, `Center` et `Bottom center`
- Taille: petite, moyenne ou grande
- Son des videos: active si tu veux entendre les MP4
- Volume video: volume local de l'overlay

Puis dans Discord :

```txt
/drop text: coucou image: ton_image.png duration: 5
```

Ou avec une video :

```txt
/drop text: regarde ca video: clip.mp4 duration: 10
```

La video doit etre un MP4 de 10 MB maximum pour le MVP. L'overlay peut la lire avec son si `Son des videos` est active dans les reglages.

## Deployer sur Render

Le projet contient un `render.yaml` pour creer un seul Web Service Render qui lance a la fois :

- le serveur HTTP/WebSocket ;
- le bot Discord.

Sur le free tier Render, le service dort apres environ 15 minutes sans trafic entrant. Quand il dort, le bot Discord est offline. Il se reveille quand quelqu'un ouvre l'URL Render, appelle `/health`, ou quand l'app overlay tente une nouvelle connexion WebSocket. Le reveil prend environ une minute.

Important : une commande Discord `/drop` ne reveille pas toujours ce MVP si le bot est deja offline, car le bot actuel ecoute Discord via Gateway. Reveille d'abord le service avec l'URL Render, puis utilise `/drop`.

### Etapes Render

1. Pousse ce dossier sur GitHub.
2. Sur Render, clique `New` puis `Blueprint`.
3. Choisis le repo GitHub.
4. Render detecte `render.yaml` et cree le service `memedrop-oasis`.
5. Dans les variables d'environnement Render, remplis :

```txt
DISCORD_TOKEN=token_du_bot
DISCORD_CLIENT_ID=id_de_l_application
DISCORD_GUILD_ID=id_de_ton_serveur
ALLOWED_GUILD_ID=id_de_ton_serveur
```

`BOT_API_TOKEN` et `CLIENT_TOKEN` peuvent etre generes par Render. Copie la valeur de `CLIENT_TOKEN`, elle sera demandee dans l'app overlay.

6. Deploie le service.
7. Recupere l'URL publique Render, par exemple :

```txt
https://memedrop-oasis.onrender.com
```

8. Dans l'app overlay de tes potes, mets :

```txt
Server URL: https://memedrop-oasis.onrender.com
Client token: la valeur CLIENT_TOKEN de Render
Room: default
```

Chaque pote peut ensuite choisir sa position, sa taille de popup et son volume video dans l'app.

9. Enregistre la commande Discord depuis ton PC, une fois que `.env` contient tes IDs :

```bash
npm run register:commands
```

Ensuite, utilise `/drop` dans Discord. Pour activer l'option `video`, relance `npm run register:commands` apres avoir deploye ou tire la derniere version du code.

### Option plus fiable

Pour que le bot reste online 24/7, prends un service payant Render ou mets le bot en Background Worker payant. Sinon, en gratuit, accepte le fonctionnement "je reveille le service, puis ca marche".

## Tester sans Discord

Quand le serveur tourne, tu peux envoyer un drop avec PowerShell :

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:8787/api/drop `
  -Headers @{ Authorization = "Bearer dev-bot-token" } `
  -ContentType "application/json" `
  -Body '{"text":"Test depuis PowerShell","room":"default","durationMs":5000,"sender":"local"}'
```

## Limites normales du MVP

- Les overlays peuvent ne pas apparaitre au-dessus de certains jeux en fullscreen exclusif. Utilise le mode borderless/windowed fullscreen pour tester.
- Les images et videos Discord sont envoyees avec leur URL Discord. Pour une version publique, il faudra stocker les medias chez toi, par exemple S3, R2 ou Supabase Storage.
- Les videos MP4 sont limitees a 10 MB dans le bot pour garder le MVP rapide et compatible avec la limite Discord de base.
- Le token client est partage. Pour une vraie app publique, il faudra des comptes ou des codes d'invitation par groupe.

## Prochaines etapes conseillees

1. Ajouter une vraie gestion de groupes/rooms par serveur Discord.
2. Ajouter des cooldowns par utilisateur et par salon.
3. Ajouter un bouton mute plus pousse cote app.
4. Stocker les images sur ton propre storage.
5. Packager l'app Windows avec `npm run build:overlay`.
