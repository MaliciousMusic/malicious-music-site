"""Rendu des pièces chromées du site Malicious Music.

Lancer :  blender -b -P design/blender/parts.py -- [nom_piece ...]
Sorties : assets/hw/*.png (fond transparent, vue de dessus orthographique)
"""
import math
import os
import sys

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets", "hw")
HDRI = os.path.join(ROOT, "design", "hdri", "studio_small_09_1k.hdr")
os.makedirs(OUT, exist_ok=True)
ONLY = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


# ------------------------------------------------------------------ scène
def setup_render():
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            for d in prefs.devices:
                d.use = True
            sc.cycles.device = "GPU"
            break
        except Exception:
            continue
    sc.cycles.samples = 160
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Punchy"
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"


def setup_world(strength=1.0, rot=0.0):
    w = bpy.data.worlds.get("W") or bpy.data.worlds.new("W")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Rotation"].default_value = (0, 0, rot)
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(HDRI, check_existing=True)
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
    nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.lights, bpy.data.cameras):
        for b in list(block):
            if b.users == 0:
                block.remove(b)


def camera_top(scale, w, h, z=10):
    cam = bpy.data.cameras.new("cam")
    cam.type = "ORTHO"
    cam.ortho_scale = scale
    ob = bpy.data.objects.new("cam", cam)
    ob.location = (0, 0, z)
    bpy.context.collection.objects.link(ob)
    bpy.context.scene.camera = ob
    bpy.context.scene.render.resolution_x = w
    bpy.context.scene.render.resolution_y = h
    bpy.context.scene.render.resolution_percentage = 100


def key_light(power=600, size=4):
    """Lumière principale en haut à gauche, comme les skins des années 2000."""
    l = bpy.data.lights.new("key", "AREA")
    l.energy = power
    l.size = size
    ob = bpy.data.objects.new("key", l)
    ob.location = (-4, 4, 6)
    ob.rotation_euler = (math.radians(-35), math.radians(-35), 0)
    bpy.context.collection.objects.link(ob)
    l2 = bpy.data.lights.new("rim", "AREA")
    l2.energy = power * 0.25
    l2.size = size
    ob2 = bpy.data.objects.new("rim", l2)
    ob2.location = (4, -4, 4)
    ob2.rotation_euler = (math.radians(40), math.radians(40), 0)
    bpy.context.collection.objects.link(ob2)
    # grande boîte à lumière au-dessus, décalée en haut à gauche : c'est elle que le chrome reflète
    sb = bpy.data.lights.new("softbox", "AREA")
    sb.shape = "DISK"
    sb.size = 5.0
    sb.energy = 260
    ob3 = bpy.data.objects.new("softbox", sb)
    ob3.location = (-1.6, 1.9, 7.5)
    bpy.context.collection.objects.link(ob3)
    fill = bpy.data.lights.new("fill", "AREA")
    fill.size = 12.0
    fill.energy = 60
    ob4 = bpy.data.objects.new("fill", fill)
    ob4.location = (0.8, -0.8, 9.0)
    bpy.context.collection.objects.link(ob4)


def render(name):
    bpy.context.scene.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("RENDU", name)


# ------------------------------------------------------------------ matières
def mat(name, color=(0.8, 0.82, 0.85), metal=1.0, rough=0.12, aniso=0.0, radial=False,
        coat=0.0, emit=None, emit_strength=0.0, transmission=0.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    if aniso:
        p.inputs["Anisotropic"].default_value = aniso
        tg = nt.nodes.new("ShaderNodeTangent")
        if radial:
            tg.direction_type = "RADIAL"
            tg.axis = "Z"
        else:
            tg.direction_type = "UV_MAP"
        nt.links.new(tg.outputs["Tangent"], p.inputs["Tangent"])
    if coat:
        p.inputs["Coat Weight"].default_value = coat
        p.inputs["Coat Roughness"].default_value = 0.03
    if emit:
        p.inputs["Emission Color"].default_value = (*emit, 1)
        p.inputs["Emission Strength"].default_value = emit_strength
    if transmission:
        p.inputs["Transmission Weight"].default_value = transmission
    return m


def violet_gradient():
    m = bpy.data.materials.get("violet_grad")
    if m:
        return m
    m = mat("violet_grad", (0.4, 0.1, 0.9), 0.0, 0.14, coat=1.0)
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -0.6
    mr.inputs["From Max"].default_value = 0.6
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.035, 0.008, 0.12, 1)   # bas : violet nuit
    ramp.color_ramp.elements[1].color = (0.42, 0.09, 1.0, 1)      # haut : violet vif
    mid = ramp.color_ramp.elements.new(0.55)
    mid.color = (0.17, 0.03, 0.5, 1)
    nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Y"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    return m


CHROME = lambda: mat("chrome", (0.86, 0.88, 0.91), 1.0, 0.2)
SATIN = lambda: mat("satin", (0.78, 0.8, 0.84), 1.0, 0.3)
BRUSHED_RADIAL = lambda: mat("brushed_radial", (0.85, 0.87, 0.9), 1.0, 0.22, aniso=0.85, radial=True)
DARK = lambda: mat("dark", (0.02, 0.022, 0.026), 0.0, 0.35)
BLUE = lambda: mat("blue", (0.05, 0.24, 0.85), 0.0, 0.16, coat=1.0)


