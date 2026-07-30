# ZPX Engine Technical Specification

## Lead Architect: Enterprise-Grade Engine Design
## Language: Native `.zpx` — Zero External Dependencies

---

# 1. Scene Architecture & ECS

## 1.1 Core ECS Syntax

Entities, Components, and Systems are first-class `.zpx` constructs:

```zpx
# --- Entity Definition ---
entity Player(
  transform: Transform,
  mesh: MeshRenderer,
  physics: Rigidbody,
  script: PlayerController
)

# --- Component Definitions ---
comp Transform:
  pos: vec3 = vec3(0, 0, 0)
  rot: quat = quat(0, 0, 0, 1)
  scl: vec3 = vec3(1, 1, 1)

comp MeshRenderer:
  mesh_type: str = "cube"
  material: Material
  cast_shadows: bool = true
  receive_shadows: bool = true

comp Rigidbody:
  body_type: str = "dynamic"    # static | dynamic | kinematic
  mass: f32 = 1.0
  drag: f32 = 0.01
  angular_drag: f32 = 0.05
  use_gravity: bool = true

comp Material:
  shader: str = "standard"      # standard | unlit | transparent | emissive | water | grass
  color: vec4 = vec4(1, 1, 1, 1)
  metallic: f32 = 0.0
  roughness: f32 = 0.5
  normal_map: str = ""
  emission: f32 = 0.0
```

## 1.2 Scene Tree Structure

Native parent-child hierarchy with spatial transforms:

```zpx
# --- Scene Declaration ---
scene MainMenu:
  entities:
    - Camera(transform=Transform(pos=vec3(0, 5, 10)))
    - DirectionalLight(transform=Transform(pos=vec3(5, 10, 5)))
    - button: Button(
        transform=Transform(pos=vec3(0, 0, 0)),
        text="Play Game"
      )

scene Level1:
  inherit: MainMenu   # scene inheritance
  entities:
    - player: Player(
        transform=Transform(pos=vec3(0, 1, 0)),
        tag="player"
      )
    - ground: Entity(
        transform=Transform(scl=vec3(20, 1, 20)),
        components=[MeshRenderer(mesh="plane"), Rigidbody(body_type="static")]
      )
    - enemies: Entity(
        tag="enemy_group",
        children=[                          # parent-child hierarchy
          Enemy(transform=Transform(pos=vec3(-5, 0, -10))),
          Enemy(transform=Transform(pos=vec3(0, 0, -12))),
          Enemy(transform=Transform(pos=vec3(5, 0, -10)))
        ]
      )
```

## 1.3 Object Instantiation & Destruction

Runtime entity management:

```zpx
# --- Instantiation ---
bullet = spawn(Entity(
  transform=Transform(pos=player.pos, rot=player.rot),
  components=[
    MeshRenderer(mesh="sphere", color=vec4(1, 1, 0, 1)),
    Rigidbody(body_type="dynamic", mass=0.1),
    Projectile(damage=10, speed=50)
  ]
))

# --- Tag-Based Queries ---
all_enemies = find_entities(tag="enemy")
player_obj = find_entity(tag="player")
lights = find_entities(comp=DirectionalLight)

# --- Destruction ---
destroy(bullet)

# --- Parent-Child Operations ---
set_parent(enemy, player_obj)
get_children(player_obj)    # returns array of entities
get_parent(enemy)           # returns parent entity or none

# --- Component Access ---
pos = player[Transform].pos
player[Transform].pos.x += 1
player[MeshRenderer].color = vec4(1, 0, 0, 1)

# --- Event Hooks ---
entity.on_collision(fn(other: Entity):
  log("Hit: " + other.name)
end)

entity.on_destroy(fn():
  spawn(ParticleEffect(transform=self.transform))
end)
```

## 1.4 System Pipeline

Systems operate on entities with matching components:

