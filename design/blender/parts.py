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
def part_button():
    clear(); key_light(); camera_top(2.12, 256, 256)
    lathe("cap", [(0, 0.30), (0.25, 0.297), (0.5, 0.284), (0.66, 0.262), (0.74, 0.236), (0.775, 0.2), (0.785, 0.12)], CHROME())
    lathe("groove", [(0.785, 0.06), (0.83, 0.06)], DARK())
    lathe("bezel", [(0.83, 0.06), (0.85, 0.13), (0.89, 0.175), (0.95, 0.175), (0.985, 0.14), (1.0, 0.08), (1.0, 0.0)], SATIN())
    render("btn")


def part_pill():
    clear(); key_light(); camera_top(2.2, 320, 160)
    rounded_box("bezel", 2.1, 1.0, 0.2, 0.48, SATIN(), z=0.0)
    rounded_box("groove", 1.92, 0.82, 0.2, 0.4, DARK(), z=0.03)
    cap = rounded_box("cap", 1.84, 0.74, 0.34, 0.36, CHROME(), z=0.08)
    render("pill")


def part_jog():
    clear(); key_light(800, 5); camera_top(2.12, 640, 640)
    lathe("ring", [(0.6, 0.1), (0.62, 0.2), (0.68, 0.262), (0.8, 0.29), (0.92, 0.262), (0.975, 0.19), (1.0, 0.07), (1.0, 0.0)], CHROME())
    lathe("ring_groove", [(0.585, 0.09), (0.605, 0.09)], DARK())
    for i in range(8):
        a = i * math.pi / 4
        sphere((0.81 * math.cos(a), 0.81 * math.sin(a), 0.262), 0.032, DARK())
    lathe("disc", [(0, 0.205), (0.3, 0.2), (0.48, 0.186), (0.56, 0.16), (0.585, 0.11)], BLUE())
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
    lathe("cap", [(0, 0.3), (0.3, 0.295), (0.48, 0.278), (0.57, 0.25), (0.6, 0.2), (0.605, 0.12)], CHROME())
    lathe("ring", [(0.62, 0.1), (0.64, 0.2), (0.7, 0.245), (0.76, 0.2), (0.78, 0.1)], green)
    lathe("bezel", [(0.79, 0.06), (0.82, 0.14), (0.88, 0.18), (0.95, 0.17), (0.99, 0.12), (1.0, 0.0)], SATIN())
    render("power-on" if on else "power-off")


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
