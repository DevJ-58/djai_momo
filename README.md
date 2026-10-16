# djai_momo

Application web progressive (PWA) de simulation et de suivi d’enregistrements, conçue pour un usage principalement mobile. Les données manipulées sont fictives et destinées à une étude ; ne saisissez jamais de données réelles de clients.

## Rôles

- **Agent** : consulte ses enregistrements fictifs, en ajoute et suit leurs statuts et notifications.
- **Administrateur** : consulte les indicateurs, gère les comptes d’agents (dont la suspension et le numéro WhatsApp) et les enregistrements.

L’accès aux pages et opérations est contrôlé par l’application et par les règles de sécurité configurées dans Supabase. L’interface ne permet pas à un agent de modifier son rôle.

## Stack technique

- React 18, TypeScript et Vite
- Tailwind CSS et styles applicatifs glassmorphism
- React Router et TanStack Query
- Supabase Auth, Postgres et Realtime
- vite-plugin-pwa / Workbox
- Vitest

## Installation et développement

Prérequis : Node.js compatible avec les dépendances du projet et npm.

```sh
npm install
```

Copiez `.env.example` vers `.env`, puis renseignez les valeurs fournies par le projet Supabase :

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Ces variables sont nécessaires au client web. N’y placez jamais une clé `service_role`, un mot de passe ou une autre clé privée.

```sh
npm run dev
```

L’application de développement est généralement disponible sur `http://localhost:5173`.

## Scripts npm

| Commande | Description |
|---|---|
| `npm run dev` | Démarre Vite en mode développement. |
| `npm run build` | Exécute la vérification TypeScript puis génère le build de production dans `dist/`. |
| `npm run preview` | Sert localement le build de production. |
| `npm test` | Exécute les tests Vitest. |

## Structure principale

```text
public/                 Icônes PWA, favicon et robots.txt
src/
  components/           Composants d’interface, navigation, auth, exports
  hooks/                Hooks d’authentification, requêtes et mutations
  lib/                  Client Supabase, validation, formatage et exports
  pages/                Pages publiques, espace agent et espace admin
  types/                Types du domaine et de l’interface
  main.tsx              Routage, fournisseurs globaux et chargement différé
  styles.css            Styles globaux et responsive
index.html              Document HTML de la PWA
vite.config.ts          Build, découpage des chunks et service worker
vercel.json             Réécritures SPA et en-têtes HTTP
```

La page `/design-system` est réservée au développement et n’est pas incluse dans la production.

## Résumé du schéma Supabase attendu

L’application se connecte au projet Supabase déjà configuré ; elle ne crée ni ne modifie le schéma à l’exécution.

- `profiles` : profil lié à l’utilisateur Auth, avec `id`, `full_name`, `whatsapp`, `role`, `is_suspended` et `created_at`. Les rôles utilisés sont `agent` et `admin`.
- `registrations` : enregistrements simulés associés à un agent, avec e-mail et mot de passe fictifs, numéro séquentiel, statut, montant, note, dates de confirmation et d’export.
- `notifications` : notifications associées à un utilisateur, avec titre, contenu, référence éventuelle à un enregistrement et date de lecture.
- Fonctions RPC d’administration : `admin_stats`, `admin_agents_overview` et `admin_daily_registrations`. Les vues et fonctions de suivi des statuts sont celles déjà déployées avec le projet.

Les politiques RLS et fonctions SQL existantes restent la source d’autorité pour les droits d’accès. Aucun changement de base n’est requis par ce dépôt.

## Créer le compte administrateur

1. Créez le compte avec le parcours d’inscription normal de l’application et confirmez l’adresse e-mail si cette option est activée dans Supabase Auth.
2. Depuis le **Supabase Dashboard** du projet, vérifiez que le profil correspondant existe dans `profiles`.
3. Un propriétaire du projet ou un administrateur déjà autorisé attribue le rôle `admin` à ce profil au moyen de l’outil d’administration approuvé du projet.
4. Déconnectez-vous puis reconnectez-vous pour charger le rôle et accéder à `/admin`.

Le rôle ne peut pas être choisi depuis le formulaire d’inscription. Ne transmettez jamais de clé privée au navigateur.

## Données fictives

Tous les e-mails, mots de passe, montants et enregistrements saisis dans le cadre de l’étude doivent être fictifs. Les enregistrements de cette application ne doivent pas contenir les identifiants d’un compte ou les données d’une personne réelle.

## Déploiement sur Vercel

1. Importez le dépôt dans Vercel et laissez la détection Vite utiliser `npm run build` comme commande de build et `dist` comme répertoire de sortie.
2. Dans les variables d’environnement du projet Vercel, définissez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` avec les valeurs client du projet Supabase. N’ajoutez aucune clé `service_role`.
3. Dans les réglages Supabase Auth, autorisez le domaine de production Vercel et configurez les URL de redirection utilisées par l’authentification, notamment `/connexion` et `/reinitialiser-mot-de-passe`.
4. Déployez et vérifiez les routes en accès direct, l’installation PWA, le flux de récupération du mot de passe et les règles de sécurité des en-têtes définies dans `vercel.json`.
5. Pour tester le build localement :

   ```sh
   npm run build
   npm run preview
   ```

Les mises à jour PWA sont proposées à l’utilisateur ; les requêtes vers le domaine Supabase sont exclues du cache du service worker.