```zpx
# --- System Definition ---
system MovementSystem:
  requires: [Transform, Rigidbody, PlayerController]
  run(fn(dt: f32):
    for entity in self.query():
      ctrl = entity[PlayerController]
      rb = entity[Rigidbody]
      force = vec3(0, 0, 0)
      if input.key("w"): force.z -= ctrl.speed
      if input.key("s"): force.z += ctrl.speed
      if input.key("a"): force.x -= ctrl.speed
      if input.key("d"): force.x += ctrl.speed
      rb.apply_force(force)
  end)
end

# --- System Registration ---
register_system(MovementSystem, priority=10)
register_system(RenderSystem, priority=100)
register_system(PhysicsSystem, priority=20)
```

---

# 2. Deep Physics & Collision Engine

## 2.1 Physics World Configuration

```zpx
# --- Physics Global Settings ---
physics:
  gravity: vec3 = vec3(0, -9.81, 0)
  time_step: f32 = 0.0167          # 60Hz fixed step
  solver_iterations: i32 = 8
  velocity_iterations: i32 = 4
  max_substeps: i32 = 4

# --- Physics Material ---
phys_mat PhysicsMaterial:
  friction: f32 = 0.5
  rolling_friction: f32 = 0.1
  bounce: f32 = 0.3               # restitution
  bounce_threshold: f32 = 0.5     # min velocity for bounce
  density: f32 = 1.0
```

## 2.2 Collider Types & Configuration

```zpx
# --- Collider Components ---
comp BoxCollider:
  size: vec3 = vec3(1, 1, 1)
  offset: vec3 = vec3(0, 0, 0)
  is_trigger: bool = false
  material: PhysicsMaterial
  layer: str = "default"

comp SphereCollider:
  radius: f32 = 0.5
  offset: vec3 = vec3(0, 0, 0)
  is_trigger: bool = false

comp CapsuleCollider:
  height: f32 = 2.0
  radius: f32 = 0.5
  direction: str = "y"            # axis of capsule
  offset: vec3 = vec3(0, 0, 0)

comp MeshCollider:
  mesh: str = ""                  # reference to .zpx mesh asset
  convex: bool = true             # convex for dynamic, concave for static
  is_trigger: bool = false

comp CompoundCollider:
  children: [BoxCollider, SphereCollider]  # multi-shape body

# --- Layer-Based Collision Matrix ---
collision_matrix:
  default: [default, ground, player, enemy]
  player: [ground, enemy, collectible]
  enemy: [ground, player, wall]
  trigger: [player]
```

## 2.3 Rigid Body Dynamics API

```zpx
# --- Rigid Body Attached to Entity ---
rigidbody(entity: Entity):
  obj = entity[Rigidbody]
  obj.apply_force(vec3(0, 100, 0))
  obj.apply_torque(vec3(0, 5, 0))
  obj.apply_impulse(vec3(0, 10, 0), point=vec3(0, 0, 0))
  obj.add_velocity(vec3(0, 0, -10))
  obj.set_angular_velocity(vec3(0, 1, 0))
  obj.clear_forces()

  obj.mass = 2.0
  obj.drag = 0.5
  obj.constraints = PositionConstraint(x=true, y=false, z=true)
  obj.sleep_threshold = 0.005

# --- Constraint Types ---
constraint FixedJoint:
  entity_a: Entity
  entity_b: Entity
  anchor_a: vec3
  anchor_b: vec3

constraint HingeJoint:
  axis: vec3 = vec3(0, 1, 0)
  limits: vec2 = vec2(-90, 90)    # angle limits
  motor_speed: f32 = 0.0
  motor_force: f32 = 0.0

constraint SpringJoint:
  rest_length: f32 = 1.0
  stiffness: f32 = 100.0
  damping: f32 = 10.0
```

## 2.4 Collision Events & Callbacks

