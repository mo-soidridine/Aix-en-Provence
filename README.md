# Aix-en-Provence est-elle bien desservie par les transports en commun ?

Carte interactive (webmapping) du **temps de marche entre chaque bâtiment d'Aix-en-Provence et l'arrêt de bus le plus proche** : 63 122 bâtiments, 883 arrêts.

## Résultats

| Temps de marche | Bâtiments | Part |
|---|---:|---:|
| 0-5 min | 50 377 | 79,8 % |
| 5-10 min | 6 787 | 10,8 % |
| 10-15 min | 3 099 | 4,9 % |
| 15-20 min | 1 529 | 2,4 % |
| > 20 min | 1 330 | 2,1 % |


## Méthodologie (résumé)

1. **Reprojection** de toutes les couches en RGF93 / Lambert-93 (EPSG:2154, mètres).
2. **Arrêt le plus proche** de chaque bâtiment grâce à un index spatial ; distance euclidienne entre le bord du bâtiment et l'arrêt.
3. **Temps de marche** = distance ÷ 84 m/min (≈ 5 km/h).
4. **Classes** : 0-5, 5-10, 10-15, 15-20, > 20 min.

### Limites

Distance à vol d'oiseau (et non sur le réseau piéton) ; desserte théorique sans fréquence ni horaires ; un bâtiment n'est pas un habitant ; vitesse de marche unique.

## Crédits

Arrêts : GTFS *mamp-aix*, Réseau urbain de la métropole Aix-Marseille · Bâtiments et limites communales : BD TOPO IGN · Carte : MapLibre GL JS.
