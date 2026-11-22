"""
SONOTOX — Extractor puro Python (sin Blender) de cabeza, cráneo y músculos faciales
desde un GLB de Z-Anatomy (Draco) hacia `public/models/z-anatomy-facial.glb`.

Preserva la compresión KHR_draco_mesh_compression intacta (sin pérdida de precisión),
renombra automáticamente cada malla bilateral con `_L` / `_R` usando su centroide 3D real,
y genera un archivo glTF 2.0 (.glb) optimizado y centrado listo para SonoTox.

Licencia del activo derivado:
Z-Anatomy (Gauthier Kervyn, Lluis Vinent et al.) / BodyParts3D (DBCLS) — CC BY-SA 4.0.
"""

import json
import os
import re
import struct
import sys

# Exact prefix / regex mapping for selectable muscles
MUSCLE_RENAME_RULES = [
    (r"^Frontalis muscle", "Frontalis"),
    (r"^Corrugator supercilii", "Corrugator_supercilii"),
    (r"^Procerus muscle", "Procerus"),
    (r"^Orbital part of orbicularis oculi", "Orbicularis_oculi_orbital"),
    (r"^Palpebral part of orbicularis oculi", "Orbicularis_oculi_palpebral"),
    (r"^Nasalis muscle", "Nasalis"),
    (r"^Depressor septi nasi", "Depressor_septi_nasi"),
    (r"^Levator nasolabialis", "Levator_labii_superioris_alaeque_nasi"),
    (r"^Levator labii superioris", "Levator_labii_superioris"),
    (r"^Zygomaticus minor muscle", "Zygomaticus_minor"),
    (r"^Zygomaticus major muscle", "Zygomaticus_major"),
    (r"^Levator anguli oris", "Levator_anguli_oris"),
    (r"^Bucin?n?ator", "Buccinator"),
    (r"^Risorius muscle", "Risorius"),
    (r"^Orbicularis oris muscle", "Orbicularis_oris"),
    (r"^Depressor anguli oris", "Depressor_anguli_oris"),
    (r"^Depressor labii inferioris", "Depressor_labii_inferioris"),
    (r"^Mentalis muscle", "Mentalis"),
    (r"^Superficial part of masseter", "Masseter_superficial"),
    (r"^Deep part of masseter", "Masseter_deep"),
    (r"^Temporalis muscle", "Temporalis"),
    (r"^Temporoparietalis muscle", "Temporoparietalis"),
    (r"^Medial pterygoid muscle", "Medial_pterygoid"),
    (r"^Superior head of lateral pterygoid muscle", "Lateral_pterygoid_superior"),
    (r"^Inferior head of lateral pterygoid muscle", "Lateral_pterygoid_inferior"),
    (r"^Platysma", "Platysma"),
    (r"^Occipitalis muscle", "Occipitalis"),
    (r"^Sternocleidomastoid muscle", "Sternocleidomastoid"),
    (r"^Splenius capitis muscle", "Splenius_capitis"),
    (r"^Ascending part of trapezius muscle", "Trapezius_superior"),
    (r"^Spinalis capitis muscle", "Cervical_paraspinals_spinalis"),
    (r"^Longissimus capitis muscle", "Cervical_paraspinals_longissimus"),
    (r"^Levator scapulae", "Levator_scapulae"),
]

REFERENCE_PATTERNS = [
    (r"^Epicranial aponeurosis", "Ref_Epicranial_aponeurosis"),
    (r"^Superior tarsus", "Ref_Superior_tarsus"),
    (r"^Inferior tarsus", "Ref_Inferior_tarsus"),
    (r"^Anterior belly of digastric muscle", "Ref_Digastric_anterior"),
    (r"^Mylohyoid muscle", "Ref_Mylohyoid"),
]

BONE_PATTERNS = [
    r"^Frontal bone",
    r"^Parietal bone",
    r"^Temporal bone",
    r"^Occipital bone",
    r"^Zygomatic bone",
    r"^Maxilla",
    r"^Mandible",
    r"^Nasal bone",
    r"^Sphenoid bone",
    r"^Ethmoid bone",
    r"^Lacrimal bone",
    r"^Vomer",
    r"^Palatine bone",
    r"^Inferior nasal concha bone",
    r"^Hyoid bone",
    r"^Thyroid cartilage",
    r"^Cricoid cartilage",
    r"^Atlas \(C1\)",
    r"^Axis \(C2\)",
    r"^Vertebra C[3456]",
    r"^Major alar cartilage",
    r"^Lateral process of nasal septal cartilage",
    r"^Nasal septal cartilage",
    r"^(Upper|Lower) (medial incisor|lateral incisor|canine|first premolar|second premolar|first molar tooth|second molar tooth)",
]