```zpx
# --- Collision Event System ---
entity.on_collision_enter(fn(other: Entity, contact: CollisionContact):
  log("Collided with " + other.name)
  log("Contact point: " + str(contact.point))
  log("Normal: " + str(contact.normal))
  log("Impulse: " + str(contact.impulse))
  if other.has_tag("collectible"):
    collect(other)
  elif other.has_tag("enemy"):
    take_damage(other[Enemy].damage)
  end
end)

entity.on_collision_stay(fn(other: Entity, contact: CollisionContact):
  # Continuous contact (e.g., standing on ground)
  if other.has_tag("ground"):
    player.can_jump = true
  end
end)

entity.on_collision_exit(fn(other: Entity):
  log("No longer touching " + other.name)
  if other.has_tag("ground"):
    player.can_jump = false
  end
end)

entity.on_trigger_enter(fn(other: Entity):
  # Trigger zones (no physical response)
  if other.has_tag("checkpoint"):
    save_game(other)
  end
end)

# --- Contact Data Structure ---
struct CollisionContact:
  point: vec3
  normal: vec3
  impulse: f32
  relative_velocity: f32
  friction_force: f32
```

## 2.5 Raycasting & Physics Queries

```zpx
# --- Raycast API ---
result = raycast(
  origin=vec3(0, 0, 0),
  direction=vec3(0, -1, 0),
  max_dist=100.0,
  layers=["default", "ground"],
  ignore=[player_entity]
)

if result.hit:
  log("Hit: " + result.entity.name)
  log("Point: " + str(result.point))
  log("Normal: " + str(result.normal))
  log("Distance: " + str(result.distance))
  result.entity[MeshRenderer].color = vec4(1, 0, 0, 1)

# --- Physics Queries ---
hits = sphere_cast(
  origin=vec3(0, 0, 0),
  radius=5.0,
  layers=["enemy"]
)

hits = overlap_box(
  center=vec3(0, 0, 0),
  size=vec3(2, 2, 2),
  rotation=quat(0, 0, 0, 1)
)

grounded = check_grounded(
  entity=player,
  distance=0.1,
  layer="ground"
)
```

## 2.6 Complete Physics Example

```zpx
# --- Full Physics Scene ---
scene PhysicsDemo:
  entities:
    - player: Entity(
        tag="player",
        transform=Transform(pos=vec3(0, 5, 0)),
        components=[
          MeshRenderer(mesh="capsule", color=vec4(0.2, 0.6, 1.0, 1)),
          Rigidbody(mass=1, drag=0.1),
          CapsuleCollider(height=2, radius=0.5),
          PlayerController(speed=10, jump=8)
        ]
      )
    - ground: Entity(
        transform=Transform(pos=vec3(0, 0, 0), scl=vec3(50, 1, 50)),
        components=[
          MeshRenderer(mesh="plane", color=vec4(0.3, 0.7, 0.3, 1)),
          Rigidbody(body_type="static"),
          BoxCollider(size=vec3(50, 1, 50))
        ]
      )
    - ramp: Entity(
        transform=Transform(pos=vec3(10, 0, 0), rot=quat(0, 0, 0.2, 0.98)),
        components=[
          MeshRenderer(mesh="box", color=vec4(0.5, 0.5, 0.5, 1)),
          Rigidbody(body_type="static"),
          BoxCollider(size=vec3(5, 0.5, 2))
        ]
      )
    - trigger: Entity(
        tag="win_zone",
        transform=Transform(pos=vec3(20, 1, 0), scl=vec3(3, 5, 3)),
        components=[
          BoxCollider(is_trigger=true)
        ]
      )

# --- Player Controller with Full Physics ---
system PlayerController:
  requires: [Transform, Rigidbody, CapsuleCollider, PlayerController]

  run(fn(dt: f32):
    rb = self[Rigidbody]
    ctrl = self[PlayerController]
    collider = self[CapsuleCollider]

    # Ground check using sphere cast
    ground = sphere_cast(
      origin=self[Transform].pos + vec3(0, -collider.height/2, 0),
      radius=collider.radius * 0.9,
      max_dist=0.1,
      layers=["default", "ground"]
    )
    is_grounded = ground.hit

    # Movement
    move_dir = vec3(
      (input.key("d") ? 1 : 0) - (input.key("a") ? 1 : 0),
      0,
      (input.key("w") ? 1 : 0) - (input.key("s") ? 1 : 0)
    )

    if move_dir.length() > 0:
      move_dir = move_dir.normalized()
      target_vel = move_dir * ctrl.speed
      current_hvel = vec3(rb.velocity.x, 0, rb.velocity.z)
      new_hvel = current_hvel.lerp(target_vel, dt * 10)
      rb.set_velocity(vec3(new_hvel.x, rb.velocity.y, new_hvel.z))
    else:
      # Friction stop
      current_hvel = vec3(rb.velocity.x, 0, rb.velocity.z)
      friction_stop = current_hvel.lerp(vec3(0, 0, 0), dt * 8)
      rb.set_velocity(vec3(friction_stop.x, rb.velocity.y, friction_stop.z))

    # Jump
    if input.key_down("space") and is_grounded:
      rb.set_velocity(vec3(rb.velocity.x, ctrl.jump, rb.velocity.z))

    # Slope handling
    if is_grounded:
      ground_normal = ground.normal
      if ground_normal.y < 0.7:   # slope too steep
        slide_dir = vec3.cross(vec3.cross(ground_normal, vec3(0, 1, 0)), ground_normal)
        rb.add_force(slide_dir * 20)
      end
    end
  end)
end

# --- Win Trigger ---
entity.on_trigger_enter(fn(other: Entity):
  if other.has_tag("win_zone"):
    load_scene("LevelComplete")
  end
end)
```

