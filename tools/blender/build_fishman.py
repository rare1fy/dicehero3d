# 鱼人狂战 — built in Blender in the KayKit Adventurers idiom (chibi proportions on KayKit's Rig_Medium, chunky rounded parts, flat palette,
# small crafted details), skinned to the KayKit rig so all of its animation clips play on it. Original design.
# blender -b -P tools/blender/build_fishman.py -- <kaykit_rig_with_clips.glb> <out.glb> <preview_dir>
import bpy, bmesh, sys, math, os
from mathutils import Vector, Matrix, Euler

argv = sys.argv[sys.argv.index('--') + 1:]
RIG_SRC, OUT, PREV = argv[0], argv[1], argv[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=RIG_SRC)
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
for o in list(bpy.context.scene.objects):
    if o.type != 'ARMATURE': bpy.data.objects.remove(o, do_unlink=True)
arm.name = 'Rig'

# ---------------------------------------------------------------- palette
def mat(name, hexcol, rough=0.8, metal=0.0, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    c = tuple(int(hexcol[i:i + 2], 16) / 255 for i in (1, 3, 5)); lin = tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)
    b.inputs['Base Color'].default_value = (*lin, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit: b.inputs['Emission Color'].default_value = (*lin, 1); b.inputs['Emission Strength'].default_value = emit
    m.diffuse_color = (*lin, 1); return m
P = {
    'skin': mat('fm_skin', '#3aa79f'), 'skinD': mat('fm_skin_dark', '#246d70'), 'belly': mat('fm_belly', '#f2e2bc'), 'bellyD': mat('fm_belly_dark', '#d8c398'),
    'fin': mat('fm_fin', '#f06c3c'), 'finD': mat('fm_fin_dark', '#b8432a'), 'red': mat('fm_red', '#c8323c'), 'redD': mat('fm_red_dark', '#8a2030'),
    'eye': mat('fm_eye', '#fbf7ec', 0.4), 'black': mat('fm_black', '#16161e', 0.5), 'teeth': mat('fm_teeth', '#fff8e6', 0.5), 'mouth': mat('fm_mouth', '#5a1a26'),
    'shell': mat('fm_shell', '#8a5a34'), 'shellL': mat('fm_shell_light', '#c08a50'), 'bone': mat('fm_bone', '#efe2c4'), 'rope': mat('fm_rope', '#a07a48'),
    'steel': mat('fm_steel', '#8e9aaa', 0.45, 0.5), 'steelD': mat('fm_steel_dark', '#4c5462', 0.5, 0.5), 'edge': mat('fm_edge', '#e4eaf2', 0.3, 0.6), 'rust': mat('fm_rust', '#9a5230'),
}

# ---------------------------------------------------------------- primitives (each returns an object in world space, at rest pose)
coll = bpy.context.scene.collection
def _obj(name, bm, m):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); coll.objects.link(o); o.data.materials.append(m); return o
def xf(bm, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    M = Matrix.Translation(Vector(loc)) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1))
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
def ell(name, m, r, loc, rot=(0, 0, 0), seg=20, rings=12):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0); xf(bm, loc, rot, r); return _obj(name, bm, m)
def cyl(name, m, r0, r1, a, b, seg=14, cap=True):
    """tapered cylinder from point a (radius r0) to point b (radius r1)"""
    a, b = Vector(a), Vector(b); d = b - a; L = d.length
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=seg, radius1=r0, radius2=r1, depth=L)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4(), verts=bm.verts); return _obj(name, bm, m)
def box(name, m, size, loc, rot=(0, 0, 0), bevel=0.02):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); xf(bm, (0, 0, 0), (0, 0, 0), size)
    if bevel: bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect='EDGES', profile=0.6)
    xf(bm, loc, rot); return _obj(name, bm, m)
def torus(name, m, R, r, loc, rot=(0, 0, 0), scale=(1, 1, 1), seg=24, tseg=8, arc=1.0):
    bm = bmesh.new(); verts = []
    n = seg if arc >= 1 else seg + 1
    for i in range(n):
        u = (i / seg) * math.tau * arc; ring = []
        for j in range(tseg):
            v = (j / tseg) * math.tau; ring.append(bm.verts.new(((R + r * math.cos(v)) * math.cos(u), (R + r * math.cos(v)) * math.sin(u), r * math.sin(v))))
        verts.append(ring)
    rng = range(seg) if arc >= 1 else range(n - 1)
    for i in rng:
        a, b = verts[i], verts[(i + 1) % n]
        for j in range(tseg): bm.faces.new((a[j], b[j], b[(j + 1) % tseg], a[(j + 1) % tseg]))
    xf(bm, loc, rot, scale); return _obj(name, bm, m)
