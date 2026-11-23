# Malicious Music — site

Site vitrine et de vente de Malicious Music :

- **Software** : plugin (VST probable) MP3 → stems mixés — formule unique à 59 €/mois.
- **Audioware** : gamme hardware Malicious Music, estampillée du logo Malicious Bass (la Pyramide platine/range-vinyles/enceinte, les écouteurs géants-enceintes, le casque expérimental sans recharge avec stockage intégré).

Site statique (HTML/CSS/JS, aucune dépendance).

## Structure

Tout le site est un seul appareil : un cadre en métal brossé avec un écran LCD au centre (`index.html`).

- Les boutons du cadre (ACCUEIL, PLUGIN, TARIF, AUDIOWARE, FAQ, CONTACT, flèches, POWER) changent ce que l'écran affiche. Chaque page a son adresse (`#plugin`, `#tarif`, `#pyramide`…).
- À l'ouverture, l'écran s'allume : rétroéclairage, logo, titre MALICIOUSMUSIC, barre de chargement (un clic passe le splash).
- Tout ce qui est dans l'écran est en HTML/CSS/JS, sans image : spectre, stems et produits en filaire 3D sont dessinés en direct dans `main.js`.
- Les contenus provisoires sont entre crochets, en gris (classe `.ph`).

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


## Traductions (21 langues)

Le français du HTML est la langue source. `i18n.js` traduit au chargement tous les textes et les attributs accessibles (`aria-label`, `alt`, `placeholder`), choisit la langue du navigateur (ou celle mémorisée via le sélecteur de la barre de statut) et met à jour `<html lang>`.

Après toute modification de texte :

```bash
python3 tools/i18n_extract.py   # régénère i18n/_source.json
python3 tools/i18n_check.py     # liste les chaînes manquantes par langue
```

Puis compléter les `i18n/<code>.json` (clé = texte français exact, valeur = traduction). Une chaîne absente s'affiche en français. Les éléments `translate="no"` (marques) ne sont pas traduits.

## Sécurité et confidentialité

- CSP stricte (aucune ressource tierce, script inline autorisé par empreinte), anti-clickjacking, HTTPS forcé par GitHub Pages.
- Polices hébergées sur le site, aucun cookie, aucun traceur ; seule la langue choisie est gardée en `localStorage`.
- Démo audio synthétisée localement (Web Audio), rien n'est envoyé.
- Textes légaux (mentions, CGV, CGU, confidentialité, cookies) dans la vue `#legal` : les crochets `[…]` sont à compléter avec les informations de la société, puis à faire valider par un juriste.