# ------------------------------------------------------------------ géométrie
def lathe(name, profile, material, steps=160):
    """Profil (rayon, hauteur) tourné autour de Z, comme une pièce tournée."""
    me = bpy.data.meshes.new(name)
    verts = [(r, 0.0, z) for r, z in profile]
    edges = [(i, i + 1) for i in range(len(verts) - 1)]
    me.from_pydata(verts, edges, [])
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    sc = ob.modifiers.new("lathe", "SCREW")
    sc.axis = "Z"
    sc.steps = steps
    sc.render_steps = steps
    sc.use_smooth_shade = True
    sc.use_merge_vertices = True
    sub = ob.modifiers.new("sub", "SUBSURF")
    sub.levels = 1
    sub.render_levels = 2
    ob.data.materials.append(material)
    return ob


def rounded_box(name, sx, sy, sz, bevel, material, z=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z))
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    bv = ob.modifiers.new("bevel", "BEVEL")
    bv.width = bevel
    bv.segments = 16
    bv.limit_method = "NONE"
    bpy.ops.object.shade_smooth()
    ob.data.materials.append(material)
    return ob


def sphere(loc, r, material):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=32, ring_count=16)
    ob = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    ob.data.materials.append(material)
    return ob


# ------------------------------------------------------------------ pièces
def render_split(frame_name, cap_name, caps):
    """Rend séparément le cadre fixe et le bouton mobile (pour qu'il s'enfonce seul au clic)."""
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if frame_name:
        for o in meshes:
            o.hide_render = o in caps
        render(frame_name)
    if cap_name:
        for o in meshes:
            o.hide_render = o not in caps
        render(cap_name)
    for o in meshes:
        o.hide_render = False


def part_button():
    clear(); key_light(); camera_top(2.12, 256, 256)
    cap = lathe("cap", [(0, 0.30), (0.25, 0.297), (0.5, 0.284), (0.66, 0.262), (0.74, 0.236), (0.775, 0.2), (0.785, 0.12)], CHROME())
    lathe("groove", [(0.785, 0.06), (0.83, 0.06)], DARK())
    lathe("bezel", [(0.83, 0.06), (0.85, 0.13), (0.89, 0.175), (0.95, 0.175), (0.985, 0.14), (1.0, 0.08), (1.0, 0.0)], SATIN())
    render("btn")
    render_split("btn-frame", "btn-cap", [cap])


def part_pill():
    clear(); key_light(); camera_top(2.2, 320, 160)
    rounded_box("bezel", 2.1, 1.0, 0.2, 0.48, SATIN(), z=0.0)
    rounded_box("groove", 1.92, 0.82, 0.2, 0.4, DARK(), z=0.03)
    cap = rounded_box("cap", 1.84, 0.74, 0.34, 0.36, CHROME(), z=0.08)
    render("pill")
    render_split("pill-frame", "pill-cap", [cap])


def part_jog():
    clear(); key_light(800, 5); camera_top(2.12, 640, 640)
    lathe("ring", [(0.6, 0.1), (0.62, 0.2), (0.68, 0.262), (0.8, 0.29), (0.92, 0.262), (0.975, 0.19), (1.0, 0.07), (1.0, 0.0)], CHROME())
    lathe("ring_groove", [(0.585, 0.09), (0.605, 0.09)], DARK())
    for i in range(8):
        a = i * math.pi / 4
        sphere((0.81 * math.cos(a), 0.81 * math.sin(a), 0.262), 0.032, DARK())
    lathe("disc", [(0, 0.205), (0.3, 0.2), (0.48, 0.186), (0.56, 0.16), (0.585, 0.11)], violet_gradient())
    rounded_box("split_top", 0.022, 0.34, 0.06, 0.008, DARK(), z=0.19).location.y = 0.42
    rounded_box("split_bot", 0.022, 0.34, 0.06, 0.008, DARK(), z=0.19).location.y = -0.42
    lathe("cap_groove", [(0.23, 0.2), (0.265, 0.2)], DARK())
    lathe("cap", [(0, 0.31), (0.13, 0.305), (0.19, 0.285), (0.222, 0.255), (0.232, 0.2)], CHROME())
    render("jog")


def part_knob():
    clear(); key_light(); camera_top(2.12, 512, 512)
    lathe("top", [(0, 0.5), (0.5, 0.496), (0.7, 0.487), (0.755, 0.468), (0.775, 0.44)], BRUSHED_RADIAL())
    lathe("side", [(0.775, 0.44), (0.79, 0.34), (0.8, 0.3)], CHROME())
    lathe("skirt_groove", [(0.8, 0.28), (0.84, 0.28)], DARK())
    lathe("skirt", [(0.84, 0.28), (0.9, 0.24), (0.96, 0.2), (0.995, 0.13), (1.0, 0.0)], SATIN())
    render("knob")


def part_power(on):
    clear(); key_light(); camera_top(2.12, 320, 320)
    green = mat("green_on", (0.02, 0.35, 0.01), 0.0, 0.3, emit=(0.04, 1.0, 0.0), emit_strength=0.55) if on \
        else mat("green_off", (0.32, 0.4, 0.34), 0.0, 0.35, transmission=0.4)
    cap = lathe("cap", [(0, 0.3), (0.3, 0.295), (0.48, 0.278), (0.57, 0.25), (0.6, 0.2), (0.605, 0.12)], CHROME())
    lathe("ring", [(0.62, 0.1), (0.64, 0.2), (0.7, 0.245), (0.76, 0.2), (0.78, 0.1)], green)
    lathe("bezel", [(0.79, 0.06), (0.82, 0.14), (0.88, 0.18), (0.95, 0.17), (0.99, 0.12), (1.0, 0.0)], SATIN())
    render("power-on" if on else "power-off")
    render_split(("power-on" if on else "power-off") + "-frame", "power-cap" if on else None, [cap])


