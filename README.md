# Mes voyages

App perso pour choisir où partir, gérer nos envies de voyage et revoir nos voyages faits.
Interface en français, pensée pour l'iPhone et installable sur l'écran d'accueil.

- **Front** : Vite, React, TypeScript, `vite-plugin-pwa`
- **Données** : Notion (bases « Destinations », « Envies de voyage » et « Catalogue »), lues et modifiées par des Netlify Functions
- **Hébergement** : Netlify

Le token Notion reste côté serveur. Le navigateur ne parle qu'aux fonctions `/api/voyages`, `/api/envies` et `/api/catalogue`, protégées par une phrase secrète.

### Le catalogue

Les destinations que l'onglet Choisir classe sont dans la base Notion **Catalogue** (dans le Planificateur de Voyage). Pour en ajouter ou en corriger une, modifie-la dans Notion : l'app la prend au prochain chargement.

- **Mois idéaux / Mois corrects** : les mois non cochés comptent comme mauvaise saison.
- **Point fort** : l'envie principale du lieu ; **Envies** : les autres.
- **Vol direct** + **Mois du vol direct** (vide = toute l'année).
- **Moments forts** : une ligne par mois, par exemple « Septembre : grande migration ».
- **Sources** : d'où viennent les chiffres.

Dans « Envies de voyage », la colonne **Destination** relie une envie à une ligne du catalogue (sinon l'app essaie avec le nom, puis le pays). `src/data/catalogue.ts` garde une copie de secours pour le premier lancement hors ligne et les tests.

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
src/data/catalogue.ts     copie de secours du catalogue Notion (50 destinations)
src/lib/score.ts          score sur 100 (fonction pure, testée)
src/lib/match.ts          rapprochement catalogue ↔ envies et voyages Notion
src/shared/types.ts       formes échangées entre les fonctions et l'app
netlify/lib/notion.ts     appels à l'API Notion (version 2026-03-11, data sources)
netlify/functions/        voyages.ts (GET), envies.ts (GET, POST, PATCH), catalogue.ts (GET)
prototype/                prototype d'origine et directions visuelles
```

### Le score

Sur 100, chaque critère est gradué :

| Critère | Points | Comment |
| --- | --- | --- |
| Saison | 25 | idéale 25, correcte 12, mauvaise 0 (meilleur des mois choisis) |
| Envies | 25 | 20 au prorata des envies qui collent, +5 si le point fort du lieu en fait partie |
| Budget | 20 | plein dans le budget, −2 par tranche de 10 % de dépassement |
| Trajet | 10 | plein si on reste au moins 1,5 × les jours conseillés, 7 si c'est juste, moins en dessous |
| Calme | 10 | peu fréquenté 10, moyen 5, très fréquenté 0 |
| Ta liste | 10 | Très envie 8, Envie 5, Un jour 2, sans priorité 4 ; +2 « à faire avant les enfants » |

Pénalités : déjà fait −15, plage en point fort alors qu'on n'en veut pas −20, aucune envie ne colle −5,
très fréquenté avec « peu de monde » −5, paludisme avec enfants −12 (−5 si seulement une partie du pays).