def cone(name, m, r, h, loc, rot=(0, 0, 0), seg=8):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=seg, radius1=r, radius2=0.0, depth=h); xf(bm, loc, rot); return _obj(name, bm, m)
def fin(name, m, pts, thick, loc, rot=(0, 0, 0), bevel=0.012):
    """a flat fin from a 2D outline (x, y) in its own plane, extruded `thick` along local z, then placed"""
    bm = bmesh.new(); vs = [bm.verts.new((x, y, -thick / 2)) for x, y in pts]; f = bm.faces.new(vs)
    ex = bmesh.ops.extrude_face_region(bm, geom=[f]); top = [e for e in ex['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, thick), verts=top); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bevel: bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect='EDGES')
    xf(bm, loc, rot); o = _obj(name, bm, m)
    for p in o.data.polygons: p.use_smooth = False
    return o
def join(name, objs):
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join(); o = bpy.context.view_layer.objects.active; o.name = name; o.data.name = name
    return o

parts = {k: [] for k in ('head', 'body', 'armL', 'armR', 'legL', 'legR', 'weapon')}
def add(region, o): parts[region].append(o); return o

# ---------------------------------------------------------------- HEAD (rigid to 'head'; KayKit heads are ~40% of the height)
H = lambda *a: add('head', a[0](*a[1:]))
H(ell, 'cranium', P['skin'], (0.52, 0.48, 0.44), (0, 0.03, 1.70), (0, 0, 0), 28, 16)
H(ell, 'back_shade', P['skinD'], (0.44, 0.40, 0.36), (0, 0.17, 1.82), (0.25, 0, 0), 24, 14)
H(ell, 'underjaw', P['belly'], (0.47, 0.44, 0.24), (0, -0.07, 1.42), (0.12, 0, 0), 26, 12)
H(ell, 'lip_upper', P['skinD'], (0.44, 0.12, 0.07), (0, -0.4, 1.52), (0.0, 0, 0), 22, 8)
H(ell, 'mouth', P['mouth'], (0.38, 0.1, 0.07), (0, -0.42, 1.45), (0, 0, 0), 20, 8)
H(ell, 'lip_lower', P['belly'], (0.42, 0.15, 0.08), (0, -0.44, 1.38), (-0.15, 0, 0), 22, 8)
for i in range(6):   # underbite needle teeth on the lower lip
    x = -0.27 + i * 0.108; H(cone, f'tooth{i}', P['teeth'], 0.033 if i in (0, 5) else 0.026, 0.11 if i in (0, 5) else 0.08, (x, -0.54 + abs(x) * 0.25, 1.47), (0.25, 0, 0), 6)
for sx in (-1, 1):
    H(ell, f'eyeball{sx}', P['eye'], (0.155, 0.13, 0.17), (sx * 0.25, -0.36, 1.82), (0, 0, sx * -0.15), 18, 12)
    H(ell, f'pupil{sx}', P['black'], (0.075, 0.05, 0.085), (sx * 0.265, -0.48, 1.81), (0, 0, 0), 12, 8)
    H(ell, f'glint{sx}', P['eye'], (0.022, 0.012, 0.022), (sx * 0.24, -0.525, 1.84), (0, 0, 0), 8, 6)
    H(box, f'brow{sx}', P['skinD'], (0.2, 0.09, 0.06), (sx * 0.24, -0.43, 1.99), (0.3, 0, sx * 0.38), 0.025)
    for g in range(3): H(torus, f'gill{sx}{g}', P['skinD'], 0.14, 0.016, (sx * 0.455, 0.0 + g * 0.07, 1.6), (0, math.pi / 2, 0), (1, 1, 1), 12, 5, 0.38)
    H(fin, f'earfin{sx}', P['fin'], [(0, 0), (0.05, 0.26), (0.2, 0.4), (0.38, 0.34), (0.46, 0.1), (0.32, -0.08)], 0.04, (sx * 0.53, 0.02, 1.56), (math.pi / 2, 0, math.pi / 2 + sx * 0.75))
    H(ell, f'cheek{sx}', P['red'], (0.07, 0.03, 0.035), (sx * 0.36, -0.38, 1.63), (0, 0, sx * -0.5), 10, 6)
# headband with knot tails (berserker war band) and a red war-paint stripe
H(torus, 'band', P['red'], 0.42, 0.05, (0, 0.04, 1.96), (0.1, 0, 0), (1.0, 0.92, 0.7), 28, 8)
H(box, 'knot', P['redD'], (0.12, 0.1, 0.1), (0, 0.5, 1.92), (0.3, 0, 0), 0.03)
H(box, 'tail1', P['red'], (0.08, 0.04, 0.28), (-0.06, 0.56, 1.8), (0.4, 0, 0.3), 0.015)
H(box, 'tail2', P['red'], (0.08, 0.04, 0.24), (0.07, 0.55, 1.79), (0.3, 0, -0.35), 0.015)
# head crest: a tall spiky dorsal fin front-to-back
H(fin, 'crest', P['fin'], [(-0.25, 0), (-0.18, 0.2), (-0.08, 0.12), (0.02, 0.36), (0.12, 0.2), (0.22, 0.42), (0.32, 0.18), (0.44, 0.26), (0.48, 0.0)], 0.04, (0, 0.02, 2.08), (math.pi / 2, 0, math.pi / 2))
for i, (y, h) in enumerate(((-0.15, 0.16), (0.02, 0.34), (0.22, 0.4), (0.4, 0.24))): H(cyl, f'spine{i}', P['finD'], 0.018, 0.008, (0, y, 2.1), (0, y + 0.02, 2.1 + h))

# ---------------------------------------------------------------- BODY (hips / spine / chest)
B = lambda *a: add('body', a[0](*a[1:]))
B(ell, 'torso', P['skin'], (0.4, 0.34, 0.42), (0, 0.03, 0.93), (0, 0, 0), 26, 14)
B(ell, 'belly', P['belly'], (0.31, 0.2, 0.33), (0, -0.16, 0.88), (0.1, 0, 0), 22, 12)
for i in range(4): B(torus, f'scale{i}', P['bellyD'], 0.26 - abs(i - 1.5) * 0.04, 0.012, (0, -0.295 + abs(i - 1.5) * 0.012, 0.74 + i * 0.1), (math.pi / 2 - 0.1, 0, 0), (1, 1, 0.5), 20, 4, 0.5)
B(ell, 'shorts', P['skinD'], (0.36, 0.31, 0.2), (0, 0.02, 0.55), (0, 0, 0), 22, 10)
B(torus, 'sash', P['red'], 0.37, 0.05, (0, 0.02, 0.64), (0, 0, 0), (1.0, 0.88, 1), 26, 8)
B(ell, 'buckle', P['bone'], (0.08, 0.04, 0.08), (0, -0.33, 0.64), (0, 0, 0), 12, 8)
B(box, 'flap', P['red'], (0.22, 0.05, 0.24), (0.05, -0.3, 0.46), (0.1, 0, 0.06), 0.02)
B(box, 'flap2', P['redD'], (0.14, 0.05, 0.2), (-0.13, -0.29, 0.48), (0.1, 0, -0.12), 0.02)
B(torus, 'strap', P['rope'], 0.43, 0.028, (0, -0.02, 0.97), (0.1, 0.62, 0), (1, 0.82, 1), 24, 6)
for i, t in enumerate((-0.6, 0.1, 0.8)):   # shark-tooth trinkets on the strap
    a = t; B(cone, f'charm{i}', P['teeth'], 0.03, 0.09, (math.sin(a) * 0.3 * math.cos(0.62), -0.34, 0.97 + math.sin(a) * 0.3 * math.sin(0.62) * 0.4 - 0.05), (math.pi, 0, 0), 6)
B(fin, 'backfin', P['fin'], [(0, 0), (-0.05, 0.3), (0.12, 0.2), (0.22, 0.38), (0.34, 0.1), (0.4, 0)], 0.04, (0, 0.34, 0.86), (math.pi / 2, 0, math.pi / 2 + 0.2))
B(fin, 'tailfin', P['fin'], [(0, 0), (-0.2, 0.22), (-0.06, 0.1), (0, 0.2), (0.06, 0.1), (0.2, 0.22)], 0.04, (0, 0.33, 0.48), (math.pi / 2 - 0.9, 0, 0))

# ---------------------------------------------------------------- ARMS (T-pose along ±X; arm axis z≈1.107)
for side, reg in ((1, 'armL'), (-1, 'armR')):
    A = lambda *a, reg=reg: add(reg, a[0](*a[1:]))
    s = side; Z = 1.107
    A(ell, f'shoulder{s}', P['skin'], (0.14, 0.14, 0.14), (s * 0.27, 0, Z), (0, 0, 0), 16, 10)
    A(cyl, f'upper{s}', P['skin'], 0.12, 0.11, (s * 0.24, 0, Z), (s * 0.47, 0, Z), 14)
    A(ell, f'elbow{s}', P['skin'], (0.115, 0.115, 0.115), (s * 0.46, 0, Z), (0, 0, 0), 14, 8)
    A(cyl, f'fore{s}', P['skin'], 0.115, 0.135, (s * 0.46, 0, Z), (s * 0.72, 0, Z), 14)
    A(fin, f'forefin{s}', P['finD'], [(0, 0), (0.12, 0.14), (0.24, 0.05), (0.22, 0)], 0.03, (s * 0.5, 0.05, Z + 0.1), (0, 0, 0) if s > 0 else (0, math.pi, 0))
    A(torus, f'wrist{s}', P['red'], 0.13, 0.03, (s * 0.71, 0, Z), (0, math.pi / 2, 0), (1, 1, 1), 18, 6)
    A(ell, f'hand{s}', P['skinD'], (0.12, 0.115, 0.13), (s * 0.82, -0.01, Z - 0.01), (0, 0, 0), 16, 10)
    A(ell, f'thumb{s}', P['skinD'], (0.05, 0.05, 0.07), (s * 0.79, -0.11, Z + 0.03), (0.5, 0, 0), 10, 6)
    for f in range(3): A(ell, f'finger{s}{f}', P['skinD'], (0.06, 0.045, 0.035), (s * 0.9, -0.05 + f * 0.05, Z - 0.05 + f * 0.0), (0, 0, 0), 10, 6)
# left: a turtle-shell pauldron with a bone spike; right: a red cloth wrap on the upper arm
add('armL', ell('shell', P['shell'], (0.21, 0.2, 0.13), (0.3, 0, 1.24), (0, 0.35, 0), 18, 10))
for i, (dx, dy) in enumerate(((0, 0), (0.08, 0.08), (0.08, -0.08), (-0.06, 0.09), (-0.06, -0.09))):
    add('armL', cyl(f'plate{i}', P['shellL'], 0.05, 0.045, (0.3 + dx, dy, 1.33 - abs(dx) * 0.5), (0.3 + dx * 1.05, dy * 1.05, 1.355 - abs(dx) * 0.5), 6))
add('armL', cone('spike', P['bone'], 0.04, 0.16, (0.38, 0, 1.36), (0, 0.6, 0), 6))
add('armR', torus('wrap1', P['red'], 0.13, 0.028, (-0.33, 0, 1.107), (0, math.pi / 2, 0), (1, 1, 1), 16, 6))
add('armR', torus('wrap2', P['redD'], 0.125, 0.025, (-0.39, 0, 1.107), (0, math.pi / 2, 0), (1, 1, 1), 16, 6))

# ---------------------------------------------------------------- LEGS (short, with big flipper feet)
for side, reg in ((1, 'legL'), (-1, 'legR')):
    L = lambda *a, reg=reg: add(reg, a[0](*a[1:]))
    x = side * 0.17
    L(cyl, f'thigh{side}', P['skinD'], 0.13, 0.115, (x, 0, 0.52), (x, 0, 0.29), 14)
    L(ell, f'knee{side}', P['skinD'], (0.115, 0.115, 0.1), (x, 0, 0.29), (0, 0, 0), 12, 8)
    L(cyl, f'shin{side}', P['skin'], 0.11, 0.1, (x, 0, 0.29), (x, 0, 0.11), 14)
    L(torus, f'ankle{side}', P['red'], 0.105, 0.026, (x, 0, 0.14), (0, 0, 0), (1, 1, 1), 16, 6)
    L(ell, f'foot{side}', P['skinD'], (0.13, 0.2, 0.07), (x, -0.08, 0.06), (0, 0, side * 0.15), 16, 8)
    L(fin, f'flipper{side}', P['fin'], [(-0.14, 0), (-0.16, -0.14), (-0.06, -0.1), (0, -0.18), (0.06, -0.1), (0.16, -0.14), (0.14, 0)], 0.03, (x, -0.2, 0.02), (0, 0, side * 0.15))

# ---------------------------------------------------------------- WEAPON: 鲸骨战刃 (whalebone cleaver), built along the hand's forward axis like KayKit's 2H weapons
W = lambda *a: add('weapon', a[0](*a[1:]))
hx, hz = -0.883, 1.049
W(cyl, 'grip', P['bone'], 0.038, 0.034, (hx, 0.3, hz), (hx, -0.62, hz), 10)
W(ell, 'pommel', P['bone'], (0.06, 0.06, 0.06), (hx, 0.33, hz), (0, 0, 0), 10, 8)
for i, y in enumerate((0.12, 0.0, -0.12)): W(torus, f'gwrap{i}', P['red'], 0.042, 0.016, (hx, y, hz), (math.pi / 2, 0, 0), (1, 1, 1), 12, 5)
W(box, 'guard', P['bone'], (0.24, 0.07, 0.1), (hx - 0.05, -0.6, hz), (0, 0, 0), 0.025)
# outline in (x = along the grip / forward, y = up from the grip) — a tall chopping blade with a notched spine and a hook at the tip
blade = [(x * 1.3, y * 1.3) for x, y in [(0.0, -0.06), (0.62, -0.1), (0.74, 0.02), (0.7, 0.3), (0.6, 0.36), (0.52, 0.3), (0.44, 0.38), (0.34, 0.32), (0.24, 0.38), (0.12, 0.34), (0.0, 0.28)]]
BR = (math.pi / 2, 0, -math.pi / 2)   # blade plane vertical, running forward (−Y) from the hand
W(fin, 'blade', P['steel'], blade, 0.06, (hx, -0.6, hz - 0.02), BR, 0.018)
W(fin, 'edge', P['edge'], [(x * 1.3, y * 1.3) for x, y in [(0.02, -0.06), (0.62, -0.1), (0.74, 0.02), (0.72, 0.06), (0.6, -0.04), (0.02, -0.0)]], 0.07, (hx, -0.6, hz - 0.02), BR, 0.006)
W(fin, 'spine', P['steelD'], [(x * 1.3, y * 1.3) for x, y in [(0.0, 0.28), (0.12, 0.34), (0.24, 0.38), (0.34, 0.32), (0.44, 0.38), (0.52, 0.3), (0.6, 0.36), (0.6, 0.3), (0.0, 0.22)]], 0.075, (hx, -0.6, hz - 0.02), BR, 0.006)
W(ell, 'rivet1', P['steelD'], (0.04, 0.05, 0.04), (hx, -0.72, hz + 0.1), (0, 0, 0), 8, 6)
W(ell, 'rivet2', P['steelD'], (0.04, 0.05, 0.04), (hx, -0.72, hz - 0.0), (0, 0, 0), 8, 6)
for i, (dx, dz) in enumerate(((0.3, 0.12), (0.5, 0.2), (0.42, 0.02))): W(box, f'rust{i}', P['rust'], (0.075, 0.08, 0.06), (hx, -0.6 - dx, hz - 0.02 + dz), (0.4 * i, 0, 0), 0.015)

# ---------------------------------------------------------------- join regions, skin to the rig
R = arm.data.bones
def bseg(name):   # bone segment in world space
    b = R[name]; return arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local
def weights_chain(o, chain, blend=0.05):
    """each vertex goes to the bone segment it is closest to; near joints it blends linearly over `blend`"""
    segs = [(n, *bseg(n)) for n in chain]
    vg = {n: o.vertex_groups.new(name=n) for n in chain}
    for v in o.data.vertices:
        p = o.matrix_world @ v.co; ds = []
        for n, a, b in segs:
            ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-9, ab.length_squared))); ds.append((n, (p - (a + ab * t)).length))
        ds.sort(key=lambda x: x[1]); n0, d0 = ds[0]
        if len(ds) > 1 and ds[1][1] - d0 < blend:
            w1 = 0.5 * (1 - (ds[1][1] - d0) / blend); vg[n0].add([v.index], 1 - w1, 'REPLACE'); vg[ds[1][0]].add([v.index], w1, 'REPLACE')
        else: vg[n0].add([v.index], 1.0, 'REPLACE')