def classify_node(raw_name: str):
    for pat, clean_base in MUSCLE_RENAME_RULES:
        if re.search(pat, raw_name, re.IGNORECASE):
            return ("muscle", clean_base)
    for pat, clean_base in REFERENCE_PATTERNS:
        if re.search(pat, raw_name, re.IGNORECASE):
            return ("reference", clean_base)
    for pat in BONE_PATTERNS:
        if re.search(pat, raw_name, re.IGNORECASE):
            clean = re.sub(r"\.\d{3}$", "", raw_name.strip())
            clean = re.sub(r"[^A-Za-z0-9]+", "_", clean).strip("_")
            return ("bone", f"Skull_{clean}")
    return (None, None)


def get_mesh_bounds(gltf: dict, mesh_idx: int):
    mesh = gltf["meshes"][mesh_idx]
    accessors = gltf["accessors"]
    mins = [1e9, 1e9, 1e9]
    maxs = [-1e9, -1e9, -1e9]
    for prim in mesh.get("primitives", []):
        pos_idx = prim.get("attributes", {}).get("POSITION")
        if pos_idx is not None:
            acc = accessors[pos_idx]
            if "min" in acc and "max" in acc:
                for i in range(3):
                    mins[i] = min(mins[i], acc["min"][i])
                    maxs[i] = max(maxs[i], acc["max"][i])
    return mins, maxs