def part_fader():
    """Tirette de fader : bouton chromé bombé sur sa semelle, trait violet au centre."""
    clear(); key_light(); camera_top(2.4, 360, 240)
    rounded_box("base", 2.0, 1.24, 0.2, 0.12, SATIN(), z=0.0)
    rounded_box("groove", 1.9, 1.14, 0.2, 0.1, DARK(), z=0.02)
    rounded_box("cap", 1.8, 1.04, 0.36, 0.3, CHROME(), z=0.09)
    line = mat("violet_line", (0.45, 0.12, 0.9), 0.0, 0.3, emit=(0.55, 0.2, 1.0), emit_strength=0.9)
    rounded_box("line", 0.07, 0.62, 0.05, 0.02, line, z=0.27)
    render("fader")


def part_stylus():
    """Stylet vu en perspective : la pointe touche l'écran, l'arrière vient vers nous.
    Écrit assets/hw/stylus.json avec la position (px) de la pointe et du bout arrière dans l'image."""
    import json
    from mathutils import Vector
    from bpy_extras.object_utils import world_to_camera_view
    clear(); key_light(320, 4)
    tip = lathe("tip", [(0, 0), (0.012, 0.004), (0.022, 0.02), (0.036, 0.08), (0.06, 0.2), (0.074, 0.28)],
                mat("tip_plastic", (0.62, 0.64, 0.68), 0.0, 0.32, coat=0.3))
    ring = lathe("ring", [(0.074, 0.28), (0.083, 0.29), (0.084, 0.34), (0.08, 0.35)], CHROME())
    body = lathe("body", [(0.08, 0.35), (0.082, 0.4), (0.082, 2.36), (0.078, 2.44), (0.06, 2.52), (0.03, 2.565), (0, 2.575)],
                 mat("stylus_violet", (0.26, 0.05, 0.62), 0.0, 0.22, coat=1.0, transmission=0.15))
    grip = [lathe(f"grip{i}", [(0.0825, 0.46 + i * 0.07), (0.086, 0.475 + i * 0.07), (0.0825, 0.49 + i * 0.07)], DARK()) for i in range(5)]
    # anneau de dragonne au bout, pour accrocher les charms
    bpy.ops.mesh.primitive_torus_add(major_radius=0.05, minor_radius=0.012, location=(0, 0, 2.6), rotation=(math.radians(90), 0, 0))
    strap = bpy.context.active_object; bpy.ops.object.shade_smooth(); strap.data.materials.append(CHROME())
    pivot = bpy.data.objects.new("pivot", None); bpy.context.collection.objects.link(pivot)
    for ob in [tip, ring, body, strap] + grip:
        ob.parent = pivot
    phi = math.radians(58)                                   # inclinaison vers nous
    d = Vector((math.cos(phi) * math.cos(math.radians(45)), math.cos(phi) * math.sin(math.radians(45)), math.sin(phi)))
    pivot.rotation_mode = "QUATERNION"
    pivot.rotation_quaternion = d.to_track_quat("Z", "Y")
    cam = bpy.data.cameras.new("cam"); cam.lens = 30
    co = bpy.data.objects.new("cam", cam); co.location = (0.6, 0.6, 3.6)
    bpy.context.collection.objects.link(co); sc = bpy.context.scene; sc.camera = co
    N = 640
    sc.render.resolution_x = sc.render.resolution_y = N
    bpy.context.view_layer.update()
    def px(v):
        u = world_to_camera_view(sc, co, v)
        return [round(u.x * N, 1), round((1 - u.y) * N, 1)]
    end = pivot.matrix_world @ Vector((0, 0, 2.6))
    json.dump({"size": N, "tip": px(Vector((0, 0, 0))), "end": px(end)}, open(os.path.join(OUT, "stylus.json"), "w"))
    vs = sc.view_settings
    vs.view_transform, vs.look = "Standard", "None"
    render("stylus")
    vs.view_transform, vs.look = "AgX", "AgX - Punchy"


