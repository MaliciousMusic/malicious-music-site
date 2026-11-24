# Malicious Music — site

Site vitrine de Malicious Music (rien en vente pour l'instant) :

- **Software** : plugin (VST probable) MP3 → stems mixés — à venir, tarif prévu 59 €/mois.
- **Audioware** : gamme hardware Malicious Music, estampillée du logo Malicious Bass (la Pyramide platine/range-vinyles/enceinte, les écouteurs géants-enceintes, le casque expérimental sans recharge avec stockage intégré).

Site statique (HTML/CSS/JS, aucune dépendance).

## Structure

Tout le site est un seul appareil : un cadre en métal brossé avec un écran LCD au centre (`index.html`).

- Les boutons du cadre (ACCUEIL, PLUGIN, TARIF, AUDIOWARE, FAQ, CONTACT, flèches, POWER) changent ce que l'écran affiche. Chaque page a son adresse (`#plugin`, `#tarif`, `#pyramide`…).
- À l'ouverture, l'écran s'allume : rétroéclairage, logo, titre MALICIOUSMUSIC, barre de chargement (un clic passe le splash).
- Tout ce qui est dans l'écran est en HTML/CSS/JS, sans image : spectre, stems et produits en filaire 3D sont dessinés en direct dans `main.js`.
- Ce qui n'est pas prêt est marqué « À VENIR », en gris (classe `.ph`) ; aucun texte entre crochets.

`assets/malicious-bass-logo.png` : logo Malicious Bass (bar violet en dégradé, fond transparent), tiré de `~/Bureau/lonjaret/assets/logos/maliciousmusic/source-bass-degrade.png`.
 

## Lancer en local

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000

## Pièces 3D (Blender)

Les boutons ronds, la molette, le potard, le bouton POWER, les touches et la plaque de métal du châssis sont rendus dans Blender (`assets/hw/`).

- Script : `design/blender/parts.py` (modélise et rend chaque pièce, fond transparent)
- Éclairage : HDRI studio Poly Haven (CC0), à placer dans `design/hdri/studio_small_09_1k.hdr` (non versionné)

```bash
blender -b -P design/blender/parts.py              # toutes les pièces
blender -b -P design/blender/parts.py -- jog knob  # seulement certaines
```


## Traductions (22 langues : le français et 21 traductions)

Le français du HTML est la langue source. `i18n.js` traduit au chargement tous les textes et les attributs accessibles (`aria-label`, `alt`, `placeholder`), choisit la langue du navigateur (ou celle mémorisée via le sélecteur de la barre de statut) et met à jour `<html lang>`.

Après toute modification de texte :

```bash
python3 tools/i18n_extract.py   # régénère i18n/_source.json
python3 tools/i18n_check.py     # liste les chaînes manquantes par langue
```

Puis compléter les `i18n/<code>.json` et incrémenter `DICT_V` dans `i18n.js` (clé = texte français exact, valeur = traduction). Une chaîne absente s'affiche en français. Les éléments `translate="no"` (marques) ne sont pas traduits.

## Sécurité et confidentialité

- CSP stricte (ni script ni style en ligne, aucune ressource tierce, Trusted Types), la même dans la page et dans `cloudflare/_headers`.
- Polices hébergées sur le site, aucun cookie, aucun traceur ; seule la langue choisie est gardée en `localStorage`.
- Démo audio synthétisée localement (Web Audio), rien n'est envoyé.
- Rien n'est en vente : boutons d'achat et formulaire désactivés.
- Textes légaux (mentions, CGV, CGU, confidentialité, cookies) dans la vue `#legal` : l'identité (`data-id`) vient de `cloudflare/site.json` à la construction ; textes à faire valider par un juriste.

## Construction et tests

```bash
python3 tools/build.py --draft        # aperçu dans dist/, interdit à l'indexation
python3 tools/build.py                # production : refusée si un texte légal est incomplet
node --test tests/site.test.mjs       # lecture : scripts, textes, traductions, secrets
node --test tests/served.test.mjs     # site servi (wrangler pages dev) et Chrome
```

`dist/` ne contient que les fichiers du site (liste blanche). `cloudflare/site.json` : domaine, contact et échéance de `security.txt`, date des textes, identité légale.
