# Mes voyages

App perso pour choisir où partir, gérer nos envies de voyage et revoir nos voyages faits.
Interface en français, pensée pour l'iPhone et installable sur l'écran d'accueil.

- **Front** : Vite, React, TypeScript, `vite-plugin-pwa`
- **Données** : Notion (base « Destinations » et base « Envies de voyage »), lue et modifiée par des Netlify Functions
- **Hébergement** : Netlify

Le token Notion reste côté serveur. Le navigateur ne parle qu'aux fonctions `/api/voyages` et `/api/envies`, protégées par une phrase secrète.

## Mise en place

### 1. Créer l'intégration Notion

1. Va sur <https://www.notion.so/profile/integrations> et clique **Nouvelle intégration**.
2. Nom : `Mes voyages`. Espace de travail : celui du Planificateur de Voyage. Type : **Interne**.
3. Dans **Capacités**, coche *Lire le contenu*, *Mettre à jour le contenu* et *Insérer du contenu*. Les commentaires et les infos utilisateurs ne servent pas.
4. Enregistre, puis copie le **secret d'intégration interne** (il commence par `ntn_`). C'est la valeur de `NOTION_TOKEN`.

### 2. Partager le Planificateur avec l'intégration

1. Ouvre la page **Planificateur de Voyage** dans Notion.
2. Menu `•••` en haut à droite, puis **Connexions** et **Ajouter une connexion**, et choisis `Mes voyages`.
3. Les bases « Destinations » et « Envies de voyage » sont dans cette page, donc elles sont partagées avec elle.

Sans cette étape, les fonctions répondent « Notion ne trouve pas la base ».

### 3. Variables d'environnement sur Netlify

Dans Netlify : **Project configuration**, **Environment variables**, **Add a variable**.

| Variable | Valeur |
| --- | --- |
| `NOTION_TOKEN` | le secret `ntn_…` de l'étape 1 |
| `APP_PASSPHRASE` | une phrase longue, facile à taper sur le téléphone (par ex. quatre mots au hasard) |

Coche « Contains secret values » pour les deux. Ensuite, **Deploys**, puis **Trigger deploy**, pour que les fonctions les prennent en compte.

L'app demande la phrase secrète au premier lancement et la garde sur l'appareil. Pour la changer, modifie `APP_PASSPHRASE` sur Netlify et redéploie : les appareils redemanderont la nouvelle.

### 4. Réglages du site Netlify

`netlify.toml` les fournit déjà :

- Build command : `npm run build`
- Publish directory : `dist`
- Functions directory : `netlify/functions`

### 5. Installer sur l'iPhone

Ouvre le site dans Safari, bouton **Partager**, puis **Sur l'écran d'accueil**.

## Développement

```sh
npm install
npm test          # score, lecture/écriture Notion, phrase secrète
npm run dev       # front seul
npx netlify dev   # front + fonctions, avec NOTION_TOKEN et APP_PASSPHRASE dans un fichier .env
```

## Organisation

```
src/data/catalogue.ts     ~35 destinations : vol, prix, budget/jour, envies, saisonnalité, affluence
src/lib/score.ts          score sur 100 (fonction pure, testée)
src/lib/match.ts          rapprochement catalogue ↔ envies et voyages Notion
src/shared/types.ts       formes échangées entre les fonctions et l'app
netlify/lib/notion.ts     appels à l'API Notion (version 2026-03-11, data sources)
netlify/functions/        voyages.ts (GET), envies.ts (GET, POST, PATCH)
prototype/                prototype d'origine et directions visuelles
```

### Le score

Sur 100 : saison 32, envies 33, budget 20, durée par rapport au trajet 10, affluence 5.
Ajustements : −20 si la plage est le point fort alors qu'on n'en veut pas, −10 si aucune envie ne colle,
−15 si on y est déjà allés, +10 / +6 / +3 si c'est sur la liste d'envies (Très envie / Envie / Un jour).