def led_face_material(name, on=True):
    """Face en acrylique violet derrière laquelle une matrice de LED s'allume (dégradé violet comme le poisson)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (0.03, 0.006, 0.09, 1)
    p.inputs["Roughness"].default_value = 0.3
    p.inputs["Coat Weight"].default_value = 0.35
    p.inputs["Coat Roughness"].default_value = 0.12
    tc = nt.nodes.new("ShaderNodeTexCoord")
    # dégradé vertical : violet vif en haut, violet profond en bas
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -0.35
    mr.inputs["From Max"].default_value = 0.35
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.16, 0.0, 0.62, 1)
    ramp.color_ramp.elements[1].color = (0.62, 0.2, 1.0, 1)
    # matrice de points LED
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (26, 26, 1)
    sep2 = nt.nodes.new("ShaderNodeSeparateXYZ")
    fx = nt.nodes.new("ShaderNodeMath"); fx.operation = "FRACT"
    fy = nt.nodes.new("ShaderNodeMath"); fy.operation = "FRACT"
    cmb = nt.nodes.new("ShaderNodeCombineXYZ")
    sub = nt.nodes.new("ShaderNodeVectorMath"); sub.operation = "SUBTRACT"; sub.inputs[1].default_value = (0.5, 0.5, 0)
    ln = nt.nodes.new("ShaderNodeVectorMath"); ln.operation = "LENGTH"
    dot = nt.nodes.new("ShaderNodeMapRange")
    dot.inputs["From Min"].default_value = 0.36
    dot.inputs["From Max"].default_value = 0.22
    dot.inputs["To Min"].default_value = 0.12
    dot.inputs["To Max"].default_value = 1.0
    strength = nt.nodes.new("ShaderNodeMath"); strength.operation = "MULTIPLY"
    strength.inputs[1].default_value = 2.6 if on else 0.0
    L = nt.links.new
    L(tc.outputs["Object"], sep.inputs["Vector"]); L(sep.outputs["Y"], mr.inputs["Value"]); L(mr.outputs["Result"], ramp.inputs["Fac"])
    L(tc.outputs["Object"], mp.inputs["Vector"]); L(mp.outputs["Vector"], sep2.inputs["Vector"])
    L(sep2.outputs["X"], fx.inputs[0]); L(sep2.outputs["Y"], fy.inputs[0])
    L(fx.outputs[0], cmb.inputs["X"]); L(fy.outputs[0], cmb.inputs["Y"])
    L(cmb.outputs["Vector"], sub.inputs[0]); L(sub.outputs["Vector"], ln.inputs[0])
    L(ln.outputs["Value"], dot.inputs["Value"]); L(dot.outputs["Result"], strength.inputs[0])
    L(ramp.outputs["Color"], p.inputs["Emission Color"]); L(strength.outputs[0], p.inputs["Emission Strength"])
    return m


def part_title(on=True):
    """MALICIOUS MUSIC en lettres-boîtiers : flancs chromés, face acrylique éclairée par des LED."""
    clear(); key_light(260, 4)
    font = bpy.data.fonts.load(os.path.join(ROOT, "design", "fonts", "RussoOne-Regular.ttf"), check_existing=True)
    cu = bpy.data.curves.new("title", "FONT")
    cu.body = "MALICIOUS MUSIC"
    cu.font = font
    cu.align_x = "CENTER"; cu.align_y = "CENTER"
    cu.space_character = 1.08
    cu.extrude = 0.09
    cu.bevel_depth = 0.012; cu.bevel_resolution = 3
    ob = bpy.data.objects.new("title", cu); bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.active_object
    face = led_face_material("led_face_on" if on else "led_face_off", on)
    ob.data.materials.clear()
    ob.data.materials.append(CHROME())      # 0 : flancs et biseaux chromés
    ob.data.materials.append(face)          # 1 : face avant éclairée
    for poly in ob.data.polygons:
        poly.material_index = 1 if poly.normal.z > 0.95 and poly.center.z > 0.09 else 0
    bpy.ops.object.shade_auto_smooth() if hasattr(bpy.ops.object, "shade_auto_smooth") else None
    w = ob.dimensions.x
    camera_top(w * 1.04, 1800, int(1800 * 0.86 / w * 1.0 / 1.04) + 40)
    bpy.data.lights["softbox"].energy = 90
    vs = bpy.context.scene.view_settings
    vs.view_transform, vs.look = "Standard", "None"
    render("title-led" if on else "title-off")
    vs.view_transform, vs.look = "AgX", "AgX - Punchy"


def chrome80_material():
    """Chrome façon lettrage 80/90 : ciel clair, ligne d'horizon sombre, sol violet rosé,
    réparti sur la hauteur de la lettre et déformé par l'inclinaison de la surface."""
    m = bpy.data.materials.new("chrome80"); m.use_nodes = True
    nt = m.node_tree; p = nt.nodes["Principled BSDF"]
    p.inputs["Metallic"].default_value = 0.0
    p.inputs["Roughness"].default_value = 0.18
    p.inputs["Coat Weight"].default_value = 1.0
    p.inputs["Coat Roughness"].default_value = 0.02
    tc = nt.nodes.new("ShaderNodeTexCoord"); geo = nt.nodes.new("ShaderNodeNewGeometry")
    sp = nt.nodes.new("ShaderNodeSeparateXYZ"); sn = nt.nodes.new("ShaderNodeSeparateXYZ")
    pos = nt.nodes.new("ShaderNodeMapRange")
    pos.inputs["From Min"].default_value = -0.4; pos.inputs["From Max"].default_value = 0.42
    nrm = nt.nodes.new("ShaderNodeMath"); nrm.operation = "MULTIPLY"; nrm.inputs[1].default_value = 0.32
    add = nt.nodes.new("ShaderNodeMath"); add.operation = "ADD"
    ramp = nt.nodes.new("ShaderNodeValToRGB"); els = ramp.color_ramp.elements
    els[0].position = 0.0; els[0].color = (0.1, 0.01, 0.28, 1)
    els[1].position = 1.0; els[1].color = (1, 1, 1, 1)
    for pp, col in ((0.3, (0.55, 0.12, 0.85, 1)), (0.44, (0.95, 0.55, 1.0, 1)), (0.495, (1, 0.96, 1, 1)),
                    (0.505, (0.05, 0.03, 0.12, 1)), (0.6, (0.3, 0.27, 0.45, 1)), (0.82, (0.86, 0.86, 0.97, 1))):
        e = els.new(pp); e.color = col
    emis = nt.nodes.new("ShaderNodeMath"); emis.operation = "MULTIPLY"
    L = nt.links.new
    L(tc.outputs["Object"], sp.inputs["Vector"]); L(sp.outputs["Y"], pos.inputs["Value"])
    L(geo.outputs["Normal"], sn.inputs["Vector"]); L(sn.outputs["Y"], nrm.inputs[0])
    L(pos.outputs["Result"], add.inputs[0]); L(nrm.outputs[0], add.inputs[1])
    L(add.outputs[0], ramp.inputs["Fac"])
    L(ramp.outputs["Color"], p.inputs["Base Color"]); L(ramp.outputs["Color"], p.inputs["Emission Color"])
    p.inputs["Emission Strength"].default_value = 0.9
    p.inputs["Coat Weight"].default_value = 0.5
    p.inputs["Coat Roughness"].default_value = 0.08
    return m