---

# 3. Inspector & Property System

## 3.1 Component Metadata & Property Attributes

```zpx
# --- Property Attributes for Auto-Generated UI ---
comp Light:
  @tooltip("Light type: directional, point, spot, area")
  @range(0, 5, 0.1)
  @category("Basic")
  light_type: str = "directional"

  @color_picker
  @category("Basic")
  color: vec4 = vec4(1, 1, 1, 1)

  @range(0, 10, 0.1)
  @slider
  @category("Basic")
  intensity: f32 = 1.0

  @range(0, 1000)
  @category("Advanced")
  range: f32 = 50.0

  @range(0, 180)
  @category("Spot")
  spot_angle: f32 = 30.0

  @range(0, 100)
  @category("Spot")
  spot_blend: f32 = 2.0

  @category("Shadows")
  shadow_bias: f32 = 0.005

  @category("Shadows")
  shadow_normal_bias: f32 = 0.02

  @category("Shadows")
  shadow_resolution: i32 = 1024

  @toggle("Cast Shadows")
  @category("Shadows")
  cast_shadows: bool = true
```

## 3.2 Inspector Serialization Format

```zpx
# --- Component Data Serialized to .zpx ---
save_component(player, Light, "player_light.zpx")

# --- Output File: player_light.zpx ---
comp_data Light:
  light_type = "directional"
  color = vec4(1, 1, 0.9, 1)
  intensity = 1.5
  range = 50
  cast_shadows = true
end

# --- Loading Component Data ---
load_component(player, "player_light.zpx")
```

## 3.3 Script Variable Exposure

```zpx
# --- Exposed Variables Visible in Inspector ---
script PlayerController:
  @range(0, 50, 0.5)
  @slider
  @tooltip("Movement speed in units/sec")
  speed: f32 = 10.0

  @range(0, 30, 0.5)
  jump: f32 = 8.0

  @range(0, 5, 0.1)
  @category("Air Control")
  air_control: f32 = 0.3

  @toggle("Double Jump")
  @category("Jump Settings")
  double_jump: bool = false

  @range(0, 3, 1)
  @category("Jump Settings")
  max_jumps: i32 = 1

  @file("*.zpx")
  @tooltip("Reference to input mappings")
  input_profile: str = "default_input.zpx"

  @asset("audio")
  @tooltip("Sound played on jump")
  jump_sound: str = ""

  @asset("material")
  trail_material: str = ""
```

