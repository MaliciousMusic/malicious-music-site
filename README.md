# Malicious Music — site

Site vitrine et de vente de Malicious Music :

- **Software** : plugin (VST probable) MP3 → stems mixés — formule unique à 59 €/mois.
- **Audioware** : gamme hardware Malicious Music, estampillée du logo Malicious Bass (la Pyramide platine/range-vinyles/enceinte, les écouteurs géants-enceintes, le casque expérimental sans recharge avec stockage intégré).

Site statique (HTML/CSS/JS, aucune dépendance).

## Pages

- `index.html` — accueil (software + Audioware + newsletter)
- `software.html` — le plugin, maquette interactive, fonctionnalités, tarif, FAQ
- `audioware.html` — la Pyramide, les Géants, le Casque + liste d'attente
- `legal.html` — mentions légales, CGV, confidentialité (à rédiger)

`assets/malicious-bass-logo.svg` est un logo **provisoire** : remplacer par le vrai logo Malicious Bass (même nom de fichier).
 Les contenus provisoires sont marqués avec la classe `.ph` (affichés en orange).

## Lancer en local

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000