def part_title_chrome():
    """MALICIOUS MUSIC en chrome gonflé et penché, qui sort de cuvettes creusées dans le châssis
    (rebord chromé comme les boutons, fond sombre)."""
    clear()   # pas de lampes : le chrome porte son propre dégradé, le studio (HDRI) éclaire le rebord
    font = bpy.data.fonts.load(os.path.join(ROOT, "design", "fonts", "RussoOne-Regular.ttf"), check_existing=True)

    def text_mesh(name, offset, extrude, bevel, z, shear=0.18):
        cu = bpy.data.curves.new(name, "FONT")
        cu.body = "MALICIOUS MUSIC"; cu.font = font
        cu.align_x = "CENTER"; cu.align_y = "CENTER"
        cu.space_character = 1.12; cu.shear = shear
        cu.offset = offset; cu.extrude = extrude
        cu.bevel_depth = bevel; cu.bevel_resolution = 8 if bevel > 0.02 else 3
        ob = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(ob)
        ob.location.z = z
        bpy.ops.object.select_all(action="DESELECT")
        bpy.context.view_layer.objects.active = ob; ob.select_set(True)
        bpy.ops.object.convert(target="MESH")
        return bpy.context.active_object

    # rebord : contour élargi, percé au centre ; les contours voisins se recouvrent, on les fusionne d'abord
    def merged(ob):
        rm = ob.modifiers.new("remesh", "REMESH"); rm.mode = "VOXEL"; rm.voxel_size = 0.006
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier="remesh")
        return ob
    rim = merged(text_mesh("rim", 0.075, 0.03, 0.0, -0.02))
    cut = merged(text_mesh("cut", 0.048, 0.2, 0.0, -0.1))
    bo = rim.modifiers.new("hole", "BOOLEAN"); bo.operation = "DIFFERENCE"; bo.object = cut; bo.solver = "MANIFOLD"
    bpy.context.view_layer.objects.active = rim
    bpy.ops.object.modifier_apply(modifier="hole")
    bv = rim.modifiers.new("bevel", "BEVEL"); bv.width = 0.01; bv.segments = 3; bv.limit_method = "ANGLE"
    bpy.ops.object.shade_smooth()
    cut.hide_render = True
    rim.data.materials.append(mat("rim_dark", (0.36, 0.37, 0.41), 1.0, 0.34))
    well = text_mesh("well", 0.05, 0.004, 0.0, -0.05)
    well.data.materials.append(mat("well", (0.012, 0.006, 0.02), 0.0, 0.5))
    letters = text_mesh("letters", -0.016, 0.012, 0.046, 0.006)
    rm = letters.modifiers.new("remesh", "REMESH"); rm.mode = "VOXEL"; rm.voxel_size = 0.0035
    bpy.context.view_layer.objects.active = letters
    bpy.ops.object.modifier_apply(modifier="remesh")
    letters.data.materials.append(iridescent_edge_material())   # 0 : biseaux et flancs
    letters.data.materials.append(candy_face_material())        # 1 : face avant
    for poly in letters.data.polygons:
        poly.material_index = 1 if poly.normal.z > 0.9 else 0
    bpy.context.view_layer.objects.active = letters
    bpy.ops.object.shade_smooth()
    for ob in (letters, rim, well):         # vague légère : le mot ondule
        for v in ob.data.vertices:
            v.co.y += 0.045 * math.sin(v.co.x * 0.55 + 0.6)
    w = rim.dimensions.x
    # éclairage : chaud en haut à gauche (reflets or), violet en bas à droite, bande claire au-dessus (reflet laqué)
    target = bpy.data.objects.new("target", None); bpy.context.collection.objects.link(target)
    for name, loc, col, energy, size in (("warm", (-6, 3.5, 2.2), (1.0, 0.72, 0.45), 380, 0.8),
                                         ("cool", (6, -3.5, 2.2), (0.62, 0.35, 1.0), 380, 0.8)):
        l = bpy.data.lights.new(name, "AREA"); l.color = col; l.energy = energy; l.size = size
        o = bpy.data.objects.new(name, l); o.location = loc; bpy.context.collection.objects.link(o)
        c = o.constraints.new("TRACK_TO"); c.target = target; c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
    sheen = bpy.data.lights.new("sheen", "AREA"); sheen.shape = "RECTANGLE"
    sheen.size = w * 1.3; sheen.size_y = 0.16; sheen.energy = 28
    so = bpy.data.objects.new("sheen", sheen); so.location = (0, 0.2, 3.0); bpy.context.collection.objects.link(so)
    camera_top(w * 1.03, 1800, 300)
    vs = bpy.context.scene.view_settings
    vs.view_transform, vs.look = "Standard", "None"
    render("title-chrome")
    vs.view_transform, vs.look = "AgX", "AgX - Punchy"


