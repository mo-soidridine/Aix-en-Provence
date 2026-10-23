#!/usr/bin/env python3
"""Génère les données web (GeoJSON WGS84) à partir des shapefiles du projet QGIS.

Usage :
    python scripts/build_data.py <dossier_shapefiles> [dossier_sortie]

Fichiers attendus dans <dossier_shapefiles> (EPSG:2154) :
    Limites_aix_en_provence.shp, Arrêts_bus_Aix.shp, Temps de marche.shp
(Les noms accentués peuvent apparaître encodés « Arr#U00eats_... » selon l'archive.)

Étapes (cf. méthodologie) :
  1. tout est traité en Lambert-93 (EPSG:2154, mètres) ;
  2. distance (m) de chaque bâtiment à l'arrêt le plus proche (index spatial STRtree) ;
  3. temps de marche = distance / 84 m·min⁻¹ ;
  4. classes 0-5 / 5-10 / 10-15 / 15-20 / >20 min (bornes supérieures incluses, comme pd.cut) ;
  5. export en WGS84, géométries simplifiées (0,3 m) et coordonnées arrondies (6 décimales).
"""
import glob, json, sys, os
import numpy as np, geopandas as gpd
from shapely import STRtree

SPEED = 84.0                     # m/min (≈ 5 km/h)
BINS = [-np.inf, 5, 10, 15, 20, np.inf]
LABELS = ["0-5 min", "5-10 min", "10-15 min", "15-20 min", "> 20 min"]

def find(folder, *keys):
    for f in glob.glob(os.path.join(folder, "*.shp")):
        n = os.path.basename(f).lower()
        if all(k in n for k in keys):
            return f
    sys.exit(f"Shapefile introuvable : {keys}")

def main(src, out="data"):
    os.makedirs(out, exist_ok=True)
    lim = gpd.read_file(find(src, "limites")).to_crs(2154)
    stops = gpd.read_file(find(src, "bus")).to_crs(2154).reset_index(drop=True)
    bat = gpd.read_file(find(src, "temps")).to_crs(2154).reset_index(drop=True)
    bat = bat[["type", "Surface", "geometry"]].copy()
    bat["geometry"] = bat.geometry.force_2d() if hasattr(bat.geometry, "force_2d") else bat.geometry

    # 2. plus proche arrêt (distance bord de bâtiment → arrêt)
    tree = STRtree(stops.geometry.values)
    idx, dist = tree.query_nearest(bat.geometry.values, return_distance=True, all_matches=False)
    d = np.zeros(len(bat)); s = np.zeros(len(bat), dtype=int)
    d[idx[0]] = dist; s[idx[0]] = idx[1]
    # 3-4. temps + classes
    t = d / SPEED
    c = np.digitize(t, BINS[1:-1], right=True)
    bat["d"] = d.round().astype(int); bat["t"] = t.round(1); bat["c"] = c; bat["a"] = s

    # statistiques
    st = {"n_batiments": int(len(bat)), "n_arrets": int(len(stops)),
          "vitesse_m_min": SPEED, "mediane_min": round(float(np.median(t)), 2),
          "moyenne_min": round(float(t.mean()), 2), "classes": []}
    tot_s = bat.Surface.sum()
    for k, lab in enumerate(LABELS):
        m = c == k
        st["classes"].append({"label": lab, "n": int(m.sum()), "pct": round(100*m.mean(), 1),
                              "pct_surface": round(100*bat.Surface[m].sum()/tot_s, 1)})
    json.dump(st, open(f"{out}/stats.json", "w"), ensure_ascii=False, indent=1)

    # 5. export WGS84
    bat["geometry"] = bat.geometry.simplify(0.3, preserve_topology=True)
    b = bat[["t", "d", "c", "a", "geometry"]].to_crs(4326)
    b.to_file(f"{out}/batiments.geojson", driver="GeoJSON", COORDINATE_PRECISION=6)
    sg = stops[["stop_name", "city_name", "geometry"]].rename(columns={"stop_name": "n", "city_name": "v"}).to_crs(4326)
    sg.to_file(f"{out}/arrets.geojson", driver="GeoJSON", COORDINATE_PRECISION=6)
    lim[["geometry"]].to_crs(4326).to_file(f"{out}/limites.geojson", driver="GeoJSON", COORDINATE_PRECISION=6)
    for f in ("batiments", "arrets", "limites"):      # minification (-30 %)
        fp = f"{out}/{f}.geojson"
        json.dump(json.load(open(fp)), open(fp, "w"), separators=(",", ":"), ensure_ascii=False)
    print(json.dumps(st, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "data")
