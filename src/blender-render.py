"""Render an E39 configurator snapshot locally with Blender 4.5 / Cycles.
Usage: blender --background --python render.py
No uploads, cloud API, private record access, or additional Python packages.
"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Matrix, Vector

base = Path(__file__).resolve().parent
config = json.loads((base / 'render.json').read_text(encoding='utf-8'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(base / 'scene.glb'))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 128
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.025
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 8
scene.cycles.transparent_max_bounces = 12
scene.cycles.seed = 2718

device_name = 'CPU'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'
    prefs.get_devices()
    available = [device for device in prefs.devices if device.type == 'OPTIX']
    if available:
        for device in prefs.devices:
            device.use = device.type == 'OPTIX'
        scene.cycles.device = 'GPU'
        scene.cycles.denoiser = 'OPTIX'
        device_name = ', '.join(device.name for device in available)
except Exception:
    scene.cycles.device = 'CPU'

scene.render.resolution_x = config['width']
scene.render.resolution_y = config['height']
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.color_depth = '8'
scene.render.film_transparent = False
scene.render.filepath = str(base / 'E39-Cycles.png')
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = math.log2(config['exposure'])
procedural = config.get('environment', {}).get('kind') == 'procedural-tuning-bay'
scene.world = bpy.data.worlds.new('Tuning-Garage' if procedural else 'Fotohalle – gleicher CC0-Lichtraum')
scene.world.use_nodes = True
nodes = scene.world.node_tree.nodes
links = scene.world.node_tree.links


def linear_color(value):
    rgb = [int(value.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb)


def y_up(value):
    # glTF import maps Three's right-handed Y-up scene to Blender Z-up.
    return Vector((value[0], -value[2], value[1]))


if procedural:
    environment_config = config['environment']
    nodes.get('Background').inputs['Color'].default_value = (*linear_color(environment_config['worldColor']), 1)
    nodes.get('Background').inputs['Strength'].default_value = environment_config['worldStrength']
else:
    # Older saved scene packages remain readable by the same render script.
    environment = nodes.new('ShaderNodeTexEnvironment')
    environment.image = bpy.data.images.load(str(base / 'environment.hdr'))
    mapping = nodes.new('ShaderNodeMapping')
    coordinates = nodes.new('ShaderNodeTexCoord')
    mapping.inputs['Rotation'].default_value[2] = -math.radians(config['lightAngle'])
    links.new(coordinates.outputs['Generated'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], environment.inputs['Vector'])
    links.new(environment.outputs['Color'], nodes.get('Background').inputs['Color'])
    nodes.get('Background').inputs['Strength'].default_value = 0.65

for obj in scene.objects:
    if obj.type == 'CAMERA' and obj.name.startswith('E39_RENDER_CAMERA'):
        scene.camera = obj
        obj.data.lens = 24 / (2 * math.tan(math.radians(config['cameraFov']) / 2))
        obj.data.sensor_fit = 'VERTICAL'
        obj.data.sensor_height = 24
    if obj.type == 'LIGHT':
        # Preview lights are approximations; use the exported fixture layout.
        obj.hide_render = True
    if obj.name.startswith('E39_RENDER_FLOOR') and not procedural:
        obj.scale.x *= 8
        obj.scale.y *= 8
        obj.is_shadow_catcher = True
    if procedural and obj.name.startswith('E39_EMITTER_'):
        # Area lights supply energy; visible diffusers remain in camera/glossy
        # rays without a second diffuse-light contribution from mesh emission.
        obj.visible_diffuse = False

if procedural:
    for panel in config['environment']['lights']:
        light = bpy.data.lights.new('Tuning-' + panel['name'], 'AREA')
        light.shape = 'RECTANGLE'
        light.size = panel['width']
        light.size_y = panel['height']
        light.energy = panel['watts']
        light.color = linear_color(panel['color'])
        fixture = bpy.data.objects.new(light.name, light)
        scene.collection.objects.link(fixture)
        fixture.location = y_up(panel['position'])
        direction = (y_up(panel['target']) - fixture.location).normalized()
        right = direction.cross(y_up(panel['up'])).normalized()
        back = -direction
        up = back.cross(right).normalized()
        fixture.rotation_euler = Matrix((right, up, back)).transposed().to_euler()

if scene.camera is None:
    raise RuntimeError('Die exportierte Konfigurator-Kamera fehlt.')

for material in bpy.data.materials:
    if not material.use_nodes:
        continue
    shader = next((n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if shader is None:
        continue
    if material.name.startswith('pab_e39_glass'):
        # Thin glass with Fresnel reflections; use the exported pane geometry.
        shader.inputs['Base Color'].default_value = (0.82, 0.9, 0.87, 1)
        shader.inputs['Alpha'].default_value = 1
        shader.inputs['Transmission Weight'].default_value = 0.96
        shader.inputs['Roughness'].default_value = 0.035
        shader.inputs['IOR'].default_value = 1.45
        material.surface_render_method = 'DITHERED'
    if material.name.startswith('pab_e39_paint') and not procedural:
        shader.inputs['Metallic'].default_value = 0.3
        shader.inputs['Roughness'].default_value = 0.28
        shader.inputs['Coat Weight'].default_value = 0.85
        shader.inputs['Coat Roughness'].default_value = 0.12

bpy.ops.wm.save_as_mainfile(filepath=str(base / 'E39-Konfigurator.blend'))
print('E39_CYCLES_DEVICE=' + device_name, flush=True)
bpy.ops.render.render(write_still=True)
(base / 'render-proof.json').write_text(json.dumps({
    'engine': 'Blender Cycles', 'blender': bpy.app.version_string,
    'device': device_name, 'width': config['width'], 'height': config['height'],
    'maxSamples': scene.cycles.samples, 'adaptiveThreshold': scene.cycles.adaptive_threshold,
    'denoising': True, 'source': 'actual configurator scene.glb',
    'privatePhotosIncluded': False,
    'environment': 'procedural-tuning-bay' if procedural else 'photo-hdri',
    'lightPanels': len(config['environment']['lights']) if procedural else 0,
}, indent=2), encoding='utf-8')
