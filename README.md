# Malicious Music — site

Site vitrine et de vente de Malicious Music :

- **Software** : plugin (VST probable) MP3 → stems mixés — formule unique à 59 €/mois.
- **Audioware** : gamme hardware Malicious Music, estampillée du logo Malicious Bass (la Pyramide platine/range-vinyles/enceinte, les écouteurs géants-enceintes, le casque expérimental sans recharge avec stockage intégré).

Site statique (HTML/CSS/JS, aucune dépendance).

## Pages

- `index.html` — tout le site, présenté comme une console analogique néo-rétro : moniteur cathodique (accueil), schéma néon, façade de synthé interactive (le plugin), fenêtre glossy rouge (tarif), écran filaire orange avec les 3 produits en 3D (Audioware), FAQ, contact
- `legal.html` — mentions légales, CGV, confidentialité (à rédiger)

Tout est en HTML/CSS/JS : aucun rendu image, les produits en filaire sont dessinés en direct dans `main.js`.

`assets/malicious-bass-logo.png` : logo Malicious Bass (bar violet en dégradé, fond transparent), tiré de `~/Bureau/lonjaret/assets/logos/maliciousmusic/source-bass-degrade.png`.
 Les contenus provisoires sont marqués avec la classe `.ph` (affichés en orange).

## Lancer en local

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000