## 3.4 Material & Shader Property Architecture

```zpx
# --- Shader Definition Language ---
shader Standard:
  properties:
    @texture2d
    @default("white")
    _MainTex: str = ""

    @color
    _Color: vec4 = vec4(1, 1, 1, 1)

    @range(0, 1)
    _Metallic: f32 = 0.0

    @range(0, 1)
    @slider
    _Roughness: f32 = 0.5

    @range(0, 1)
    _AmbientOcclusion: f32 = 1.0

    @texture2d
    @normal_map
    _NormalMap: str = ""

    @range(0, 5)
    _NormalStrength: f32 = 1.0

    @texture2d
    _EmissionMap: str = ""

    @color(HDR)
    _EmissionColor: vec4 = vec4(0, 0, 0, 0)

    @range(0.01, 10)
    _EmissionIntensity: f32 = 1.0

# --- Material Instance ---
mat MyMaterial:
  base: "Standard"
  overrides:
    _Color = vec4(0.2, 0.6, 1.0, 1)
    _Metallic = 0.8
    _Roughness = 0.2
    _EmissionColor = vec4(0.1, 0.3, 0.8, 1)
    _EmissionIntensity = 0.5

# --- Custom Shader Pipeline ---
shader_custom Water:
  properties:
    _WaveSpeed: f32 = 1.0
    _WaveHeight: f32 = 0.5
    _DepthColor: vec4 = vec4(0, 0.2, 0.4, 1)
    _ShallowColor: vec4 = vec4(0.1, 0.6, 0.5, 1)
    _Refraction: f32 = 0.1
    _Reflection: f32 = 0.3
```

## 3.5 UI Auto-Generation from Metadata

The editor reads `@range`, `@slider`, `@color_picker`, `@toggle`, `@asset`, `@file`, `@category`, `@tooltip` attributes to auto-generate:

| Attribute | UI Element | Example |
|-----------|-----------|---------|
| `@range(min, max, step)` | Number input with slider | `@range(0, 100, 1)` |
| `@slider` | Range slider widget | `@range(0, 1) @slider` |
| `@color_picker` | Color picker (RGB/HSV) | `@color_picker` |
| `@toggle(label)` | Checkbox | `@toggle("Cast Shadows")` |
| `@asset(type)` | Asset browser button | `@asset("audio")` |
| `@file(pattern)` | File picker | `@file("*.zpx")` |
| `@category(name)` | Grouping header | `@category("Advanced")` |
| `@tooltip(text)` | Hover tooltip | `@tooltip("Speed in m/s")` |

---

# 4. Input & Event Handling System

## 4.1 Input Abstraction Layer

```zpx
# --- Input System Architecture ---
input_system:
  polling_rate: i32 = 1000          # Hz
  deadzone: f32 = 0.1               # controller deadzone
  mouse_sensitivity: f32 = 1.0

# --- Input Action Bindings (configurable) ---
input_actions:
  MoveForward:
    keys: [KeyW, UpArrow]
    gamepad: [LeftStickUp]
    mod: none

  MoveBackward:
    keys: [KeyS, DownArrow]
    gamepad: [LeftStickDown]

  MoveLeft:
    keys: [KeyA, LeftArrow]
    gamepad: [LeftStickLeft]

  MoveRight:
    keys: [KeyD, RightArrow]
    gamepad: [LeftStickRight]

  Jump:
    keys: [Space]
    gamepad: [ButtonA]

  Fire:
    keys: [MouseLeft]
    gamepad: [RightTrigger]

  Interact:
    keys: [KeyE]
    gamepad: [ButtonX]

  Pause:
    keys: [Escape, KeyP]
    gamepad: [Start]
```

## 4.2 Input Query API (Runtime)