def weights_rigid(o, bone): o.vertex_groups.new(name=bone).add([v.index for v in o.data.vertices], 1.0, 'REPLACE')
def weights_body(o):
    hips, spine, chest = (o.vertex_groups.new(name=n) for n in ('hips', 'spine', 'chest'))
    for v in o.data.vertices:
        z = (o.matrix_world @ v.co).z
        def ramp(z0, z1): return max(0.0, min(1.0, (z - z0) / (z1 - z0)))
        a = ramp(0.56, 0.68); c = ramp(0.94, 1.04)
        w_h, w_s, w_c = 1 - a, a * (1 - c), c
        for g, w in ((hips, w_h), (spine, w_s), (chest, w_c)):
            if w > 1e-3: g.add([v.index], w, 'REPLACE')

objs = {}
for reg, lst in parts.items(): objs[reg] = join('Fishman_' + reg.capitalize(), lst)
weights_rigid(objs['head'], 'head')
weights_body(objs['body'])
weights_chain(objs['armL'], ['upperarm.l', 'lowerarm.l', 'hand.l'], 0.06)
weights_chain(objs['armR'], ['upperarm.r', 'lowerarm.r', 'hand.r'], 0.06)
weights_chain(objs['legL'], ['upperleg.l', 'lowerleg.l', 'foot.l'], 0.05)
weights_chain(objs['legR'], ['upperleg.r', 'lowerleg.r', 'foot.r'], 0.05)
# the shell pauldron rides the upper arm fully
for reg in ('armL',):
    o = objs[reg]
