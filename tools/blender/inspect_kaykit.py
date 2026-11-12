# Blender (background) — import a KayKit character, print its proportions, render a 3/4 reference image.
# blender -b -P tools/blender/inspect_kaykit.py -- <in.glb> <out.png>
import bpy, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
mn, mx = Vector((1e9,) * 3), Vector((-1e9,) * 3)
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c); mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
    print('mesh', o.name, 'verts', len(o.data.vertices), 'faces', len(o.data.polygons), 'parent', o.parent.name if o.parent else None, 'parent_bone', o.parent_bone, 'groups', len(o.vertex_groups), 'mats', [m.name for m in o.data.materials])
print('bbox', tuple(round(v, 3) for v in mn), tuple(round(v, 3) for v in mx))
for b in arm.data.bones:
    if b.name in ('hips', 'spine', 'chest', 'head', 'upperarm.l', 'lowerarm.l', 'hand.l', 'handslot.r', 'upperleg.l', 'lowerleg.l', 'foot.l'):
        print('bone', b.name, tuple(round(v, 3) for v in (arm.matrix_world @ b.head_local)), tuple(round(v, 3) for v in (arm.matrix_world @ b.tail_local)))
# render
scn = bpy.context.scene
for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'BLENDER_WORKBENCH'):
    try: scn.render.engine = eng; break
    except Exception: pass
scn.render.resolution_x, scn.render.resolution_y = 600, 700
scn.render.film_transparent = False
w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.12, 0.11, 0.16, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam); scn.camera = cam
ctr = (mn + mx) / 2; h = mx.z - mn.z
cam.location = ctr + Vector((h * 1.3, -h * 2.0, h * 0.45)); cam.data.lens = 50
d = ctr - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.5; sun.rotation_euler = (math.radians(50), 0, math.radians(30)); scn.collection.objects.link(sun)
scn.render.filepath = out
bpy.ops.render.render(write_still=True)
print('rendered', out)