def candy_face_material():
    """Face des lettres : rose bonbon laqué, plus clair en haut (référence chrome rose)."""
    m = bpy.data.materials.new("candy_face"); m.use_nodes = True
    nt = m.node_tree; p = nt.nodes["Principled BSDF"]
    p.inputs["Metallic"].default_value = 0.0
    p.inputs["Roughness"].default_value = 0.22
    p.inputs["Coat Weight"].default_value = 1.0
    p.inputs["Coat Roughness"].default_value = 0.02
    tc = nt.nodes.new("ShaderNodeTexCoord"); sp = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = -0.38; mr.inputs["From Max"].default_value = 0.4
    ramp = nt.nodes.new("ShaderNodeValToRGB"); els = ramp.color_ramp.elements
    els[0].color = (0.72, 0.03, 0.68, 1)          # bas : magenta profond
    els[1].color = (1.0, 0.72, 1.0, 1)            # haut : rose clair
    e = els.new(0.5); e.color = (1.0, 0.22, 0.88, 1)
    nt.links.new(tc.outputs["Object"], sp.inputs["Vector"]); nt.links.new(sp.outputs["Y"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"]); nt.links.new(ramp.outputs["Color"], p.inputs["Emission Color"])
    p.inputs["Emission Strength"].default_value = 0.42
    return m


def iridescent_edge_material():
    """Biseaux : métal poli à film fin, reflets or pêche ↔ violet."""
    m = mat("iridescent_edge", (1.0, 0.72, 0.68), 1.0, 0.1)
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Thin Film Thickness"].default_value = 560.0
    p.inputs["Thin Film IOR"].default_value = 1.45
    return m


# ------------------------------------------------------------------ charms
CHARM_S = 1.35   # échelle de caméra commune : l'anneau est toujours à 4 % du haut de l'image


def add_bail(y_top):
    """Tige + anneau de suspension au-dessus de la pièce ; renvoie le haut de l'anneau."""
    bpy.ops.mesh.primitive_cylinder_add(radius=0.018, depth=0.12, location=(0, y_top + 0.03, 0.02), vertices=24)
    pin = bpy.context.active_object
    pin.rotation_euler.x = math.radians(90)
    bpy.ops.object.shade_smooth()
    pin.data.materials.append(CHROME())
    R, r = 0.06, 0.015
    cy = y_top + 0.09 + R
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=(0, cy, 0.02), major_segments=48, minor_segments=16)
    ring = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    ring.data.materials.append(CHROME())
    return cy + R + r


def charm_render(name, ring_top):
    camera_top(CHARM_S, 360, 360)
    cam = bpy.context.scene.camera
    cam.location = (0, ring_top - CHARM_S * 0.46, 10)
    vs = bpy.context.scene.view_settings
    vs.view_transform, vs.look = "Standard", "None"
    render(name)
    vs.view_transform, vs.look = "AgX", "AgX - Punchy"


def molded(name, color, rough=0.22, transmission=0.0):
    """Plastique moulé brillant (vernis épais)."""
    return mat(name, color, 0.0, rough, coat=1.0, transmission=transmission)


def part_charm_bass():
    """Le bass du logo, découpé et extrudé comme un charm en PVC moulé."""
    import bmesh
    import json
    clear(); key_light(300, 4)
    folder = os.path.join(ROOT, "design", "blender")
    poly = json.load(open(os.path.join(folder, "fish.geojson")))["features"][0]["geometry"]["coordinates"][0]
    img = bpy.data.images.load(os.path.join(folder, "fish-tex.png"), check_existing=True)
    W, H = img.size
    sc = 1.0 / H
    me = bpy.data.meshes.new("bass")
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    pts = poly[:-1] if poly[0] == poly[-1] else poly
    verts = [bm.verts.new(((x - W / 2) * sc, (y - H / 2) * sc, 0.0)) for x, y in pts]
    face = bm.faces.new(verts)
    if face.normal.z < 0:
        face.normal_flip()
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    top = [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, 0.075), verts=top)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4], quad_method="BEAUTY", ngon_method="BEAUTY")
    for f in bm.faces:
        for lp in f.loops:
            co = lp.vert.co
            lp[uv].uv = (co.x / (W * sc) + 0.5, co.y / (H * sc) + 0.5)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("bass", me)
    bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bv = ob.modifiers.new("bevel", "BEVEL")
    bv.width = 0.022; bv.segments = 4; bv.limit_method = "ANGLE"; bv.angle_limit = math.radians(40)
    ob.modifiers.new("wn", "WEIGHTED_NORMAL")
    bpy.ops.object.shade_smooth()
    m = mat("bass_pvc", (1, 1, 1), 0.0, 0.34, coat=0.45)
    nt = m.node_tree
    it = nt.nodes.new("ShaderNodeTexImage"); it.image = img; it.extension = "EXTEND"
    nt.links.new(it.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    ob.data.materials.append(m)
    ys = [v.co.y for v in me.vertices if abs(v.co.x) < 0.05]
    ring_top = add_bail(max(ys) - 0.02)
    charm_render("charm-bass", ring_top)


def part_charm_note():
    """Croche en plastique moulé noir brillant."""
    clear(); key_light(300, 4)
    black = molded("note_black", (0.015, 0.012, 0.02), 0.18)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(-0.12, -0.34, 0.0), segments=48, ring_count=24)
    head = bpy.context.active_object
    head.scale = (0.24, 0.165, 0.09)
    head.rotation_euler.z = math.radians(24)
    bpy.ops.object.shade_smooth(); head.data.materials.append(black)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.034, depth=0.9, location=(0.095, 0.08, 0.0), vertices=32)
    stem = bpy.context.active_object
    stem.rotation_euler.x = math.radians(90)
    bpy.ops.object.shade_smooth(); stem.data.materials.append(black)
    # drapeau : tube aplati qui retombe en vague
    cu = bpy.data.curves.new("flag", "CURVE"); cu.dimensions = "3D"
    sp = cu.splines.new("BEZIER"); sp.bezier_points.add(2)
    for bp, co, hl, hr in zip(sp.bezier_points,
                              [(0.1, 0.5, 0), (0.33, 0.2, 0), (0.3, -0.12, 0)],
                              [(0.1, 0.56, 0), (0.33, 0.32, 0), (0.36, -0.02, 0)],
                              [(0.18, 0.4, 0), (0.33, 0.1, 0), (0.24, -0.2, 0)]):
        bp.co, bp.handle_left, bp.handle_right = co, hl, hr
    cu.bevel_depth = 0.045; cu.bevel_resolution = 6
    fl = bpy.data.objects.new("flag", cu); bpy.context.collection.objects.link(fl)
    fl.scale.z = 0.7
    fl.data.materials.append(black)
    ring_top = add_bail(0.53)
    for o in bpy.context.scene.objects:
        if o.name.startswith("Cylinder") and o is not stem:
            o.location.x = 0.095
        if o.name.startswith("Torus"):
            o.location.x = 0.095
    charm_render("charm-note", ring_top)