for reg in ('head', 'body', 'armL', 'armR', 'legL', 'legR'):
    o = objs[reg]; o.parent = arm; md = o.modifiers.new('Armature', 'ARMATURE'); md.object = arm
    try: o.data.set_sharp_from_angle(angle=math.radians(50))
    except Exception: pass
# weapon: a rigid child of the hand slot bone (like KayKit's weapon meshes)
w = objs['weapon']; mw = w.matrix_world.copy(); w.parent = arm; w.parent_type = 'BONE'; w.parent_bone = 'handslot.r'; w.matrix_world = mw
w.name = 'Fishman_Cleaver'
print('POLY', {k: len(o.data.polygons) for k, o in objs.items()})

# ---------------------------------------------------------------- previews: rest pose and a few animation frames
scn = bpy.context.scene
for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'BLENDER_WORKBENCH'):
    try: scn.render.engine = eng; break
    except Exception: pass
scn.render.resolution_x, scn.render.resolution_y = 520, 640
wd = bpy.data.worlds.new('w'); scn.world = wd; wd.use_nodes = True; wd.node_tree.nodes['Background'].inputs[0].default_value = (0.16, 0.15, 0.22, 1); wd.node_tree.nodes['Background'].inputs[1].default_value = 1.2
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); coll.objects.link(cam); scn.camera = cam; cam.data.lens = 55
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.2; sun.rotation_euler = (math.radians(55), 0, math.radians(-35)); coll.objects.link(sun)
fill = bpy.data.objects.new('fill', bpy.data.lights.new('fill', 'SUN')); fill.data.energy = 1.0; fill.rotation_euler = (math.radians(70), 0, math.radians(150)); coll.objects.link(fill)
def shoot(path, az=-35, el=12, dist=6.2, target=(0, 0, 1.05)):
    t = Vector(target); a, e = math.radians(az), math.radians(el)
    cam.location = t + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    cam.rotation_euler = (t - cam.location).to_track_quat('-Z', 'Y').to_euler(); scn.render.filepath = path; bpy.ops.render.render(write_still=True)
