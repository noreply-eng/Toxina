"""
SONOTOX — Script de preparación automática para Blender 4.x (Z-Anatomy -> facial-muscles.glb)

Uso en Blender:
1. Abre el archivo .blend de Z-Anatomy (https://github.com/Lluis-V/Z-Anatomy).
2. Ve a la pestaña "Scripting", abre o pega este archivo y presiona "Run Script".
3. El script:
   - Selecciona únicamente músculos de la mímica facial, masticadores, platisma y cráneo/mandíbula.
   - Limpia sufijos redundantes (.001) y normaliza nombres de mallas para auto-mapeo en SonoTox.
   - Aplica transformaciones (Location/Rotation/Scale) y centra el pivote de la cabeza en (0, 0, 0).
   - Exporta un archivo `facial-muscles.glb` con compresión Draco lista para subir al Admin 3D.

Licencia del modelo derivado:
Z-Anatomy / BodyParts3D se distribuye bajo CC BY-SA 4.0. Conserva la atribución en el Studio Admin.
"""

import os
import re
import bpy
from mathutils import Vector

# Ruta de salida (ajusta si deseas otra carpeta)
OUTPUT_PATH = os.path.join(os.path.expanduser("~"), "Desktop", "facial-muscles.glb")

# Patrones (regex case-insensitive) de mallas a CONSERVAR
KEEP_MUSCLE_PATTERNS = [
    r"frontal|occipitofrontalis",
    r"corrugator",
    r"procerus",
    r"depressor[_\s.-]*supercil",
    r"orbicularis[_\s.-]*ocul",
    r"nasalis|depressor[_\s.-]*septi",
    r"levator[_\s.-]*labii",
    r"zygomaticus",
    r"levator[_\s.-]*anguli",
    r"buccinator",
    r"risorius",
    r"orbicularis[_\s.-]*oris",
    r"depressor[_\s.-]*anguli",
    r"depressor[_\s.-]*labii",
    r"mentalis",
    r"masseter",
    r"temporalis|temporal[_\s.-]*muscle",
    r"pterygoid",
    r"platysma",
    r"occipitalis",
]

KEEP_BONE_PATTERNS = [
    r"skull|cranium|frontal[_\s.-]*bone|parietal|temporal[_\s.-]*bone",
    r"zygomatic[_\s.-]*bone|maxilla|mandible|nasal[_\s.-]*bone|sphenoid|ethmoid|lacrimal|vomer|occipital[_\s.-]*bone",
    r"teeth|tooth|incisor|canine|premolar|molar",
]


def matches_any(name: str, patterns: list[str]) -> bool:
    return any(re.search(pat, name, re.IGNORECASE) for pat in patterns)


def normalize_mesh_name(raw_name: str, is_bone: bool) -> str:
    clean = re.sub(r"\.\d{3}$", "", raw_name.strip())
    clean = re.sub(r"[\s\-]+", "_", clean)
    if is_bone and not clean.lower().startswith("skull_"):
        clean = f"Skull_{clean}"
    return clean


def run_export():
    bpy.ops.object.select_all(action="DESELECT")

    kept_objects = []
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        is_muscle = matches_any(obj.name, KEEP_MUSCLE_PATTERNS)
        is_bone = (not is_muscle) and matches_any(obj.name, KEEP_BONE_PATTERNS)
        if is_muscle or is_bone:
            obj.hide_viewport = False
            obj.hide_render = False
            obj.name = normalize_mesh_name(obj.name, is_bone)
            obj.select_set(True)
            kept_objects.append(obj)

    if not kept_objects:
        print("[SONOTOX] No se encontraron mallas coincidentes. Revisa los nombres en el Outliner.")
        return

    print(f"[SONOTOX] Seleccionadas {len(kept_objects)} mallas (músculos + cráneo).")

    # Aplicar rotaciones y escalas manteniendo jerarquía limpia
    bpy.context.view_layer.objects.active = kept_objects[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    # Calcular centroide global para centrar la cabeza cerca del origen
    min_v = Vector((1e9, 1e9, 1e9))
    max_v = Vector((-1e9, -1e9, -1e9))
    for obj in kept_objects:
        for corner in obj.bound_box:
            world_c = obj.matrix_world @ Vector(corner)
            min_v.x = min(min_v.x, world_c.x)
            min_v.y = min(min_v.y, world_c.y)
            min_v.z = min(min_v.z, world_c.z)
            max_v.x = max(max_v.x, world_c.x)
            max_v.y = max(max_v.y, world_c.y)
            max_v.z = max(max_v.z, world_c.z)

    center = (min_v + max_v) * 0.5
    for obj in kept_objects:
        obj.location -= center

    # Exportar solo selección a glTF Binary (.glb) con compresión Draco
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_materials="EXPORT",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
    )
    print(f"[SONOTOX] Exportación completada: {OUTPUT_PATH}")


if __name__ == "__main__":
    run_export()