def part_charm_emoji():
    """Émoji malicieux : boule jaune moulée, sourcils froncés, regard en coin, sourire en biais."""
    clear(); key_light(300, 4)
    yellow = molded("emoji_yellow", (1.0, 0.62, 0.04), 0.25)
    white = molded("emoji_white", (0.95, 0.96, 1.0), 0.2)
    brown = molded("emoji_brown", (0.22, 0.09, 0.02), 0.3)
    blue = molded("emoji_blue", (0.08, 0.25, 0.85), 0.15)
    black = molded("emoji_black", (0.01, 0.01, 0.01), 0.15)
    R, SZ = 0.5, 0.5
    bpy.ops.mesh.primitive_uv_sphere_add(radius=R, segments=64, ring_count=32)
    ball = bpy.context.active_object; ball.scale.z = SZ
    bpy.ops.object.shade_smooth(); ball.data.materials.append(yellow)

    def surf(x, y):
        return SZ * math.sqrt(max(0.0, R * R - x * x - y * y))

    def blob(x, y, sx, sy, sz, m, rot=0.0, lift=0.0):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(x, y, surf(x, y) - sz * 0.35 + lift), segments=32, ring_count=16)
        o = bpy.context.active_object; o.scale = (sx, sy, sz); o.rotation_euler.z = rot
        bpy.ops.object.shade_smooth(); o.data.materials.append(m)
        return o

    def tube(points, radius, m):
        cu = bpy.data.curves.new("t", "CURVE"); cu.dimensions = "3D"
        sp = cu.splines.new("POLY"); sp.points.add(len(points) - 1)
        for p_, (x, y) in zip(sp.points, points):
            p_.co = (x, y, surf(x, y) + 0.012, 1)
        sp.use_smooth = True
        cu.bevel_depth = radius; cu.bevel_resolution = 4
        o = bpy.data.objects.new("t", cu); bpy.context.collection.objects.link(o)
        o.data.materials.append(m)
        return o

    # yeux : blanc, iris bleu tourné vers la droite, pupille, reflet
    for ex, ey, s in ((-0.17, 0.02, 1.0), (0.15, 0.07, 1.12)):
        blob(ex, ey, 0.11 * s, 0.125 * s, 0.035, white)
        blob(ex + 0.045 * s, ey - 0.01, 0.052 * s, 0.056 * s, 0.03, blue, lift=0.01)
        blob(ex + 0.05 * s, ey - 0.01, 0.028 * s, 0.03 * s, 0.03, black, lift=0.016)
        blob(ex + 0.03 * s, ey + 0.02, 0.012, 0.012, 0.02, white, lift=0.024)
    # sourcils froncés (le droit en accent circonflexe)
    tube([(-0.33, 0.13), (-0.24, 0.16), (-0.12, 0.13), (-0.05, 0.08)], 0.022, brown)
    tube([(0.03, 0.12), (0.1, 0.2), (0.16, 0.27), (0.24, 0.24)], 0.022, brown)
    # sourire en biais : contour brun, dents blanches, ligne de dents
    # sourire malicieux : croissant effilé qui remonte à droite (tube à rayon variable)
    def crescent(points, radii, radius, m, dz=0.0):
        cu = bpy.data.curves.new("smile", "CURVE"); cu.dimensions = "3D"
        sp = cu.splines.new("POLY"); sp.points.add(len(points) - 1)
        for p_, (x, y), rr in zip(sp.points, points, radii):
            p_.co = (x, y, surf(x, y) - 0.01 + dz, 1)
            p_.radius = rr
        sp.use_smooth = True
        cu.bevel_depth = radius; cu.bevel_resolution = 6
        o = bpy.data.objects.new("smile", cu); bpy.context.collection.objects.link(o)
        o.data.materials.append(m)
        return o
    arc = [(-0.2, -0.15), (-0.12, -0.215), (-0.02, -0.255), (0.09, -0.26), (0.19, -0.225), (0.27, -0.16), (0.32, -0.08)]
    thick = [0.15, 0.55, 0.85, 1.0, 0.92, 0.6, 0.18]
    crescent(arc, thick, 0.068, brown)
    crescent(arc, [r * 0.86 for r in thick], 0.068, white, dz=0.008)
    tube([(-0.1, -0.215), (0.0, -0.245), (0.1, -0.248), (0.2, -0.215), (0.26, -0.17)], 0.005, mat("teeth_line", (0.6, 0.6, 0.66), 0.0, 0.4))
    ring_top = add_bail(R - 0.03)
    charm_render("charm-emoji", ring_top)


def part_plate():
    """Plaque de métal brossé pour le châssis (vue en perspective pour varier les reflets)."""
    clear()
    bpy.ops.mesh.primitive_plane_add(size=1)
    pl = bpy.context.active_object
    pl.scale = (16, 10, 1)
    bpy.ops.object.transform_apply(scale=True)
    m = mat("plate", (0.8, 0.82, 0.86), 1.0, 0.3, aniso=0.9)
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 900.0
    noise.inputs["Detail"].default_value = 2.0
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (0.02, 1.0, 1.0)  # stries horizontales
    tc = nt.nodes.new("ShaderNodeTexCoord")
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    pl.data.materials.append(m)
    for i, (x, e) in enumerate(((-5, 900), (0, 500), (5, 900))):
        l = bpy.data.lights.new(f"strip{i}", "AREA")
        l.shape = "RECTANGLE"; l.size = 0.6; l.size_y = 14; l.energy = e
        ob = bpy.data.objects.new(f"strip{i}", l)
        ob.location = (x, 0, 3.5)
        bpy.context.collection.objects.link(ob)
    cam = bpy.data.cameras.new("cam"); cam.lens = 16
    ob = bpy.data.objects.new("cam", cam); ob.location = (0, 0, 4.2)
    bpy.context.collection.objects.link(ob); bpy.context.scene.camera = ob
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = 1600, 1000
    sc.render.film_transparent = False
    render("plate")
    sc.render.film_transparent = True