os.makedirs(PREV, exist_ok=True)
shoot(os.path.join(PREV, 'fm_rest_front.png'), -25, 10)
shoot(os.path.join(PREV, 'fm_rest_back.png'), 160, 25)
acts = {a.name: a for a in bpy.data.actions}
print('ACTIONS', list(acts))
if arm.animation_data is None: arm.animation_data_create()
for name, frac in (('Idle', 0.3), ('2H_Melee_Attack_Chop', 0.45), ('Hit_A', 0.3), ('Cheer', 0.5)):
    a = acts.get(name)
    if not a: continue
    arm.animation_data.action = a
    try:
        if hasattr(arm.animation_data, 'action_suitable_slots') and arm.animation_data.action_suitable_slots: arm.animation_data.action_slot = arm.animation_data.action_suitable_slots[0]
    except Exception: pass
    f0, f1 = a.frame_range; scn.frame_set(int(f0 + (f1 - f0) * frac))
    shoot(os.path.join(PREV, f'fm_{name}.png'), -30, 12)
arm.animation_data.action = None; scn.frame_set(0)

# ---------------------------------------------------------------- export
for o in bpy.context.selected_objects: o.select_set(False)
kw = dict(filepath=OUT, export_format='GLB', export_animations=True, export_skins=True, export_apply=True, export_yup=True)
try: bpy.ops.export_scene.gltf(**kw, export_animation_mode='ACTIONS')
except TypeError: bpy.ops.export_scene.gltf(**kw)
print('EXPORTED', OUT, os.path.getsize(OUT))