```zpx
# --- Current Frame State ---
held = input.action("Fire")              # bool: held this frame
pressed = input.action_down("Jump")       # bool: just pressed this frame
released = input.action_up("Jump")        # bool: just released this frame

value = input.action_value("MoveForward") # f32: 0.0 to 1.0 (analog)
axis = input.action_axis("Move")          # vec2: combined axis

# --- Raw Input ---
if input.key(KeyW): ...                   # held
if input.key_down(KeySpace): ...          # just pressed
if input.key_up(KeyE): ...                # just released

mouse_pos = input.mouse_position()        # vec2: screen coordinates
mouse_delta = input.mouse_delta()         # vec2: frame delta
mouse_wheel = input.mouse_wheel()         # f32: scroll delta
mouse_world = input.mouse_to_world(camera, plane_y=0)  # raycast to world

# --- Gamepad ---
gamepad_ls = input.gamepad(0, LeftStick)  # vec2
gamepad_rs = input.gamepad(0, RightStick) # vec2
gamepad_lt = input.gamepad(0, LeftTrigger)# f32 0-1
if input.gamepad_down(0, ButtonB): ...    # just pressed
```

## 4.3 Event Dispatch Loop

```zpx
# --- Event Bus Architecture ---
event InputEvent:
  type: str        # "key_down" | "key_up" | "mouse_move" | "gamepad"
  code: str
  value: f32
  position: vec2
  delta: vec2

event CollisionEvent:
  type: str        # "enter" | "stay" | "exit"
  entity_a: Entity
  entity_b: Entity
  contact: CollisionContact

event TriggerEvent:
  type: str        # "enter" | "exit"
  entity: Entity
  other: Entity

event CustomEvent:
  name: str
  data: any

# --- Event Bus Usage ---
event_bus:
  subscribe("collision.enter", fn(e: CollisionEvent):
    log(e.entity_a.name + " hit " + e.entity_b.name)
  end)

  subscribe("input.jump", fn(e: InputEvent):
    player[Rigidbody].apply_impulse(vec3(0, 10, 0))
  end)

  emit("custom.score", CustomEvent(name="score_change", data=100))

# --- Input Event Pipeline ---
# Frame 1: Poll hardware -> RawInputEvent
# Frame 2: Map to actions -> ActionEvent
# Frame 3: Dispatch to subscribers -> System callbacks
# Frame 4: Systems consume -> Entity updates
```

## 4.4 Advanced Input: Gestures & Composite

```zpx
# --- Gesture Recognition ---
gesture SwipeDetector:
  min_distance: f32 = 50.0
  max_time: f32 = 0.5
  directions: [str] = ["up", "down", "left", "right"]
  on_swipe(fn(direction: str, velocity: f32):
    if direction == "up": player.jump()
    elif direction == "right": player.dash()
  end)

# --- Composite Input ---
combo_input TripleJump:
  sequence: [Jump, Jump, Jump]
  window: f32 = 0.8
  on_complete(fn():
    player.super_jump()
  end)

# --- Input Recording / Playback ---
input_recorder:
  start_recording("demo.zpx")
  stop_recording()
  play_recording("demo.zpx", loop=true)
```

---

# 5. Cross-Platform Build & Asset Pipeline

## 5.1 Build Configuration

```zpx
# --- Build Profile ---
build_profile Desktop:
  target_platforms: [windows, linux, macos]
  optimizations: ["size", "speed"]
  bundle_mode: "single_file"       # single exe | directory | compressed

build_profile Web:
  target: "webgpu"
  profile: "release"
  wasm_memory: 64                  # MB initial

build_profile Console:
  target_platforms: [ps5, xbox_series]
  sdk_paths:
    ps5: "C:/SDKs/PS5"
    xbox: "C:/SDKs/Xbox"
```

## 5.2 Asset Pipeline & Packaging