def extract_facial_glb(src_path: str, dst_path: str):
    with open(src_path, "rb") as f:
        magic, version, total_length = struct.unpack("<4sII", f.read(12))
        if magic != b"glTF":
            raise ValueError("Source file is not a valid GLB")
        json_len, json_type = struct.unpack("<I4s", f.read(8))
        gltf = json.loads(f.read(json_len).decode("utf-8"))
        bin_len, bin_type = struct.unpack("<I4s", f.read(8))
        bin_data = f.read(bin_len)

    selected_nodes = []
    used_names = {}

    for node_idx, node in enumerate(gltf.get("nodes", [])):
        if "mesh" not in node:
            continue
        raw_name = node.get("name", "")
        kind, base_name = classify_node(raw_name)
        if not kind:
            continue

        mins, maxs = get_mesh_bounds(gltf, node["mesh"])
        cx = (mins[0] + maxs[0]) * 0.5
        if abs(cx) > 0.0025:
            side_suffix = "_L" if cx > 0 else "_R"
            final_name = f"{base_name}{side_suffix}"
        else:
            final_name = base_name

        # Ensure unique node name
        count = used_names.get(final_name, 0)
        used_names[final_name] = count + 1
        if count > 0:
            final_name = f"{final_name}_{count + 1}"

        selected_nodes.append((node_idx, node, kind, final_name, mins, maxs))

    if not selected_nodes:
        raise RuntimeError("No facial/head meshes matched in source GLB!")

    # Compute overall bounding box to center head at origin via root node translation
    gmin = [1e9, 1e9, 1e9]
    gmax = [-1e9, -1e9, -1e9]
    for _, _, _, _, mins, maxs in selected_nodes:
        for i in range(3):
            gmin[i] = min(gmin[i], mins[i])
            gmax[i] = max(gmax[i], maxs[i])
    center = [(gmin[i] + gmax[i]) * 0.5 for i in range(3)]

    # Remap referenced bufferViews, accessors, materials, meshes
    old_bvs = gltf.get("bufferViews", [])
    old_accs = gltf.get("accessors", [])
    old_meshes = gltf.get("meshes", [])

    new_bin_parts = []
    new_bin_offset = 0
    bv_map = {}
    acc_map = {}
    new_bvs = []
    new_accs = []
    new_meshes = []
    new_nodes = []

    def copy_bv(old_bv_idx: int) -> int:
        nonlocal new_bin_offset
        if old_bv_idx in bv_map:
            return bv_map[old_bv_idx]
        bv = dict(old_bvs[old_bv_idx])
        offset = bv.get("byteOffset", 0)
        length = bv["byteLength"]
        chunk = bin_data[offset : offset + length]
        # 4-byte align
        pad = (4 - (new_bin_offset % 4)) % 4
        if pad:
            new_bin_parts.append(b"\x00" * pad)
            new_bin_offset += pad
        bv["buffer"] = 0
        bv["byteOffset"] = new_bin_offset
        new_bin_parts.append(chunk)
        new_bin_offset += length
        new_idx = len(new_bvs)
        new_bvs.append(bv)
        bv_map[old_bv_idx] = new_idx
        return new_idx

    def copy_accessor(old_acc_idx: int) -> int:
        if old_acc_idx in acc_map:
            return acc_map[old_acc_idx]
        acc = json.loads(json.dumps(old_accs[old_acc_idx]))
        if "bufferView" in acc:
            acc["bufferView"] = copy_bv(acc["bufferView"])
        if "sparse" in acc:
            if "indices" in acc["sparse"] and "bufferView" in acc["sparse"]["indices"]:
                acc["sparse"]["indices"]["bufferView"] = copy_bv(acc["sparse"]["indices"]["bufferView"])
            if "values" in acc["sparse"] and "bufferView" in acc["sparse"]["values"]:
                acc["sparse"]["values"]["bufferView"] = copy_bv(acc["sparse"]["values"]["bufferView"])
        new_idx = len(new_accs)
        new_accs.append(acc)
        acc_map[old_acc_idx] = new_idx
        return new_idx

    # Create clean PBR materials (0=Muscle Superficial, 1=Bone, 2=Reference)
    new_materials = [
        {
            "name": "Muscle_Material",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.76, 0.28, 0.30, 1.0],
                "metallicFactor": 0.04,
                "roughnessFactor": 0.46,
            },
        },
        {
            "name": "Bone_Material",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.90, 0.87, 0.80, 1.0],
                "metallicFactor": 0.02,
                "roughnessFactor": 0.58,
            },
        },
        {
            "name": "Reference_Material",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.88, 0.86, 0.85, 0.45],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.65,
            },
            "alphaMode": "BLEND",
        },
    ]

    kind_to_mat = {"muscle": 0, "bone": 1, "reference": 2}
    child_indices = []

    for _, old_node, kind, final_name, _, _ in selected_nodes:
        old_mesh = json.loads(json.dumps(old_meshes[old_node["mesh"]]))
        new_prims = []
        for prim in old_mesh.get("primitives", []):
            new_prim = dict(prim)
            if "attributes" in new_prim:
                new_prim["attributes"] = {
                    k: copy_accessor(v) for k, v in new_prim["attributes"].items()
                }
            if "indices" in new_prim:
                new_prim["indices"] = copy_accessor(new_prim["indices"])
            if "extensions" in new_prim and "KHR_draco_mesh_compression" in new_prim["extensions"]:
                draco_ext = dict(new_prim["extensions"]["KHR_draco_mesh_compression"])
                draco_ext["bufferView"] = copy_bv(draco_ext["bufferView"])
                new_prim["extensions"] = dict(new_prim["extensions"])
                new_prim["extensions"]["KHR_draco_mesh_compression"] = draco_ext
            new_prim["material"] = kind_to_mat[kind]
            new_prims.append(new_prim)

        mesh_idx = len(new_meshes)
        new_meshes.append({"name": final_name, "primitives": new_prims})

        node_obj = {"name": final_name, "mesh": mesh_idx}
        for tf_key in ("translation", "rotation", "scale", "matrix"):
            if tf_key in old_node:
                node_obj[tf_key] = old_node[tf_key]
        child_idx = len(new_nodes)
        new_nodes.append(node_obj)
        child_indices.append(child_idx)

    # Root wrapper node centers the head at (0, 0, 0)
    root_idx = len(new_nodes)
    new_nodes.append(
        {
            "name": "Z_Anatomy_Facial_Root",
            "translation": [-center[0], -center[1], -center[2]],
            "children": child_indices,
        }
    )

    # Final binary buffer padded to 4 bytes
    final_bin = b"".join(new_bin_parts)
    bin_pad = (4 - (len(final_bin) % 4)) % 4
    if bin_pad:
        final_bin += b"\x00" * bin_pad

    out_gltf = {
        "asset": {
            "version": "2.0",
            "generator": "SONOTOX Facial 3D Extractor (derived from Z-Anatomy / BodyParts3D CC BY-SA 4.0)",
            "copyright": "Z-Anatomy (CC BY-SA 4.0) / BodyParts3D (DBCLS)",
        },
        "extensionsUsed": gltf.get("extensionsUsed", ["KHR_draco_mesh_compression"]),
        "extensionsRequired": gltf.get("extensionsRequired", ["KHR_draco_mesh_compression"]),
        "scene": 0,
        "scenes": [{"name": "FacialAnatomy", "nodes": [root_idx]}],
        "nodes": new_nodes,
        "meshes": new_meshes,
        "materials": new_materials,
        "accessors": new_accs,
        "bufferViews": new_bvs,
        "buffers": [{"byteLength": len(final_bin)}],
    }

    json_bytes = json.dumps(out_gltf, separators=(",", ":")).encode("utf-8")
    json_pad = (4 - (len(json_bytes) % 4)) % 4
    if json_pad:
        json_bytes += b" " * json_pad

    total_out_len = 12 + 8 + len(json_bytes) + 8 + len(final_bin)
    os.makedirs(os.path.dirname(dst_path), exist_ok=True)
    with open(dst_path, "wb") as out_f:
        out_f.write(struct.pack("<4sII", b"glTF", 2, total_out_len))
        out_f.write(struct.pack("<I4s", len(json_bytes), b"JSON"))
        out_f.write(json_bytes)
        out_f.write(struct.pack("<I4s", len(final_bin), b"BIN\x00"))
        out_f.write(final_bin)

    muscles = sum(1 for _, _, k, _, _, _ in selected_nodes if k == "muscle")
    bones = sum(1 for _, _, k, _, _, _ in selected_nodes if k == "bone")
    refs = sum(1 for _, _, k, _, _, _ in selected_nodes if k == "reference")
    print(f"OK -> {dst_path}")
    print(f"Size: {total_out_len / (1024*1024):.2f} MB | Meshes: {len(selected_nodes)} ({muscles} muscles, {bones} bones/teeth/cartilage, {refs} refs)")


if __name__ == "__main__":
    src = sys.argv[1]
    dst = sys.argv[2]
    extract_facial_glb(src, dst)