def part_sticker():
    """Sticker vinyle du logo : un pli en travers, des froissures et le coin bas gauche décollé."""
    clear(); key_light(260, 4)
    bpy.data.lights["softbox"].energy = 120
    tex_path = os.path.join(ROOT, "design", "blender", "sticker-tex.png")
    img = bpy.data.images.load(tex_path, check_existing=True)
    tw, th = img.size
    w, h = 1.0, th / tw

    bpy.ops.mesh.primitive_grid_add(x_subdivisions=180, y_subdivisions=int(180 * h), size=1)
    st = bpy.context.active_object
    st.name = "sticker"
    for v in st.data.vertices:
        v.co.x *= w
        v.co.y *= h

    def gauss(d, s):
        return math.exp(-(d / s) ** 2)

    # pli principal (arête) et pli secondaire (creux), en travers du sticker
    creases = [
        ((-0.5, 0.2), (0.5, -0.02), 0.007, 0.03),
        ((-0.3, 0.58), (0.05, -0.1), -0.004, 0.035),
        ((0.15, 0.6), (0.5, 0.3), 0.003, 0.025),
    ]
    R = 0.055            # rayon de la boucle du coin décollé
    nx, ny = (-1 / math.sqrt(2), 1 / math.sqrt(2))  # depuis le coin bas droit vers l'intérieur
    fold_c = -0.5        # ligne de pliage du coin bas droit
    for v in st.data.vertices:
        x, y = v.co.x, v.co.y
        z = 0.008  # au-dessus de l'attrape-ombre, même dans les creux
        for (ax, ay), (bx, by), amp, s in creases:
            dx, dy = bx - ax, by - ay
            L = math.hypot(dx, dy)
            d = abs((x - ax) * dy - (y - ay) * dx) / L
            z += amp * gauss(d, s)
        # petites froissures de vinyle
        z += 0.0007 * (math.sin(x * 23 + y * 7 + 1.3) * math.sin(y * 19 - x * 5) + 0.6 * math.sin(x * 41 - y * 33 + 0.4))
        # coin décollé : on enroule ce qui dépasse la ligne de pliage
        u = x * nx + y * ny            # position le long de la diagonale
        s = fold_c - u                 # > 0 au-delà de la ligne, côté coin
        if s > 0:
            a = s / R
            back = R * math.sin(a)
            lift = R * (1 - math.cos(a))
            # on ramène le point vers la ligne de pli et on le soulève
            x += nx * (s - back)
            y += ny * (s - back)
            z += lift
        v.co = (x, y, z)
    st.data.update()
    bpy.ops.object.shade_smooth()
    sub = st.modifiers.new("sub", "SUBSURF"); sub.levels = 1; sub.render_levels = 1
    st.rotation_euler.z = math.radians(-11)

    # matière : vinyle brillant au recto, papier dorsal au verso
    m = bpy.data.materials.new("vinyl")
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    it = nt.nodes.new("ShaderNodeTexImage"); it.image = img
    p.inputs["Roughness"].default_value = 0.42
    p.inputs["Coat Weight"].default_value = 0.25
    p.inputs["Coat Roughness"].default_value = 0.15
    back = nt.nodes.new("ShaderNodeBsdfPrincipled")
    back.inputs["Base Color"].default_value = (0.86, 0.86, 0.84, 1)
    back.inputs["Roughness"].default_value = 0.7
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    mix = nt.nodes.new("ShaderNodeMixShader")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    cut = nt.nodes.new("ShaderNodeMixShader")
    out = nt.nodes["Material Output"]
    nt.links.new(it.outputs["Color"], p.inputs["Base Color"])
    nt.links.new(geo.outputs["Backfacing"], mix.inputs["Fac"])
    nt.links.new(p.outputs["BSDF"], mix.inputs[1])
    nt.links.new(back.outputs["BSDF"], mix.inputs[2])
    nt.links.new(it.outputs["Alpha"], cut.inputs["Fac"])
    nt.links.new(tr.outputs["BSDF"], cut.inputs[1])
    nt.links.new(mix.outputs["Shader"], cut.inputs[2])
    nt.links.new(cut.outputs["Shader"], out.inputs["Surface"])
    st.data.materials.append(m)

    # attrape-ombre : l'ombre du sticker passe dans l'alpha du PNG
    bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, -0.002))
    bpy.context.active_object.is_shadow_catcher = True

    camera_top(1.42, 640, 640)
    vs = bpy.context.scene.view_settings
    vs.view_transform, vs.look = "Standard", "None"   # garder les violets du logo
    render("sticker")
    vs.view_transform, vs.look = "AgX", "AgX - Punchy"


PARTS = {
    "title-chrome": part_title_chrome,
    "title-led": lambda: part_title(True),
    "title-off": lambda: part_title(False),
    "charm-bass": part_charm_bass,
    "charm-note": part_charm_note,
    "charm-emoji": part_charm_emoji,
    "stylus": part_stylus,
    "fader": part_fader,
    "sticker": part_sticker,
    "btn": part_button,
    "pill": part_pill,
    "jog": part_jog,
    "knob": part_knob,
    "power-on": lambda: part_power(True),
    "power-off": lambda: part_power(False),
    "plate": part_plate,
}

setup_render()
setup_world(1.0, rot=math.radians(135))
for name, fn in PARTS.items():
    if not ONLY or name in ONLY:
        fn()