```zpx
# --- Asset Directives at Build Time ---
asset_pipeline:
  textures:
    formats: [png, jpg, hdr, tga, dds]
    compress: true
    max_size: 4096
    mipmaps: true

  models:
    formats: [glb, gltf, fbx, obj]
    optimize: true
    weld_vertices: true
    generate_normals: false
    animations_compress: true

  audio:
    formats: [wav, mp3, ogg, flac]
    sample_rate: 44100
    compress: true
    streaming: false

  scripts:
    compile: true                  # bytecode compilation
    obfuscate: false
    strip_debug: false

# --- Asset Bundling ---
bundle ReleaseBuild:
  name: "MyGame"
  version: "1.0.0"
  icon: "assets/icon.png"
  splash: "assets/splash.png"
  assets:
    - textures/**/*.png
    - models/**/*.glb
    - audio/**/*.wav
    - scripts/**/*.zpx
    - scenes/**/*.zpx
```

## 5.3 Output Structure

```
MyGame/
  MyGame.exe           # Native binary + runtime + bundled assets
  MyGame.pck           # Compressed asset archive (optional)
  MyGame.zpx           # Entry point (compiled bytecode)
  runtime/             # Only if not bundled
    zpx_runtime.dll
    zpx_runtime.so
    zpx_runtime.dylib

MyGame_Web/
  index.html
  MyGame.wasm          # WebAssembly runtime
  MyGame.data          # Asset archive
  MyGame.js            # JavaScript loader
  MyGame.worker.js     # Multithreading worker
```

## 5.4 One-Command Build API

```zpx
# --- Build API (from code or CLI) ---
# CLI: zpx build --target windows --profile release --output ./dist

build_game(
  target="windows",
  profile="release",
  output="./dist/MyGame.exe",
  icon="assets/icon.ico",
  version="1.0.0",
  company="MyStudio"
)

# --- Platform-Specific Configuration ---
platform_config windows:
  icon_format: ".ico"
  executable_extension: ".exe"
  console_support: true
  redistributable: false

platform_config macos:
  bundle_format: ".app"
  signing_identity: ""
  notarization: false
```

## 5.5 Runtime Module System

```zpx
# --- Native Module Binding Specification ---
module Physics3D:
  extern:
    fn init(world: ptr) -> void
    fn step(dt: f32) -> void
    fn raycast(origin: vec3, dir: vec3, max_dist: f32) -> RaycastResult
    fn create_rigidbody(entity: Entity) -> ptr
    fn create_collider(entity: Entity, type: str) -> ptr
    fn add_force(rb: ptr, force: vec3, mode: str) -> void

# --- Platform Detection ---
platform = get_platform()      # "windows" | "linux" | "macos" | "web" | "android" | "ios"
graphics_api = get_graphics()  # "vulkan" | "metal" | "dx12" | "webgpu"
cpu_cores = get_cpu_cores()    # i32
total_ram = get_total_ram()    # f32 (GB)
```

---

# 6. Implementation Roadmap

## Phase 0: Foundation (Week 1-2) — CURRENT
```
[✓] ZPX Language interpreter
[✓] Basic entity creation & rendering
[✓] Simple scene structure
[✓] Editor UI shell
```

## Phase 1: ECS & Scene Architecture (Week 3-4)
```
[ ] `entity`, `comp`, `system` keywords in ZPX parser
[ ] Component storage (archetype-based)
[ ] Scene serialization/deserialization (.zpx format)
[ ] Parent-child transform hierarchy
[ ] Tag-based entity queries
[ ] Scene inheritance system
```

## Phase 2: Physics Engine (Week 5-6)
```
[ ] Rigid body dynamics (bulk of physics core)
[ ] Collider types: Box, Sphere, Capsule, Mesh, Compound
[ ] Physics material system
[ ] Collision/Trigger events
[ ] Raycasting, sphere/overlap queries
[ ] Joint constraints: Fixed, Hinge, Spring
[ ] Continuous collision detection (CCD)
[ ] Layer-based collision matrix
```

## Phase 3: Property System & Inspector (Week 7-8)
```
[ ] @range, @slider, @color_picker, @toggle attributes
[ ] @category, @tooltip, @asset, @file metadata
[ ] Auto-generated inspector UI from metadata
[ ] Material/shader property system
[ ] Script variable exposure
[ ] Serialization to .zpx component files
```

## Phase 4: Input & Events (Week 9-10)
```
[ ] Input action binding system
[ ] Keyboard, mouse, gamepad abstraction
[ ] Event bus architecture
[ ] Gesture recognition
[ ] Input recording/playback
[ ] Composite input (combos, sequences)
```

## Phase 5: Build Pipeline (Week 11-12)
```
[ ] Asset compression & packaging
[ ] Platform-specific executable bundling
[ ] WebAssembly target (WebGPU)
[ ] Asset pipeline (textures, models, audio)
[ ] Single-file export
[ ] Bytecode compilation
```

## Phase 6: Polish & Enterprise (Week 13-16)
```
[ ] Profiling & optimization tools
[ ] Network replication (multiplayer)
[ ] NavMesh & AI pathfinding
[ ] Audio spatialization
[ ] Post-processing stack
[ ] GPU particle system
[ ] Terrain/landscape system
[ ] Animation state machine
[ ] Localization system
[ ] Achievements/analytics
```

---

## Appendix: Full Game Example

```zpx
# --- Complete FPS Game in Native .zpx ---
import "zap_game"

build_profile Release:
  target = "windows"
  optimize = "speed"

scene Game:
  entities:
    - player: Entity(
        tag="player",
        transform=Transform(pos=vec3(0, 2, 0)),
        components=[
          CharacterController(height=1.8, radius=0.3),
          Gun(damage=25, fire_rate=0.1, ammo=30),
          Health(max_hp=100)
        ]
      )
    - level: Entity(
        components=[
          SceneReference(path="levels/warehouse.zpx")
        ]
      )
    - sky: Skybox(cubemap="skies/daytime.hdr")
    - directional_light: DirectionalLight(
        color=vec4(1, 0.95, 0.85, 1),
        intensity=2.0,
        shadow_resolution=2048
      )

system FPSController:
  requires: [CharacterController, Gun, Camera]

  run(fn(dt: f32):
    cc = self[Rigidbody]
    gun = self[Gun]
    cam = self[Camera]

    # Look (mouse)
    mouse_delta = input.mouse_delta() * 0.002
    cam.rot.x += mouse_delta.y
    cam.rot.y += mouse_delta.x
    cam.rot.x = clamp(cam.rot.x, -1.5, 1.5)

    # Move (keyboard)
    move = input.action_axis("Move")
    if move.length() > 0.1:
      forward = cam.forward() * move.y
      right = cam.right() * move.x
      move_dir = (forward + right).normalized()
      if input.action("Sprint"):
        cc.move(move_dir * 8.0)
      else:
        cc.move(move_dir * 5.0)

    # Jump
    if input.action_down("Jump") and cc.is_grounded:
      cc.jump(8.0)

    # Shoot
    if input.action("Fire") and gun.can_fire:
      gun.fire(ret=gun.damage)
      hit = raycast(cam.position, cam.forward(), 100.0)
      if hit.hit and hit.entity.has_tag("enemy"):
        hit.entity[Health].take_damage(gun.damage)
      gun.recoil(0.05)

    # Reload
    if input.action_down("Reload"):
      gun.reload()
  end)
end

system EnemyAI:
  requires: [Transform, Health, Enemy]

  run(fn(dt: f32):
    player = find_entity(tag="player")
    if player:
      dist = self[Transform].pos.distance(player[Transform].pos)
      if dist < 15.0:
        # Chase player
        dir = (player[Transform].pos - self[Transform].pos).normalized()
        self[Rigidbody].add_force(dir * 3.0)
        if dist < 2.0:
          player[Health].take_damage(10 * dt)
      elif dist < 30.0:
        # Patrol (idle animation)
        self[MeshRenderer].color = vec4(1, 0.3, 0.3, 1)
  end)
end

zap_init(Game)
zap_run()
```
